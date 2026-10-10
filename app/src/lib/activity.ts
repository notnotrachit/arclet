import { getAddress, type Address, type Hex, type RpcLog } from 'viem';
import { getPublicClient } from './clients';
import { NATIVE_TO_USDC, NATIVE_TRANSFER_EMITTER, USDC } from './contracts/arc';
import { addressTopic, getLogsChunked, MAX_LOG_RANGE, withRetry } from './logs';
import { NETWORKS, type NetworkId } from './networks';
import { noteFromReceipt, TRANSFER_TOPIC } from './payments';
import { readJson, writeJson } from './storage';

export interface ActivityItem {
  id: string;
  txHash: Hex;
  direction: 'in' | 'out';
  counterparty: Address;
  amount: bigint; // 6-decimal USDC units
  blockNumber: bigint;
  timestamp?: number; // ms
  note?: string;
  enriched?: boolean;
}

interface ActivityCache {
  lastBlock: bigint;
  items: ActivityItem[];
}

const MAX_ITEMS = 300;
const ENRICH_LIMIT = 30;
/** When the app was closed for long, only RPC-scan this many recent blocks (explorer covers the rest). */
const MAX_INCREMENTAL_GAP = MAX_LOG_RANGE * 2n;

const cacheKey = (network: NetworkId, me: Address) => `activity:${network}:${me.toLowerCase()}`;

export const loadActivity = async (network: NetworkId, me: Address) =>
  (await readJson<ActivityCache>(cacheKey(network, me), { lastBlock: 0n, items: [] })).items;

function topicAddress(t: Hex | undefined): Address {
  return getAddress(`0x${(t ?? '0x').slice(26)}`);
}

/**
 * Uses Arc's EIP-7708 system Transfer logs (18 decimals), which cover native sends AND ERC-20 transfers,
 * so each USDC movement is counted exactly once (the ERC-20 contract's own 6-dec log is ignored).
 */
function itemsFromLogs(logs: RpcLog[], me: Address): ActivityItem[] {
  const byId = new Map<string, ActivityItem>();
  const meLc = me.toLowerCase();
  for (const log of logs) {
    const from = topicAddress(log.topics[1]);
    const to = topicAddress(log.topics[2]);
    const direction: 'in' | 'out' | null =
      to.toLowerCase() === meLc ? 'in' : from.toLowerCase() === meLc ? 'out' : null;
    if (!direction) continue;
    const counterparty = direction === 'in' ? from : to;
    const txHash = log.transactionHash as Hex;
    const id = `${txHash}:${direction}:${counterparty.toLowerCase()}`;
    const amount = BigInt(log.data) / NATIVE_TO_USDC;
    const prev = byId.get(id);
    if (prev) prev.amount += amount;
    else
      byId.set(id, {
        id,
        txHash,
        direction,
        counterparty,
        amount,
        blockNumber: BigInt(log.blockNumber as Hex),
      });
  }
  return [...byId.values()];
}

async function scanRange(network: NetworkId, me: Address, from: bigint, to: bigint) {
  const client = getPublicClient(network);
  // Sequential on purpose: Arc's public RPC rate-limits bursts of eth_getLogs per IP.
  const outLogs = await getLogsChunked(
    client,
    { address: NATIVE_TRANSFER_EMITTER, topics: [TRANSFER_TOPIC, addressTopic(me)] },
    from,
    to,
  );
  const inLogs = await getLogsChunked(
    client,
    { address: NATIVE_TRANSFER_EMITTER, topics: [TRANSFER_TOPIC, null, addressTopic(me)] },
    from,
    to,
  );
  return itemsFromLogs([...outLogs, ...inLogs], me);
}

interface ExplorerTransfer {
  block_number: number;
  timestamp: string;
  transaction_hash: Hex;
  from: { hash: Address };
  to: { hash: Address };
  total: { value: string; decimals: string };
}

