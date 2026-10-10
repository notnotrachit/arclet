import type { Address, Hex, PublicClient, RpcLog } from 'viem';

/** Arc public RPC rejects eth_getLogs ranges of 10,000 blocks or more. */
export const MAX_LOG_RANGE = 9_000n;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * eth_getLogs with chunking and retries for Arc's load-balanced RPC
 * (-32014: backend behind on blocks, -32005: rate limited).
 */
export async function getLogsChunked(
  client: PublicClient,
  filter: { address?: Address | Address[]; topics: (Hex | Hex[] | null)[] },
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RpcLog[]> {
  const out: RpcLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += MAX_LOG_RANGE + 1n) {
    const end = start + MAX_LOG_RANGE > toBlock ? toBlock : start + MAX_LOG_RANGE;
    if (start > fromBlock) await sleep(250); // pace multi-chunk scans under the RPC rate limit
    out.push(...(await withRetry(() => rawGetLogs(client, filter, start, end))));
  }
  return out;
}

async function rawGetLogs(
  client: PublicClient,
  filter: { address?: Address | Address[]; topics: (Hex | Hex[] | null)[] },
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RpcLog[]> {
  return client.request({
    method: 'eth_getLogs',
    params: [
      {
        address: filter.address,
        topics: filter.topics,
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${toBlock.toString(16)}`,
      },
    ],
  }) as unknown as Promise<RpcLog[]>;
}

/** Retries transient RPC failures with exponential backoff; `skip` short-circuits deterministic errors. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, skip?: (e: unknown) => boolean): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (skip?.(e) || i === attempts - 1) break;
      await sleep(400 * 2 ** i);
    }
  }
  throw last;
}

export const addressTopic = (a: Address): Hex => `0x000000000000000000000000${a.slice(2).toLowerCase()}`;
