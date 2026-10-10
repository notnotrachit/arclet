import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { nonceManager, type Address, type PrivateKeyAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getPublicClient } from '@/lib/clients';
import { nativeToUsdc } from '@/lib/format';
import { createWallet, importWallet, loadPrivateKey, wipeWallet } from '@/lib/keystore';
import { withRetry } from '@/lib/logs';
import { DEFAULT_NETWORK, type NetworkId } from '@/lib/networks';
import { readJson, removeKeys, writeJson } from '@/lib/storage';

interface WalletContextValue {
  status: 'loading' | 'none' | 'ready';
  account: PrivateKeyAccount | null;
  address: Address | null;
  network: NetworkId;
  setNetwork: (n: NetworkId) => Promise<void>;
  /** Spendable USDC in 6-decimal units (native balance, which is also the gas balance). */
  balance: bigint | null;
  refreshBalance: () => Promise<void>;
  create: () => Promise<string>;
  importFrom: (input: string) => Promise<void>;
  reset: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const NETWORK_KEY = 'settings:network';

// The nonce manager tracks pending nonces locally, which avoids "nonce too low" when Arc's
// load-balanced RPC answers from a backend that is a block behind right after a send.
const toAccount = (pk: `0x${string}`) => privateKeyToAccount(pk, { nonceManager });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletContextValue['status']>('loading');
  const [account, setAccount] = useState<PrivateKeyAccount | null>(null);
  const [network, setNetworkState] = useState<NetworkId>(DEFAULT_NETWORK);
  // Tagged with wallet+network so a stale balance is never shown after switching.
  const [bal, setBal] = useState<{ key: string; value: bigint } | null>(null);
  const balanceKey = account ? `${network}:${account.address}` : '';
  const balance = bal && bal.key === balanceKey ? bal.value : null;

  useEffect(() => {
    (async () => {
      const [pk, savedNetwork] = await Promise.all([
        loadPrivateKey(),
        readJson<NetworkId>(NETWORK_KEY, DEFAULT_NETWORK),
      ]);
      setNetworkState(savedNetwork);
      if (pk) {
        setAccount(toAccount(pk));
        setStatus('ready');
      } else {
        setStatus('none');
      }
    })();
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!account) return;
    try {
      const wei = await withRetry(() => getPublicClient(network).getBalance({ address: account.address }));
      setBal({ key: `${network}:${account.address}`, value: nativeToUsdc(wei) });
    } catch {
      /* keep last known balance */
    }
  }, [account, network]);

  useEffect(() => {
    // refreshBalance() only sets state after awaiting the RPC.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshBalance();
  }, [refreshBalance]);

  const setNetwork = useCallback(async (n: NetworkId) => {
    await writeJson(NETWORK_KEY, n);
    setNetworkState(n);
  }, []);

  const create = useCallback(async () => {
    const { privateKey, mnemonic } = await createWallet();
    setAccount(toAccount(privateKey));
    setStatus('ready');
    return mnemonic;
  }, []);

  const importFrom = useCallback(async (input: string) => {
    const pk = await importWallet(input);
    setAccount(toAccount(pk));
    setStatus('ready');
  }, []);

  const reset = useCallback(async () => {
    await wipeWallet();
    await Promise.all([removeKeys('activity:'), removeKeys('group-history:')]);
    setAccount(null);
    setBal(null);
    setStatus('none');
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      account,
      address: account?.address ?? null,
      network,
      setNetwork,
      balance,
      refreshBalance,
      create,
      importFrom,
      reset,
    }),
    [status, account, network, setNetwork, balance, refreshBalance, create, importFrom, reset],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

/** For screens that only render once a wallet exists. */
export function useReadyWallet() {
  const w = useWallet();
  if (!w.account || !w.address) throw new Error('Wallet not ready');
  return { ...w, account: w.account, address: w.address };
}