/** Deep history from the Blockscout explorer API (USDC ERC-20 transfers). Best effort. */
async function explorerHistory(network: NetworkId, me: Address): Promise<ActivityItem[]> {
  const url = `${NETWORKS[network].explorerApi}/addresses/${me}/token-transfers?type=ERC-20&token=${USDC}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const body = (await res.json()) as { items?: ExplorerTransfer[] };
  const meLc = me.toLowerCase();
  return (body.items ?? []).map((t) => {
    const direction = t.to.hash.toLowerCase() === meLc ? 'in' : 'out';
    const counterparty = getAddress(direction === 'in' ? t.from.hash : t.to.hash);
    return {
      id: `${t.transaction_hash}:${direction}:${counterparty.toLowerCase()}`,
      txHash: t.transaction_hash,
      direction,
      counterparty,
      amount: BigInt(t.total.value),
      blockNumber: BigInt(t.block_number),
      timestamp: Date.parse(t.timestamp),
    } satisfies ActivityItem;
  });
}

function merge(existing: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const map = new Map(existing.map((i) => [i.id, i]));
  for (const i of incoming) {
    const prev = map.get(i.id);
    map.set(i.id, prev ? { ...i, ...prev, timestamp: prev.timestamp ?? i.timestamp } : i);
  }
  return [...map.values()]
    .sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1))
    .slice(0, MAX_ITEMS);
}

/** Fills in notes (from Memo / GroupWallet events) and timestamps for the most recent items. */
async function enrich(network: NetworkId, items: ActivityItem[]) {
  const client = getPublicClient(network);
  const todo = items.filter((i) => !i.enriched).slice(0, ENRICH_LIMIT);
  const blockTimes = new Map<bigint, number>();
  const queue = [...todo];
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      try {
        const receipt = await withRetry(() => client.getTransactionReceipt({ hash: it.txHash }));
        it.note = noteFromReceipt(receipt.logs);
        if (!it.timestamp) {
          let ts = blockTimes.get(it.blockNumber);
          if (ts === undefined) {
            const block = await withRetry(() => client.getBlock({ blockNumber: it.blockNumber }));
            ts = Number(block.timestamp) * 1000;
            blockTimes.set(it.blockNumber, ts);
          }
          it.timestamp = ts;
        }
        it.enriched = true;
      } catch {
        /* retry on next sync */
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

/**
 * Incremental sync. First run backfills (explorer, else recent RPC blocks) without notifying;
 * later runs return newly seen incoming payments so the UI can notify.
 */
export async function syncActivity(
  network: NetworkId,
  me: Address,
): Promise<{ items: ActivityItem[]; newIncoming: ActivityItem[] }> {
  const key = cacheKey(network, me);
  const cache = await readJson<ActivityCache>(key, { lastBlock: 0n, items: [] });
  const client = getPublicClient(network);
  const latest = await withRetry(() => client.getBlockNumber());
  const firstRun = cache.lastBlock === 0n;
  let found: ActivityItem[] = [];

  if (firstRun || latest - cache.lastBlock > MAX_INCREMENTAL_GAP) {
    try {
      found = await explorerHistory(network, me);
    } catch {
      /* explorer unavailable; RPC scan below still covers recent blocks */
    }
    const from = latest > MAX_INCREMENTAL_GAP ? latest - MAX_INCREMENTAL_GAP : 0n;
    found = [...found, ...(await scanRange(network, me, from, latest))];
  } else if (latest > cache.lastBlock) {
    found = await scanRange(network, me, cache.lastBlock + 1n, latest);
  }

  const known = new Set(cache.items.map((i) => i.id));
  const newIncoming = firstRun ? [] : found.filter((i) => i.direction === 'in' && !known.has(i.id));
  const items = merge(cache.items, found);
  await enrich(network, items);
  await writeJson(key, { lastBlock: latest, items } satisfies ActivityCache);
  return { items, newIncoming: newIncoming.map((n) => items.find((i) => i.id === n.id) ?? n) };
}
