import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { groupsAvailable, listMyGroups, type GroupSummary } from '@/lib/groups';
import { useContacts } from './contacts';
import { useWallet } from './wallet';

interface GroupsValue {
  groups: GroupSummary[];
  loading: boolean;
  available: boolean;
  refresh: () => Promise<void>;
}

const GroupsContext = createContext<GroupsValue>({ groups: [], loading: false, available: false, refresh: async () => {} });

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { address, network } = useWallet();
  const { rememberGroup } = useContacts();
  const [groups, setGroups] = useState<{ key: string; list: GroupSummary[] }>({ key: '', list: [] });
  const [loading, setLoading] = useState(false);
  const available = groupsAvailable(network);
  const key = address && available ? `${network}:${address}` : '';

  /** Fetches without touching state until the network call returns (safe to call from effects). */
  const load = useCallback(async () => {
    if (!address || !available) return;
    try {
      const list = await listMyGroups(network, address);
      list.forEach((g) => rememberGroup(g.address, g.name));
      setGroups({ key: `${network}:${address}`, list });
    } catch {
      /* keep last list */
    }
  }, [address, network, available, rememberGroup]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    // load() only sets state after awaiting the RPC.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const list = groups.key === key ? groups.list : [];
  return (
    <GroupsContext.Provider value={{ groups: list, loading, available, refresh }}>{children}</GroupsContext.Provider>
  );
}

export const useGroups = () => useContext(GroupsContext);
