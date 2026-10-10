import {
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  type Account,
  type Address,
  type Hex,
} from 'viem';
import { getPublicClient } from './clients';
import { MULTICALL3_FROM, multicall3FromAbi, USDC } from './contracts/arc';
import { groupWalletAbi, groupWalletFactoryAbi } from './contracts/generated';
import { getLogsChunked, withRetry } from './logs';
import { NETWORKS, type NetworkId } from './networks';
import { readJson, writeJson } from './storage';
import { sendCall, wouldSucceed, type SentTx } from './tx';

export interface GroupSummary {
  address: Address;
  name: string;
  balance: bigint;
  memberCount: number;
  myNet: bigint;
  isAdmin: boolean;
}

export interface GroupMember {
  address: Address;
  admin: boolean;
  contributed: bigint;
  spent: bigint;
  net: bigint;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
  memberSpendLimit: bigint;
  createdAtBlock: bigint;
}

export type GroupEvent =
  | { kind: 'deposit'; member: Address; amount: bigint; note: string }
  | { kind: 'pay'; member: Address; to: Address; amount: bigint; note: string }
  | {
      kind: 'expense';
      id: bigint;
      paidBy: Address;
      createdBy: Address;
      amount: bigint;
      participants: Address[];
      shares: bigint[];
      note: string;
    }
  | { kind: 'settle'; debtor: Address; creditor: Address; amount: bigint; offchain: boolean; note: string }
  | { kind: 'member'; member: Address; by: Address; added: boolean }
  | { kind: 'admin'; member: Address; isAdmin: boolean }
  | { kind: 'limit'; limit: bigint };

export type GroupHistoryItem = GroupEvent & { txHash: Hex; blockNumber: bigint; logIndex: number };

function requireFactory(network: NetworkId): Address {
  const f = NETWORKS[network].factory;
  if (!f) throw new Error(`Group wallets aren't deployed on ${NETWORKS[network].label} yet.`);
  return f;
}

export const groupsAvailable = (network: NetworkId) => NETWORKS[network].factory !== null;

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export async function listMyGroups(network: NetworkId, me: Address): Promise<GroupSummary[]> {
  if (!groupsAvailable(network)) return [];
  const client = getPublicClient(network);
  const factory = requireFactory(network);
  const addresses = (await client.readContract({
    address: factory,
    abi: groupWalletFactoryAbi,
    functionName: 'groupsOf',
    args: [me],
  })) as readonly Address[];

  const rows = await Promise.all(
    addresses.map(async (address) => {
      const [name, balance, memberCount, info] = await Promise.all([
        client.readContract({ address, abi: groupWalletAbi, functionName: 'name' }),
        client.readContract({ address, abi: groupWalletAbi, functionName: 'balance' }),
        client.readContract({ address, abi: groupWalletAbi, functionName: 'memberCount' }),
        client.readContract({ address, abi: groupWalletAbi, functionName: 'memberInfo', args: [me] }),
      ]);
      if (!info.active) return null;
      return {
        address,
        name,
        balance,
        memberCount: Number(memberCount),
        myNet: info.net,
        isAdmin: info.admin,
      } satisfies GroupSummary;
    }),
  );
  return rows.filter((r): r is GroupSummary => r !== null).reverse(); // newest first
}

export async function getGroupDetail(network: NetworkId, address: Address, me: Address): Promise<GroupDetail> {
  const client = getPublicClient(network);
  const [name, balance, membersRaw, limit, createdAtBlock] = await Promise.all([
    client.readContract({ address, abi: groupWalletAbi, functionName: 'name' }),
    client.readContract({ address, abi: groupWalletAbi, functionName: 'balance' }),
    client.readContract({ address, abi: groupWalletAbi, functionName: 'members' }),
    client.readContract({ address, abi: groupWalletAbi, functionName: 'memberSpendLimit' }),
    client.readContract({ address, abi: groupWalletAbi, functionName: 'createdAtBlock' }),
  ]);
  const [accounts, info] = membersRaw;
  const members: GroupMember[] = accounts.map((a, i) => ({
    address: a,
    admin: info[i].admin,
    contributed: info[i].contributed,
    spent: info[i].spent,
    net: info[i].net,
  }));
  const mine = members.find((m) => m.address.toLowerCase() === me.toLowerCase());
  return {
    address,
    name,
    balance,
    memberCount: members.length,
    myNet: mine?.net ?? 0n,
    isAdmin: mine?.admin ?? false,
    members,
    memberSpendLimit: limit,
    createdAtBlock,
  };
}

