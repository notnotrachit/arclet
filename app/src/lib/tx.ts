import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  erc20Abi,
  keccak256,
  LimitExceededRpcError,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { feeParams, getPublicClient, getWalletClient } from './clients';
import { groupWalletAbi } from './contracts/generated';
import { memoAbi } from './contracts/arc';
import { withRetry } from './logs';
import type { NetworkId } from './networks';

export interface SentTx {
  hash: Hex;
  receipt: TransactionReceipt;
}

/**
 * Estimates (which doubles as a revert pre-flight), signs, broadcasts, and waits for the receipt.
 * Arc finality is deterministic: one receipt == final.
 */
export async function sendCall(
  network: NetworkId,
  account: Account,
  call: { to: Address; data: Hex },
): Promise<SentTx> {
  const client = getPublicClient(network);
  // Read-only pre-flight steps are safe to retry (rate limits, lagging backends).
  const [gas, fees] = await Promise.all([
    withRetry(() => client.estimateGas({ account, to: call.to, data: call.data }), 3, isRevert),
    withRetry(() => feeParams(client), 3),
  ]);
  const wallet = getWalletClient(network, account);
  const request = await wallet.prepareTransactionRequest({
    account,
    chain: wallet.chain,
    to: call.to,
    data: call.data,
    gas: (gas * 12n) / 10n,
    ...fees,
  });
  // Sign once, broadcast the same bytes: re-sending a signed tx is idempotent (same hash),
  // so a rate-limited or timed-out broadcast can be retried without risking a double payment.
  const raw = await wallet.signTransaction(request as never);
  const hash = keccak256(raw);
  try {
    await withRetry(() => client.sendRawTransaction({ serializedTransaction: raw }), 3);
  } catch (e) {
    // The node may have accepted it before erroring ("already known", timeout); check before failing.
    const seen = await client.getTransaction({ hash }).catch(() => null);
    if (!seen) {
      // Release the locally reserved nonce so the next attempt doesn't leave a gap.
      account.nonceManager?.reset({ address: account.address, chainId: wallet.chain!.id });
      throw e;
    }
  }
  const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 500, timeout: 60_000 });
  if (receipt.status !== 'success') throw new Error('Transaction reverted onchain.');
  return { hash, receipt };
}

/** Contract reverts are deterministic; retrying them only wastes RPC budget. */
function isRevert(e: unknown): boolean {
  return (
    e instanceof BaseError &&
    !!e.walk((x) => x instanceof ContractFunctionRevertedError || /execution reverted/i.test((x as Error).message ?? ''))
  );
}

/** Dry-runs a call; resolves true if it would succeed. */
export async function wouldSucceed(network: NetworkId, account: Account, call: { to: Address; data: Hex }) {
  try {
    await getPublicClient(network).estimateGas({ account, to: call.to, data: call.data });
    return true;
  } catch {
    return false;
  }
}

const KNOWN_ERRORS: Record<string, string> = {
  NotMember: 'You are not a member of this group.',
  NotAdmin: 'Only a group admin can do that.',
  ZeroAmount: 'Enter an amount greater than zero.',
  InvalidAddress: 'That address can’t receive this payment.',
  NoteTooLong: 'Note is too long (max 280 characters).',
  InvalidName: 'Group name must be 1–64 characters.',
  TooManyMembers: 'Groups are limited to 50 members.',
  AlreadyMember: 'That person is already in the group.',
  OverSpendLimit: 'Amount is over this group’s per-payment limit for members.',
  NotAuthorized: 'Only the person who paid (or an admin) can add this expense.',
  InvalidParticipants: 'Split participants must be unique group members.',
  SharesMismatch: 'Split amounts must add up to the total.',
  SettlementTooLarge: 'That’s more than what is owed.',
  OutstandingBalance: 'Settle up split balances before removing this member.',
  LastAdmin: 'A group needs at least one admin.',
  ERC20InsufficientBalance: 'Not enough USDC.',
  SafeERC20FailedOperation: 'USDC transfer failed.',
};

const ERROR_ABI = [...groupWalletAbi, ...erc20Abi, ...memoAbi] as Abi;

function findRevertData(err: unknown): Hex | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  if (reverted?.raw) return reverted.raw;
  let data: Hex | undefined;
  err.walk((e) => {
    const d = (e as { data?: unknown }).data;
    if (typeof d === 'string' && d.startsWith('0x') && d.length >= 10) {
      data = d as Hex;
      return true;
    }
    return false;
  });
  return data;
}

/** Converts viem/RPC errors into a sentence a user can act on. */
export function friendlyError(err: unknown): string {
  let data = findRevertData(err);
  for (let depth = 0; data && depth < 3; depth++) {
    try {
      const decoded = decodeErrorResult({ abi: ERROR_ABI, data });
      if (decoded.errorName === 'MemoFailed') {
        data = decoded.args?.[0] as Hex; // unwrap the inner call's revert
        continue;
      }
      return KNOWN_ERRORS[decoded.errorName] ?? `Transaction would fail (${decoded.errorName}).`;
    } catch {
      break;
    }
  }
  const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : String(err);
  if (/insufficient funds/i.test(msg)) return 'Not enough USDC to cover the amount plus network fee.';
  if (isRateLimit(err)) return 'Arc’s public RPC is rate-limiting right now. Nothing was sent; try again in a few seconds.';
  if (/blocklist|blocked/i.test(msg)) return 'This address is restricted and can’t send or receive USDC.';
  return msg || 'Something went wrong.';
}

/** JSON-RPC -32005 ("rate limit exceeded"), surfaced by viem as "Request exceeds defined limit." */
export function isRateLimit(err: unknown): boolean {
  if (err instanceof BaseError && err.walk((e) => e instanceof LimitExceededRpcError)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit|exceeds defined limit|-32005|429/i.test(msg);
}
