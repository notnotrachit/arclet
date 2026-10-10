import {
  bytesToHex,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  hexToString,
  isAddress,
  keccak256,
  parseEventLogs,
  stringToHex,
  type Account,
  type Address,
  type Hex,
} from 'viem';
import { getPublicClient } from './clients';
import { MEMO, memoAbi, NATIVE_TO_USDC, NATIVE_TRANSFER_EMITTER, transferEventAbi, USDC } from './contracts/arc';
import { groupWalletAbi } from './contracts/generated';
import { parseUsdcInput, usdcToDecimal } from './format';
import { addressTopic, getLogsChunked, withRetry } from './logs';
import type { NetworkId } from './networks';
import { sendCall, wouldSucceed, type SentTx } from './tx';

export const MAX_NOTE_LENGTH = 140;

/** What a receiver shares via QR / NFC / link. Amount is a decimal string in USDC. */
export interface PaymentRequest {
  to: Address;
  amount?: string;
  note?: string;
  ref?: string;
  chainId?: number;
  label?: string;
}

export function newRef(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes).slice(2);
}

/** Memo ids are namespaced so they can't collide with other apps using Arc's Memo contract. */
export const memoIdFor = (ref: string): Hex => keccak256(stringToHex(`arclet:${ref}`));

// ---------------------------------------------------------------------------------------------
// Request URIs
// ---------------------------------------------------------------------------------------------

export function buildRequestUri(r: PaymentRequest): string {
  const q: string[] = [`to=${r.to}`];
  if (r.amount) q.push(`amount=${encodeURIComponent(r.amount)}`);
  if (r.note) q.push(`note=${encodeURIComponent(r.note)}`);
  if (r.ref) q.push(`ref=${encodeURIComponent(r.ref)}`);
  if (r.chainId) q.push(`chain=${r.chainId}`);
  if (r.label) q.push(`label=${encodeURIComponent(r.label)}`);
  return `arclet://pay?${q.join('&')}`;
}

