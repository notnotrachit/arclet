import { defineChain, type Address, type Hex } from 'viem';
import { deployments } from './contracts/generated';

export type NetworkId = 'testnet' | 'mainnet';

const multicall3 = { address: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address, blockCreated: 0 };

// Defined here (not imported from viem/chains) so RPC + explorer URLs match docs.arc.io exactly.
// Extra endpoints are Arc's documented public node providers, used as fallbacks when the primary
// RPC rate-limits (-32005) or lags.
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.io', 'https://rpc.quicknode.testnet.arc.io', 'https://rpc.blockdaemon.testnet.arc.io'],
      webSocket: ['wss://rpc.testnet.arc.io'],
    },
  },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' } },
  contracts: { multicall3 },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.mainnet.arc.io', 'https://rpc.quicknode.mainnet.arc.io', 'https://rpc.blockdaemon.mainnet.arc.io'],
      webSocket: ['wss://rpc.mainnet.arc.io'],
    },
  },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
  contracts: { multicall3 },
});

export interface Network {
  id: NetworkId;
  label: string;
  chain: typeof arcTestnet | typeof arcMainnet;
  explorer: string;
  /** Blockscout-compatible API used for deep history; RPC log scans cover the rest. */
  explorerApi: string;
  factory: Address | null;
  factoryDeployBlock: bigint;
}

export const NETWORKS: Record<NetworkId, Network> = {
  testnet: {
    id: 'testnet',
    label: 'Arc Testnet',
    chain: arcTestnet,
    explorer: 'https://explorer.testnet.arc.io',
    explorerApi: 'https://explorer.testnet.arc.io/api/v2',
    factory: deployments.testnet?.factory ?? null,
    factoryDeployBlock: BigInt(deployments.testnet?.deployBlock ?? 0),
  },
  mainnet: {
    id: 'mainnet',
    label: 'Arc Mainnet',
    chain: arcMainnet,
    explorer: 'https://explorer.arc.io',
    explorerApi: 'https://explorer.arc.io/api/v2',
    factory: deployments.mainnet?.factory ?? null,
    factoryDeployBlock: BigInt(deployments.mainnet?.deployBlock ?? 0),
  },
};

export const DEFAULT_NETWORK: NetworkId = 'testnet';

export function networkByChainId(chainId: number): Network | undefined {
  return Object.values(NETWORKS).find((n) => n.chain.id === chainId);
}

export const txUrl = (n: NetworkId, hash: Hex) => `${NETWORKS[n].explorer}/tx/${hash}`;
export const addressUrl = (n: NetworkId, address: Address) => `${NETWORKS[n].explorer}/address/${address}`;
