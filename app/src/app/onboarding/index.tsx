import { Brand } from '@/ui/Brand';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWallet } from '@/state/wallet';
import { Banner, Button, Screen } from '@/ui/components';
import { GradientPanel } from '@/ui/Atmosphere';
import { Reveal } from '@/ui/motion';
import { spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

export default function Welcome() {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  const { create } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const onCreate = async () => {
    if (busy) return;
    setBusy(true); setError(undefined);
    try { await create(); router.replace({ pathname: '/backup', params: { fresh: '1' } }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };
  return (
    <Screen edges={['top', 'bottom']} footer={<>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button title="Create a wallet" icon="arrow-forward" onPress={onCreate} loading={busy} loadingTitle="Creating your wallet…" />
      <Button title="I already have a wallet" variant="ghost" onPress={() => router.push('/onboarding/import')} disabled={busy} style={{ marginTop: spacing.sm }} />
      <Text style={[type.small, { textAlign: 'center', marginTop: spacing.sm }]}>Your keys stay on this device. Save your recovery phrase.</Text>
    </>}>
      <View style={styles.brand}><Brand /><Text style={styles.tag}>MADE FOR SHARING</Text></View>
      <Reveal delay={70}><View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.ring} /><View style={[styles.ring, styles.innerRing]} />
        <GradientPanel style={styles.moneyCard}><Text style={styles.cardLabel}>A LITTLE LESS COMPLICATED.</Text><Text style={styles.dollars}>$24.00</Text><View style={styles.sent}><Ionicons name="checkmark-circle" size={18} color={colors.accent} /><Text style={[type.small, { color: colors.accent }]}>Dinner, sorted.</Text></View></GradientPanel>
        <View style={styles.floatChip}><Ionicons name="people-outline" size={17} color={colors.onAccent} /><Text style={styles.floatLabel}>Better together</Text></View>
      </View></Reveal>
      <Reveal delay={130}><Text style={[type.hero, styles.headline]}>Money moves.{'\n'}Life happens.</Text><Text style={[type.muted, styles.tagline]}>Send dollars, split dinner, and share a wallet with your people. All in a few taps.</Text></Reveal>
      <View style={styles.points}>{[
        ['flash-outline', 'Send in seconds', 'USDC payments that settle on Arc.'],
        ['people-outline', 'Share the good stuff', 'Group wallets and easy expense splits.'],
        ['finger-print-outline', 'You’re in control', 'Your wallet. Your keys. Your money.'],
      ].map(([icon, title, body], i) => <Reveal delay={180 + i * 50} key={title}><View style={styles.point}><View style={styles.pointIcon}><Ionicons name={icon as never} size={21} color={colors.accent} /></View><View style={{ flex: 1 }}><Text style={type.heading}>{title}</Text><Text style={type.small}>{body}</Text></View></View></Reveal>)}</View>
    </Screen>
  );
}
const createStyles = ({ colors, type }: Theme) => StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  tag: { ...type.small, fontSize: 9, letterSpacing: 1.3, marginLeft: 'auto' },
  art: { height: 240, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  ring: { position: 'absolute', width: 235, height: 235, borderRadius: 120, borderWidth: 1, borderColor: colors.orbital },
  innerRing: { width: 185, height: 185, borderRadius: 95 },
  moneyCard: { width: 240, borderWidth: 1, borderColor: colors.orbital, borderRadius: 25, padding: 24, transform: [{ rotate: '-7deg' }] },
  cardLabel: { color: colors.accent, fontSize: 8, fontWeight: '700', letterSpacing: 1.4 },
  dollars: { ...type.hero, marginTop: 12, marginBottom: 16 },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floatChip: { position: 'absolute', bottom: 20, right: 8, backgroundColor: colors.button, flexDirection: 'row', gap: 7, borderRadius: 18, padding: 14, transform: [{ rotate: '5deg' }] },
  floatLabel: { color: colors.onAccent, fontWeight: '600', fontSize: 13 },
  headline: { fontSize: 42, fontWeight: '400', lineHeight: 49, marginTop: spacing.md },
  tagline: { marginTop: spacing.md, fontSize: 16, lineHeight: 24, maxWidth: 370 },
  points: { marginTop: spacing.lg, gap: spacing.md },
  point: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pointIcon: { width: 44, height: 44, backgroundColor: colors.surface, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
