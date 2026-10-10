import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useActivity } from '@/state/activity';
import { useContacts } from '@/state/contacts';
import { useReadyWallet } from '@/state/wallet';
import { ActivityRow } from '@/ui/ActivityRow';
import { Button, Card, Empty, Field, PageIntro, Screen, Segmented } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

type Filter = 'all' | 'in' | 'out';
export default function Activity() {
  const { type } = useTheme();
  const { network } = useReadyWallet();
  const { label } = useContacts();
  const { items, refresh, syncing } = useActivity();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter((item) => (filter === 'all' || item.direction === filter) && `${label(item.counterparty)} ${item.counterparty} ${item.note ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [items, filter, query, label]);
  return (
    <Screen edges={[]} refreshing={syncing} onRefresh={refresh}>
      <PageIntro eyebrow="Your money trail" title="Every payment, together." body="Find what you sent, received, and shared." />
      {items.length > 0 ? <Field label="Search payments" placeholder="A name, address, or note" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} /> : null}
      <Segmented<Filter> options={[{ value: 'all', label: 'All' }, { value: 'in', label: 'Received' }, { value: 'out', label: 'Sent' }]} value={filter} onChange={setFilter} />
      <Card style={{ paddingVertical: spacing.xs, marginTop: spacing.md }}>
        {filtered.length === 0 ? <Empty icon={items.length ? 'search-outline' : 'receipt-outline'} title={items.length ? 'No payments found' : 'Your story starts here'} body={items.length ? 'Try another name or view all payments.' : 'Your payments appear here as soon as they settle.'} action={items.length ? <Button title="Clear filters" variant="ghost" onPress={() => { setQuery(''); setFilter('all'); }} /> : <Button title="Request your first payment" variant="ghost" onPress={() => router.push('/receive')} />} /> : filtered.map((i) => <ActivityRow key={i.id} item={i} network={network} />)}
      </Card>
      {filtered.length > 0 ? <View style={{ alignItems: 'center', gap: spacing.sm }}><Text style={type.small}>{filtered.length} payment{filtered.length === 1 ? '' : 's'} · Long press a payment for its receipt</Text><Button title="Refresh activity" icon="refresh-outline" variant="ghost" onPress={refresh} loading={syncing} /></View> : null}
    </Screen>
  );
}
