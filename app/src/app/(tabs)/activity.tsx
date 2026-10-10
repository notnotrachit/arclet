import { useActivity } from '@/state/activity';
import { useReadyWallet } from '@/state/wallet';
import { ActivityRow } from '@/ui/ActivityRow';
import { Card, Empty, Screen } from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function Activity() {
  const { network } = useReadyWallet();
  const { items, refresh, syncing } = useActivity();
  return (
    <Screen refreshing={syncing} onRefresh={refresh}>
      <Card style={{ paddingVertical: spacing.xs }}>
        {items.length === 0 ? (
          <Empty icon="receipt-outline" title="Nothing here yet" body="Payments you send and receive show up instantly." />
        ) : (
          items.map((i) => <ActivityRow key={i.id} item={i} network={network} />)
        )}
      </Card>
    </Screen>
  );
}
