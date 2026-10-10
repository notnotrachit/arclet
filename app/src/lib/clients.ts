import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  parseGwei,
  type Account,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { NETWORKS, type NetworkId } from './networks';

/**
 * Primary Arc RPC first, then the documented public providers. viem's fallback transport moves to the
 * next endpoint when one errors (including -32005 rate limits), so a busy endpoint doesn't fail a payment.
 */
function transportFor(network: NetworkId): Transport {
  const urls = NETWORKS[network].chain.rpcUrls.default.http;
  return fallback(
    urls.map((url) => http(url, { retryCount: 2, retryDelay: 400, timeout: 15_000 })),
    { rank: false, retryCount: 1 },
  );
}

const publicClients = new Map<NetworkId, PublicClient>();

export function getPublicClient(network: NetworkId): PublicClient {
  let client = publicClients.get(network);
  if (!client) {
    client = createPublicClient({
      chain: NETWORKS[network].chain,
      transport: transportFor(network),
      batch: { multicall: true },
      pollingInterval: 500,
    }) as PublicClient;
    publicClients.set(network, client);
  }
  return client;
}

export function getWalletClient(network: NetworkId, account: Account): WalletClient {
  return createWalletClient({ account, chain: NETWORKS[network].chain, transport: transportFor(network) });
}

/** Arc's base fee floor; transactions under it are silently dropped by the mempool. */
const MIN_BASE_FEE = parseGwei('20');
const TIP = parseGwei('1');

/** EIP-1559 fee params that always clear Arc's 20 gwei floor with headroom for EWMA drift. */
export async function feeParams(client: PublicClient) {
  const block = await client.getBlock({ blockTag: 'latest' });
  const base = block.baseFeePerGas && block.baseFeePerGas > MIN_BASE_FEE ? block.baseFeePerGas : MIN_BASE_FEE;
  return { maxFeePerGas: base * 2n + TIP, maxPriorityFeePerGas: TIP };
}
