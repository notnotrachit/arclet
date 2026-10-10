import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getAddress, isAddress, type Address } from 'viem';
import { getGroupDetail, getGroupHistory, type GroupDetail, type GroupHistoryItem } from '@/lib/groups';
import { useContacts } from './contacts';
import { useReadyWallet } from './wallet';

/** Loads a group's state + event history, refreshing whenever the screen gains focus. */
export function useGroup(rawAddress: string | undefined, { withHistory = false } = {}) {
  const { address: me, network } = useReadyWallet();
  const { rememberGroup } = useContacts();
  const address: Address | null = rawAddress && isAddress(rawAddress) ? getAddress(rawAddress) : null;
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [history, setHistory] = useState<GroupHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const d = await getGroupDetail(network, address, me);
      setDetail(d);
      rememberGroup(address, d.name);
      setError(undefined);
      if (withHistory) setHistory(await getGroupHistory(network, address, d.createdAtBlock));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [address, me, network, rememberGroup, withHistory]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { address, detail, history, loading, error, refresh, me };
}
