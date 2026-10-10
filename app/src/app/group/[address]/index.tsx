import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Address } from 'viem';
import { formatUsdc, shortAddress } from '@/lib/format';
import { suggestSettlements, type GroupHistoryItem } from '@/lib/groups';
import { addressUrl, txUrl, type NetworkId } from '@/lib/networks';
import { useContacts } from '@/state/contacts';
import { useGroup } from '@/state/useGroup';
import { useReadyWallet } from '@/state/wallet';
import { ActionButton, Avatar, Banner, Button, Card, Empty, ListRow, Screen, Segmented, PageIntro } from '@/ui/components';
import { GradientPanel } from '@/ui/Atmosphere';
import { Pulse } from '@/ui/motion';
import { spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

type Tab = 'activity' | 'balances';

export default function GroupScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  const { address: param } = useLocalSearchParams<{ address: string }>();
  const { network } = useReadyWallet();
  const { label } = useContacts();
  const { address, detail, history, loading, error, refresh, me } = useGroup(param, { withHistory: true });
  const [tab, setTab] = useState<Tab>('activity');

  if (!address) return <Screen><Banner tone="error">Invalid group address.</Banner></Screen>;
  if (!detail) {
    return (
      <Screen refreshing={loading} onRefresh={refresh}>
        {error ? <Banner tone="error">{error}</Banner> : <Pulse><Empty icon="people-outline" title="Opening your group…" body="Getting the latest balance and members." /></Pulse>}
      </Screen>
    );
  }

  const isMember = detail.members.some((m) => m.address.toLowerCase() === me.toLowerCase());
  const settlements = suggestSettlements(detail.members);
  const mine = settlements.filter((s) => s.from.toLowerCase() === me.toLowerCase() || s.to.toLowerCase() === me.toLowerCase());
  const go = (path: 'deposit' | 'expense' | 'settle' | 'members', params: Record<string, string> = {}) =>
    router.push({ pathname: `/group/[address]/${path}`, params: { address, ...params } });

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Stack.Screen options={{ title: detail.name }} />
      <PageIntro eyebrow="Shared wallet" title={detail.name} body={`${detail.members.length} members · ${detail.isAdmin ? 'You’re an admin' : 'Made for sharing'}`} />
      <GradientPanel style={styles.balance}>
        <Text style={type.muted}>Group wallet</Text>
        <Text style={type.hero}>${formatUsdc(detail.balance)}</Text>
        <Text style={type.small} onPress={() => Linking.openURL(addressUrl(network, address))}>
          {shortAddress(address)} · {detail.members.length} members ↗
        </Text>
      </GradientPanel>

      {!isMember ? <Banner tone="warning">You’re not a member of this group.</Banner> : null}

      {isMember ? <View style={styles.actions}>
        <ActionButton icon="add-circle-outline" label="Add money" onPress={() => go('deposit')} />
        <ActionButton
          icon="arrow-up"
          label="Pay"
          onPress={() => router.push({ pathname: '/pay', params: { from: address } })}
        />
        <ActionButton icon="receipt-outline" label="Expense" onPress={() => go('expense')} />
        <ActionButton icon="person-add-outline" label="Members" onPress={() => go('members')} />
      </View> : <Button title="View members" variant="secondary" onPress={() => go('members')} />}
      {detail.memberSpendLimit > 0n ? (
        <Text style={[type.small, { textAlign: 'center', marginBottom: spacing.sm }]}>
          Members can pay up to ${formatUsdc(detail.memberSpendLimit)} per payment{detail.isAdmin ? ' (you’re an admin: no limit)' : ''}.
        </Text>
      ) : null}

      {mine.length > 0 ? (
        <Card>
          <Text style={[type.heading, { marginBottom: spacing.sm }]}>Your splits</Text>
          {mine.map((s) =>
            s.from.toLowerCase() === me.toLowerCase() ? (
              <ListRow
                key={`${s.from}-${s.to}`}
                left={<Avatar address={s.to} name={label(s.to)} />}
                title={`You owe ${label(s.to)}`}
                right={<Text style={{ color: colors.negative, fontWeight: '700' }}>${formatUsdc(s.amount)}</Text>}
                rightSub="Settle →"
                onPress={() => go('settle', { creditor: s.to, amount: s.amount.toString() })}
              />
            ) : (
              <ListRow
                key={`${s.from}-${s.to}`}
                left={<Avatar address={s.from} name={label(s.from)} />}
                title={`${label(s.from)} owes you`}
                right={<Text style={{ color: colors.positive, fontWeight: '700' }}>${formatUsdc(s.amount)}</Text>}
                rightSub="Paid in cash? →"
                onPress={() => go('settle', { debtor: s.from, amount: s.amount.toString() })}
              />
            ),
          )}
        </Card>
      ) : null}

      <Segmented<Tab>
        options={[
          { value: 'activity', label: 'Activity' },
          { value: 'balances', label: 'Balances' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'activity' ? (
        <Card style={{ paddingVertical: spacing.xs }}>
          {history.length === 0 ? (
            <Empty icon="time-outline" title="No activity yet" body="Add money or record an expense to get started." />
          ) : (
            history.map((h) => <HistoryRow key={`${h.txHash}-${h.logIndex}`} item={h} network={network} label={label} />)
          )}
        </Card>
      ) : (
        <Card style={{ paddingVertical: spacing.xs }}>
          {detail.members.map((m) => (
            <ListRow
              key={m.address}
              left={<Avatar address={m.address} name={label(m.address)} />}
              title={`${label(m.address)}${m.admin ? ' · admin' : ''}`}
              subtitle={`Put in $${formatUsdc(m.contributed)} · spent $${formatUsdc(m.spent)}`}
              right={
                <Text style={{ color: m.net > 0n ? colors.positive : m.net < 0n ? colors.negative : colors.textMuted, fontWeight: '700' }}>
                  {m.net === 0n ? 'settled' : `${m.net > 0n ? '+' : '−'}$${formatUsdc(m.net > 0n ? m.net : -m.net)}`}
                </Text>
              }
              rightSub={m.net > 0n ? 'is owed' : m.net < 0n ? 'owes' : undefined}
            />
          ))}
          {settlements.length > 0 ? (
            <Text style={[type.small, { paddingVertical: spacing.sm }]}>
              Simplest way to settle: {settlements.map((s) => `${label(s.from)} → ${label(s.to)} $${formatUsdc(s.amount)}`).join(', ')}
            </Text>
          ) : null}
        </Card>
      )}
      <Button title="Refresh" variant="ghost" icon="refresh" onPress={refresh} />
    </Screen>
  );
}

function HistoryRow({ item, network, label }: { item: GroupHistoryItem; network: NetworkId; label: (a: Address) => string }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const open = () => Linking.openURL(txUrl(network, item.txHash));
  const icon = (name: React.ComponentProps<typeof Ionicons>['name'], color = colors.textMuted) => (
    <View style={styles.histIcon}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
  switch (item.kind) {
    case 'deposit':
      return (
        <ListRow left={icon('add', colors.positive)} title={`${label(item.member)} added money`} subtitle={item.note || undefined}
          right={<Text style={{ color: colors.positive, fontWeight: '700' }}>+${formatUsdc(item.amount)}</Text>} onPress={open} />
      );
    case 'pay':
      return (
        <ListRow left={icon('arrow-up')} title={`${label(item.member)} paid ${label(item.to)}`} subtitle={item.note || undefined}
          right={`−$${formatUsdc(item.amount)}`} onPress={open} />
      );
    case 'expense':
      return (
        <ListRow left={icon('receipt-outline', colors.accent)} title={`${label(item.paidBy)} paid $${formatUsdc(item.amount)}`}
          subtitle={`${item.note ? `${item.note} · ` : ''}split ${item.participants.length} ways`} right="split" onPress={open} />
      );
    case 'settle':
      return (
        <ListRow left={icon('swap-horizontal', colors.positive)} title={`${label(item.debtor)} settled with ${label(item.creditor)}`}
          subtitle={`${item.offchain ? 'Marked paid outside Arclet' : 'Paid in USDC'}${item.note ? ` · ${item.note}` : ''}`}
          right={`$${formatUsdc(item.amount)}`} onPress={open} />
      );
    case 'member':
      return <ListRow left={icon(item.added ? 'person-add-outline' : 'person-remove-outline')} title={`${label(item.member)} ${item.added ? 'joined' : 'left'}`} onPress={open} />;
    case 'admin':
      return <ListRow left={icon('shield-outline')} title={`${label(item.member)} ${item.isAdmin ? 'is now an admin' : 'is no longer an admin'}`} onPress={open} />;
    case 'limit':
      return <ListRow left={icon('speedometer-outline')} title={item.limit === 0n ? 'Member limit removed' : `Member limit set to $${formatUsdc(item.limit)}`} onPress={open} />;
  }
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  balance: { alignItems: 'center', paddingVertical: spacing.lg, gap: 6, marginBottom: spacing.md, borderColor: colors.orbital },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: spacing.md },
  histIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