function toGroupEvent(eventName: string, a: Record<string, unknown>): GroupEvent | null {
  switch (eventName) {
    case 'Deposited':
      return { kind: 'deposit', member: a.member as Address, amount: a.amount as bigint, note: a.note as string };
    case 'Paid':
      return { kind: 'pay', member: a.member as Address, to: a.to as Address, amount: a.amount as bigint, note: a.note as string };
    case 'ExpenseAdded':
      return {
        kind: 'expense',
        id: a.id as bigint,
        paidBy: a.paidBy as Address,
        createdBy: a.createdBy as Address,
        amount: a.amount as bigint,
        participants: [...(a.participants as Address[])],
        shares: [...(a.shares as bigint[])],
        note: a.note as string,
      };
    case 'Settled':
      return {
        kind: 'settle',
        debtor: a.debtor as Address,
        creditor: a.creditor as Address,
        amount: a.amount as bigint,
        offchain: a.offchain as boolean,
        note: a.note as string,
      };
    case 'MemberAdded':
      return { kind: 'member', member: a.member as Address, by: a.by as Address, added: true };
    case 'MemberRemoved':
      return { kind: 'member', member: a.member as Address, by: a.by as Address, added: false };
    case 'AdminUpdated':
      return { kind: 'admin', member: a.member as Address, isAdmin: a.isAdmin as boolean };
    case 'SpendLimitUpdated':
      return { kind: 'limit', limit: a.limit as bigint };
    default:
      return null;
  }
}

interface HistoryCache {
  lastBlock: bigint;
  items: GroupHistoryItem[];
}

/** Incrementally scans the group's events (cached per device), newest first. */
export async function getGroupHistory(
  network: NetworkId,
  address: Address,
  createdAtBlock: bigint,
): Promise<GroupHistoryItem[]> {
  const key = `group-history:${network}:${address.toLowerCase()}`;
  const cache = await readJson<HistoryCache>(key, { lastBlock: createdAtBlock - 1n, items: [] });
  const client = getPublicClient(network);
  const latest = await withRetry(() => client.getBlockNumber());
  if (latest > cache.lastBlock) {
    const logs = await getLogsChunked(client, { address, topics: [] }, cache.lastBlock + 1n, latest);
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: groupWalletAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
        const ev = toGroupEvent(decoded.eventName, decoded.args as Record<string, unknown>);
        if (ev) {
          cache.items.push({
            ...ev,
            txHash: log.transactionHash as Hex,
            blockNumber: BigInt(log.blockNumber as Hex),
            logIndex: Number(log.logIndex),
          });
        }
      } catch {
        /* not one of ours */
      }
    }
    cache.lastBlock = latest;
    await writeJson(key, cache);
  }
  return [...cache.items].sort((x, y) =>
    x.blockNumber === y.blockNumber ? y.logIndex - x.logIndex : x.blockNumber > y.blockNumber ? -1 : 1,
  );
}

/** Greedy debt simplification: who should pay whom to bring every net balance to zero. */
export function suggestSettlements(members: GroupMember[]): { from: Address; to: Address; amount: bigint }[] {
  const debtors = members.filter((m) => m.net < 0n).map((m) => ({ a: m.address, v: -m.net }));
  const creditors = members.filter((m) => m.net > 0n).map((m) => ({ a: m.address, v: m.net }));
  const desc = (x: { v: bigint }, y: { v: bigint }) => (y.v > x.v ? 1 : y.v < x.v ? -1 : 0);
  debtors.sort(desc);
  creditors.sort(desc);
  const out: { from: Address; to: Address; amount: bigint }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = debtors[i].v < creditors[j].v ? debtors[i].v : creditors[j].v;
    out.push({ from: debtors[i].a, to: creditors[j].a, amount: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0n) i++;
    if (creditors[j].v === 0n) j++;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

export async function createGroup(args: {
  network: NetworkId;
  account: Account;
  name: string;
  members: Address[];
  memberSpendLimit: bigint;
}): Promise<{ tx: SentTx; group: Address | null }> {
  const factory = requireFactory(args.network);
  const data = encodeFunctionData({
    abi: groupWalletFactoryAbi,
    functionName: 'createGroup',
    args: [args.name, args.members, args.memberSpendLimit],
  });
  const tx = await sendCall(args.network, args.account, { to: factory, data });
  let group: Address | null = null;
  for (const log of tx.receipt.logs) {
    if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: groupWalletFactoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'GroupCreated') group = ev.args.group;
    } catch {
      /* other factory event */
    }
  }
  return { tx, group };
}