/** EIP-681 USDC transfer URI so non-Arclet wallets can pay the same request (no memo). */
export function buildEip681Uri(r: PaymentRequest, chainId: number): string {
  const units = r.amount ? parseUsdcInput(r.amount) : null;
  return `ethereum:${USDC}@${chainId}/transfer?address=${r.to}${units ? `&uint256=${units}` : ''}`;
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of qs.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = decodeURIComponent(i < 0 ? part : part.slice(0, i));
    const v = i < 0 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

function cleanAmount(a: string | undefined): string | undefined {
  if (!a) return undefined;
  const units = parseUsdcInput(a);
  return units && units > 0n ? usdcToDecimal(units) : undefined;
}

/** EIP-681 numbers may be integers or scientific notation like "2.5e6". */
function parseEip681Number(v: string | undefined): bigint {
  if (!v) return 0n;
  if (/^\d+$/.test(v)) return BigInt(v);
  const m = v.match(/^(\d+)(?:\.(\d+))?e(\d+)$/i);
  if (!m) return 0n;
  const [, int, frac = '', exp] = m;
  const shift = Number(exp) - frac.length;
  if (shift < 0) return 0n;
  return BigInt(int + frac) * 10n ** BigInt(shift);
}

/** Accepts arclet:// links, EIP-681 URIs, or a bare address. Returns null if unrecognized. */
export function parsePaymentUri(raw: string): PaymentRequest | null {
  const s = raw.trim();
  if (isAddress(s)) return { to: getAddress(s) };

  const arclet = s.match(/^arclet:\/\/pay\/?\?(.*)$/i);
  if (arclet) {
    const q = parseQuery(arclet[1]);
    if (!q.to || !isAddress(q.to)) return null;
    return {
      to: getAddress(q.to),
      amount: cleanAmount(q.amount),
      note: q.note?.slice(0, MAX_NOTE_LENGTH) || undefined,
      ref: q.ref && /^[0-9a-zA-Z_-]{1,64}$/.test(q.ref) ? q.ref : undefined,
      chainId: q.chain ? Number(q.chain) : undefined,
      label: q.label?.slice(0, 64) || undefined,
    };
  }

  // ethereum:<target>[@chainId][/function][?params]
  const eip681 = s.match(/^ethereum:(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\/(\w+))?(?:\?(.*))?$/);
  if (eip681) {
    const [, target, chain, fn, qs] = eip681;
    const q = parseQuery(qs ?? '');
    const chainId = chain ? Number(chain) : undefined;
    if (fn === 'transfer' && target.toLowerCase() === USDC.toLowerCase()) {
      if (!q.address || !isAddress(q.address)) return null;
      const units = parseEip681Number(q.uint256);
      return { to: getAddress(q.address), amount: units > 0n ? usdcToDecimal(units) : undefined, chainId };
    }
    if (!fn) {
      const wei = parseEip681Number(q.value);
      return { to: getAddress(target), amount: wei > 0n ? usdcToDecimal(wei / NATIVE_TO_USDC) : undefined, chainId };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

/**
 * Personal payment: USDC.transfer wrapped in Arc's Memo predeploy. Memo uses the CallFrom precompile,
 * so USDC still sees the user's wallet as the sender, and the note + memoId land onchain for reconciliation.
 */
export async function payPersonal(args: {
  network: NetworkId;
  account: Account;
  to: Address;
  amount: bigint;
  note?: string;
  ref?: string;
}): Promise<SentTx> {
  const { network, account, to, amount, note, ref } = args;
  const transfer = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] });
  const data = encodeFunctionData({
    abi: memoAbi,
    functionName: 'memo',
    args: [USDC, transfer, memoIdFor(ref ?? newRef()), stringToHex(note ?? '')],
  });
  return sendCall(network, account, { to: MEMO, data });
}

/**
 * Group payment: GroupWallet.pay(), also routed through Memo so the receiver's phone can match the
 * request by memoId. If the Memo path can't be simulated, fall back to calling the group directly.
 */
export async function payFromGroup(args: {
  network: NetworkId;
  account: Account;
  group: Address;
  to: Address;
  amount: bigint;
  note?: string;
  ref?: string;
}): Promise<SentTx> {
  const { network, account, group, to, amount, note = '', ref } = args;
  const payData = encodeFunctionData({ abi: groupWalletAbi, functionName: 'pay', args: [to, amount, note] });
  const viaMemo = {
    to: MEMO,
    data: encodeFunctionData({
      abi: memoAbi,
      functionName: 'memo',
      args: [group, payData, memoIdFor(ref ?? newRef()), stringToHex(note)],
    }),
  };
  if (await wouldSucceed(network, account, viaMemo)) return sendCall(network, account, viaMemo);
  return sendCall(network, account, { to: group, data: payData });
}

// ---------------------------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------------------------

export interface IncomingPayment {
  from: Address;
  amount: bigint; // 6-decimal units
  note?: string;
  txHash: Hex;
}

/** Sums EIP-7708 native Transfer logs to `me` in a receipt, in 6-decimal units. */
export function receivedInReceipt(logs: { address: Address; topics: Hex[]; data: Hex }[], me: Address) {
  let total = 0n;
  let from: Address | undefined;
  const transfers = parseEventLogs({
    abi: transferEventAbi,
    logs: logs.filter((l) => l.address.toLowerCase() === NATIVE_TRANSFER_EMITTER.toLowerCase()) as never,
  });
  for (const t of transfers) {
    if (t.args.to.toLowerCase() === me.toLowerCase()) {
      total += t.args.value / NATIVE_TO_USDC;
      from ??= t.args.from;
    }
  }
  return { total, from };
}

/** Extracts the human note from a receipt: GroupWallet event notes win over raw Memo bytes. */
export function noteFromReceipt(logs: { address: Address; topics: Hex[]; data: Hex }[]): string | undefined {
  try {
    const group = parseEventLogs({ abi: groupWalletAbi, logs: logs as never });
    for (const e of group) {
      const n = (e.args as { note?: string }).note;
      if (n) return n;
    }
  } catch {
    /* not a group tx */
  }
  try {
    const memos = parseEventLogs({ abi: memoAbi, eventName: 'Memo', logs: logs as never });
    for (const m of memos) {
      if (m.args.memo && m.args.memo !== '0x') return hexToString(m.args.memo);
    }
  } catch {
    /* no memo */
  }
  return undefined;
}

/**
 * One polling step for the Receive screen. Matches by memoId (Arclet payers) and, when an amount was
 * requested, by an exact incoming amount (any wallet paying via QR/EIP-681).
 */
export async function findIncomingPayment(args: {
  network: NetworkId;
  me: Address;
  ref: string;
  amount?: bigint;
  fromBlock: bigint;
}): Promise<IncomingPayment | null> {
  const { network, me, ref, amount, fromBlock } = args;
  const client = getPublicClient(network);
  const latest = await withRetry(() => client.getBlockNumber());
  if (latest < fromBlock) return null;

  const memoLogs = await getLogsChunked(
    client,
    { address: MEMO, topics: [MEMO_EVENT_TOPIC, null, null, memoIdFor(ref)] },
    fromBlock,
    latest,
  );
  for (const log of memoLogs) {
    const receipt = await withRetry(() => client.getTransactionReceipt({ hash: log.transactionHash as Hex }));
    const { total, from } = receivedInReceipt(receipt.logs, me);
    if (total > 0n && receipt.status === 'success') {
      return { from: from ?? receipt.from, amount: total, note: noteFromReceipt(receipt.logs), txHash: receipt.transactionHash };
    }
  }

  if (amount) {
    const transfers = await getLogsChunked(
      client,
      { address: NATIVE_TRANSFER_EMITTER, topics: [TRANSFER_TOPIC, null, addressTopic(me)] },
      fromBlock,
      latest,
    );
    for (const log of transfers) {
      if (BigInt(log.data) / NATIVE_TO_USDC === amount) {
        const receipt = await withRetry(() => client.getTransactionReceipt({ hash: log.transactionHash as Hex }));
        return {
          from: `0x${log.topics[1]!.slice(26)}` as Address,
          amount,
          note: noteFromReceipt(receipt.logs),
          txHash: receipt.transactionHash,
        };
      }
    }
  }
  return null;
}

export const TRANSFER_TOPIC: Hex = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
/** keccak256("Memo(address,address,bytes32,bytes32,bytes,uint256)") */
export const MEMO_EVENT_TOPIC: Hex = '0xeb15ee720798341c37739df41be53acfbbf70ae6802dade35457beec6e47a5e4';
