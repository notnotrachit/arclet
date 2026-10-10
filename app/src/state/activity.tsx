import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { loadActivity, syncActivity, type ActivityItem } from '@/lib/activity';
import { formatUsdc } from '@/lib/format';
import { initNotifications, notifyLocal } from '@/lib/notify';
import { isRateLimit } from '@/lib/tx';
import { useContacts } from './contacts';
import { useToast } from './toast';
import { useWallet } from './wallet';

interface ActivityContextValue {
  items: ActivityItem[];
  syncing: boolean;
  refresh: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextValue>({ items: [], syncing: false, refresh: async () => {} });

const POLL_MS = 4000;
/** After a rate-limit error, skip this many poll ticks so payments get the RPC budget first. */
const BACKOFF_TICKS = 4;

/**
 * Polls Arc for USDC movements while the app is in the foreground. Arc finality is sub-second, so a
 * payment is final by the time it shows up here — we notify immediately, no confirmations to wait for.
 */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { address, network, refreshBalance } = useWallet();
  const { label } = useContacts();
  const toast = useToast();
  // Items are tagged with the wallet+network they belong to, so a sync that finishes after a
  // network switch can never show the wrong feed.
  const key = address ? `${network}:${address}` : '';
  const [feed, setFeed] = useState<{ key: string; items: ActivityItem[] }>({ key: '', items: [] });
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef<string | null>(null);
  const skipTicks = useRef(0);
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  const sync = useCallback(async (manual = false) => {
    if (!address || inFlight.current === key) return;
    if (!manual && skipTicks.current > 0) {
      skipTicks.current--;
      return;
    }
    inFlight.current = key;
    try {
      const { items: next, newIncoming } = await syncActivity(network, address);
      setFeed({ key, items: next });
      if (newIncoming.length) {
        refreshBalance();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        for (const p of newIncoming) {
          const title = `Received ${formatUsdc(p.amount)} USDC`;
          const body = `From ${labelRef.current(p.counterparty)}${p.note ? ` · “${p.note}”` : ''}`;
          toast({ title, body, tone: 'success', onPress: () => router.push('/activity') });
          if (Platform.OS !== 'web') notifyLocal(title, body, '/activity');
        }
      }
    } catch (e) {
      // Back off on rate limits; other errors are transient and retried next tick.
      if (isRateLimit(e)) skipTicks.current = BACKOFF_TICKS;
    } finally {
      if (inFlight.current === key) inFlight.current = null;
    }
  }, [address, network, key, refreshBalance, toast]);

  /** Pull-to-refresh: same as a poll tick, but shows the spinner. */
  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      await sync(true);
    } finally {
      setSyncing(false);
    }
  }, [sync]);

  useEffect(() => {
    if (!address) return;
    loadActivity(network, address).then((items) =>
      setFeed((f) => (f.key === key && f.items.length ? f : { key, items })),
    );
    if (Platform.OS !== 'web') initNotifications().catch(() => {});
    // sync() only sets state after awaiting the network, so this is a subscription, not a cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync();
    let timer: ReturnType<typeof setInterval> | null = setInterval(sync, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sync();
        timer ??= setInterval(sync, POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [address, network, key, sync]);

  const items = feed.key === key ? feed.items : [];
  return <ActivityContext.Provider value={{ items, syncing, refresh }}>{children}</ActivityContext.Provider>;
}

export const useActivity = () => useContext(ActivityContext);