/**
 * Runs `call` after making sure `spender` can pull `amount` USDC from the user.
 * Preferred path: one transaction through Arc's Multicall3From (approve + call, both with the user as
 * msg.sender). Fallback: a separate approve tx, then the call. Sub-second finality keeps both fast.
 */
async function withUsdcApproval(
  network: NetworkId,
  account: Account,
  spender: Address,
  amount: bigint,
  call: { to: Address; data: Hex },
): Promise<SentTx> {
  const client = getPublicClient(network);
  const allowance = await client.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, spender],
  });
  if (allowance >= amount) return sendCall(network, account, call);

  const approveData = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] });
  const batched = {
    to: MULTICALL3_FROM,
    data: encodeFunctionData({
      abi: multicall3FromAbi,
      functionName: 'aggregate3',
      args: [
        [
          { target: USDC, allowFailure: false, callData: approveData },
          { target: call.to, allowFailure: false, callData: call.data },
        ],
      ],
    }),
  };
  if (await wouldSucceed(network, account, batched)) return sendCall(network, account, batched);

  await sendCall(network, account, { to: USDC, data: approveData });
  return sendCall(network, account, call);
}

export function depositToGroup(args: { network: NetworkId; account: Account; group: Address; amount: bigint; note: string }) {
  const data = encodeFunctionData({ abi: groupWalletAbi, functionName: 'deposit', args: [args.amount, args.note] });
  return withUsdcApproval(args.network, args.account, args.group, args.amount, { to: args.group, data });
}

export function addExpense(args: {
  network: NetworkId;
  account: Account;
  group: Address;
  paidBy: Address;
  amount: bigint;
  participants: Address[];
  shares: bigint[];
  note: string;
}) {
  const data = encodeFunctionData({
    abi: groupWalletAbi,
    functionName: 'addExpense',
    args: [args.paidBy, args.amount, args.participants, args.shares, args.note],
  });
  return sendCall(args.network, args.account, { to: args.group, data });
}

export function settleDebt(args: {
  network: NetworkId;
  account: Account;
  group: Address;
  creditor: Address;
  amount: bigint;
  note: string;
}) {
  const data = encodeFunctionData({
    abi: groupWalletAbi,
    functionName: 'settle',
    args: [args.creditor, args.amount, args.note],
  });
  return withUsdcApproval(args.network, args.account, args.group, args.amount, { to: args.group, data });
}

export function recordCashSettlement(args: {
  network: NetworkId;
  account: Account;
  group: Address;
  debtor: Address;
  amount: bigint;
  note: string;
}) {
  const data = encodeFunctionData({
    abi: groupWalletAbi,
    functionName: 'recordOffchainSettlement',
    args: [args.debtor, args.amount, args.note],
  });
  return sendCall(args.network, args.account, { to: args.group, data });
}

export function addMember(args: { network: NetworkId; account: Account; group: Address; member: Address }) {
  const data = encodeFunctionData({ abi: groupWalletAbi, functionName: 'addMember', args: [args.member] });
  return sendCall(args.network, args.account, { to: args.group, data });
}

export function removeMember(args: { network: NetworkId; account: Account; group: Address; member: Address }) {
  const data = encodeFunctionData({ abi: groupWalletAbi, functionName: 'removeMember', args: [args.member] });
  return sendCall(args.network, args.account, { to: args.group, data });
}

export function setAdmin(args: { network: NetworkId; account: Account; group: Address; member: Address; admin: boolean }) {
  const data = encodeFunctionData({ abi: groupWalletAbi, functionName: 'setAdmin', args: [args.member, args.admin] });
  return sendCall(args.network, args.account, { to: args.group, data });
}

export function setSpendLimit(args: { network: NetworkId; account: Account; group: Address; limit: bigint }) {
  const data = encodeFunctionData({ abi: groupWalletAbi, functionName: 'setMemberSpendLimit', args: [args.limit] });
  return sendCall(args.network, args.account, { to: args.group, data });
}
