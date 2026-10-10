import { Brand } from '@/ui/Brand';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatUsdc, shortAddress } from '@/lib/format';
import { canReadNfc } from '@/lib/nfc';
import { NETWORKS } from '@/lib/networks';
import { useActivity } from '@/state/activity';
import { useGroups } from '@/state/groups';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { ActivityRow } from '@/ui/ActivityRow';
import { ActionButton, Banner, Button, Card, Empty, ListRow, Pill, Screen, SectionTitle } from '@/ui/components';
import { GradientPanel } from '@/ui/Atmosphere';
import { Reveal, Touch } from '@/ui/motion';
import { radius, spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

export default function Home() {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  const { address, balance, balanceError, network, refreshBalance } = useReadyWallet();
  const { items, refresh } = useActivity();
  const { groups, refresh: refreshGroups } = useGroups();
  const toast = useToast();
  const [nfc, setNfc] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { canReadNfc().then(setNfc).catch(() => {}); }, []);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshBalance(), refresh(), refreshGroups()]); }
    finally { setRefreshing(false); }
  };

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <View style={styles.brand}><Brand /></View>
        <Touch accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} style={styles.settings}><Ionicons name="options-outline" size={22} color={colors.text} /></Touch>
      </View>

      <Reveal delay={60}>
        <GradientPanel style={styles.balanceCard}>
          <View style={styles.balanceTop}><Text style={styles.eyebrow}>YOUR BALANCE</Text><Pill text={NETWORKS[network].label} tone={network === 'mainnet' ? 'positive' : 'accent'} /></View>
          <View style={styles.balanceRow}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[type.hero, styles.balanceAmount]} accessibilityLabel={hidden ? 'Balance hidden' : `Balance ${balance === null ? 'loading' : formatUsdc(balance)} USDC`}>
              {hidden ? '••••' : `$${balance === null ? '—' : formatUsdc(balance)}`}
            </Text>
            <Touch accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'} onPress={() => setHidden(!hidden)} style={styles.eye}><Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} /></Touch>
          </View>
          <Text style={type.muted}>USDC · digital dollars on Arc</Text>
          <View style={styles.balanceBottom}>
            <Touch accessibilityRole="button" accessibilityLabel="Copy wallet address" onPress={async () => { await Clipboard.setStringAsync(address); toast({ title: 'Address copied', tone: 'info' }); }} style={styles.addressChip}><Text style={type.mono}>{shortAddress(address)}</Text><Ionicons name="copy-outline" size={14} color={colors.textMuted} /></Touch>
          </View>
        </GradientPanel>
      </Reveal>

      <Reveal delay={120}><View style={styles.actions}>
        <ActionButton icon="arrow-up-outline" label="Send" onPress={() => router.push('/pay')} />
        <ActionButton icon="arrow-down-outline" label="Request" onPress={() => router.push('/receive')} />
        <ActionButton icon="qr-code-outline" label="Scan" onPress={() => router.push('/scan')} />
        {nfc ? <ActionButton icon="radio-outline" label="Tap" onPress={() => router.push('/tap')} /> : null}
      </View></Reveal>

      {balanceError ? <Banner tone="warning">{balanceError} <Text style={{ color: colors.accent, fontWeight: '600' }} onPress={onRefresh}>Retry</Text></Banner> : null}
      {balance === 0n ? <Card style={styles.startCard}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Ionicons name="sparkles-outline" size={20} color={colors.accent} /><Text style={type.heading}>Your first dollars, your first payment.</Text></View>
        <Text style={[type.muted, { marginVertical: spacing.sm }]}>{network === 'testnet' ? 'Try Arclet with free test USDC. Choose Arc Testnet at the faucet and paste your wallet address.' : 'Receive USDC on Arc to start sending and splitting.'}</Text>
        <Button title={network === 'testnet' ? 'Get free test USDC' : 'Receive USDC'} icon={network === 'testnet' ? 'open-outline' : 'arrow-down-outline'} variant="secondary" onPress={() => network === 'testnet' ? Linking.openURL('https://faucet.circle.com') : router.push('/receive')} />
      </Card> : null}

      {groups.length > 0 ? <>
        <SectionTitle right={<Button title="See all" variant="ghost" onPress={() => router.push('/groups')} style={styles.link} />}>Shared wallets</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>{groups.slice(0, 3).map((g) => <ListRow key={g.address} left={<View style={styles.groupIcon}><Ionicons name="people" size={18} color={colors.accent} /></View>} title={g.name} subtitle={`${g.memberCount} members`} right={`$${formatUsdc(g.balance)}`} rightSub={g.myNet === 0n ? undefined : g.myNet > 0n ? `owed $${formatUsdc(g.myNet)}` : `you owe $${formatUsdc(-g.myNet)}`} onPress={() => router.push({ pathname: '/group/[address]', params: { address: g.address } })} />)}</Card>
      </> : null}

      <SectionTitle right={<Button title="See all" variant="ghost" onPress={() => router.push('/activity')} style={styles.link} />}>Recent activity</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        {items.length === 0 ? <Empty icon="swap-horizontal-outline" title="Your money, on the move" body="Sent and received payments will appear here. Start by sharing your payment QR." action={<Button title="Request a payment" variant="ghost" icon="arrow-down-outline" onPress={() => router.push('/receive')} />} /> : items.slice(0, 5).map((i) => <ActivityRow key={i.id} item={i} network={network} />)}
      </Card>
      <View style={styles.footerNote}><Ionicons name="flash-outline" size={14} color={colors.textFaint} /><Text style={type.small}>Payments settle on Arc in under a second</Text></View>
    </Screen>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settings: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  balanceCard: { borderColor: colors.orbital, borderWidth: 1, borderRadius: 28, padding: spacing.lg, overflow: 'hidden' },
  balanceTop: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  balanceAmount: { fontSize: 54, flex: 1, fontVariant: ['tabular-nums'] },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  balanceBottom: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.orbital, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between' },
  addressChip: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  startCard: { backgroundColor: colors.surface, marginTop: spacing.sm },
  link: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8 },
  groupIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  footerNote: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
});
