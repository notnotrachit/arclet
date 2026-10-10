import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatUsdc, shortAddress } from '@/lib/format';
import { canBroadcastNfc, canReadNfc } from '@/lib/nfc';
import { NETWORKS } from '@/lib/networks';
import { useActivity } from '@/state/activity';
import { useGroups } from '@/state/groups';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { ActivityRow } from '@/ui/ActivityRow';
import { ActionButton, Card, Empty, ListRow, Pill, Screen, SectionTitle } from '@/ui/components';
import { colors, radius, spacing, type } from '@/ui/theme';

export default function Home() {
  const { address, balance, network, refreshBalance } = useReadyWallet();
  const { items, refresh, syncing } = useActivity();
  const { groups, refresh: refreshGroups } = useGroups();
  const toast = useToast();
  const [nfc, setNfc] = useState(false);

  useEffect(() => {
    canReadNfc().then(setNfc);
  }, []);

  const onRefresh = () => {
    refreshBalance();
    refresh();
    refreshGroups();
  };

  return (
    <Screen edges={['top']} refreshing={syncing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy wallet address"
          onPress={async () => {
            await Clipboard.setStringAsync(address);
            toast({ title: 'Address copied', tone: 'info' });
          }}
          style={styles.addressChip}>
          <Text style={type.mono}>{shortAddress(address)}</Text>
          <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
        </Pressable>
        <Pill text={NETWORKS[network].label} tone={network === 'mainnet' ? 'positive' : 'accent'} />
      </View>

      <View style={styles.balance}>
        <Text style={type.muted}>Balance</Text>
        <Text style={type.hero} accessibilityLabel={`Balance ${balance === null ? 'loading' : formatUsdc(balance)} USDC`}>
          ${balance === null ? '—' : formatUsdc(balance)}
        </Text>
        <Text style={type.small}>USDC on Arc · also pays your network fees</Text>
      </View>

      <View style={styles.actions}>
        <ActionButton icon="arrow-up" label="Send" onPress={() => router.push('/pay')} />
        <ActionButton icon="arrow-down" label="Request" onPress={() => router.push('/receive')} />
        <ActionButton icon="qr-code-outline" label="Scan" onPress={() => router.push('/scan')} />
        {nfc ? <ActionButton icon="radio-outline" label="Tap" onPress={() => router.push('/tap')} /> : null}
      </View>
      {nfc && canBroadcastNfc() ? (
        <Text style={[type.small, { textAlign: 'center', marginBottom: spacing.sm }]}>
          To pay, just hold your unlocked phone to someone’s Arclet Request screen. Arclet opens by itself.
        </Text>
      ) : null}

      {groups.length > 0 ? (
        <>
          <SectionTitle
            right={
              <Text style={styles.link} onPress={() => router.push('/groups')}>
                See all
              </Text>
            }>
            Groups
          </SectionTitle>
          <Card style={{ paddingVertical: spacing.xs }}>
            {groups.slice(0, 3).map((g) => (
              <ListRow
                key={g.address}
                left={
                  <View style={styles.groupIcon}>
                    <Ionicons name="people" size={18} color={colors.accent} />
                  </View>
                }
                title={g.name}
                subtitle={`${g.memberCount} members`}
                right={`$${formatUsdc(g.balance)}`}
                rightSub={g.myNet === 0n ? undefined : g.myNet > 0n ? `owed $${formatUsdc(g.myNet)}` : `you owe $${formatUsdc(-g.myNet)}`}
                onPress={() => router.push({ pathname: '/group/[address]', params: { address: g.address } })}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle
        right={
          <Text style={styles.link} onPress={() => router.push('/activity')}>
            See all
          </Text>
        }>
        Recent activity
      </SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        {items.length === 0 ? (
          <Empty
            icon="sparkles-outline"
            title="No payments yet"
            body={
              network === 'testnet'
                ? 'Get free testnet USDC at faucet.circle.com (choose Arc Testnet), then send it to your address.'
                : 'Send USDC on Arc to your address to get started.'
            }
          />
        ) : (
          items.slice(0, 5).map((i) => <ActivityRow key={i.id} item={i} network={network} />)
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  addressChip: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  balance: { alignItems: 'center', marginVertical: spacing.xl, gap: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: spacing.md },
  link: { color: colors.accent, fontWeight: '600' },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
