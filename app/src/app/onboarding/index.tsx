import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWallet } from '@/state/wallet';
import { Button, Screen } from '@/ui/components';
import { colors, spacing, type } from '@/ui/theme';

export default function Welcome() {
  const { create } = useWallet();
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      await create();
      router.replace({ pathname: '/backup', params: { fresh: '1' } });
    } catch (e) {
      Alert.alert('Could not create wallet', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="radio-outline" size={44} color={colors.onAccent} />
        </View>
        <Text style={[type.hero, { marginTop: spacing.lg }]}>Arclet</Text>
        <Text style={[type.muted, styles.tagline]}>
          Tap, scan, and split dollars with friends. Payments settle on Arc in under a second, and gas is paid in USDC.
        </Text>
        <View style={styles.points}>
          {[
            ['flash-outline', 'Instant, final USDC payments'],
            ['phone-portrait-outline', 'Tap phones (NFC) or scan a QR'],
            ['people-outline', 'Group wallets and expense splits'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.point}>
              <Ionicons name={icon as never} size={20} color={colors.accent} />
              <Text style={[type.body, { marginLeft: spacing.sm }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
      <Button title="Create a new wallet" onPress={onCreate} loading={busy} />
      <Button
        title="I already have a wallet"
        variant="ghost"
        onPress={() => router.push('/onboarding/import')}
        disabled={busy}
        style={{ marginTop: spacing.sm }}
      />
      <Text style={[type.small, { textAlign: 'center', marginTop: spacing.md }]}>
        Your keys stay on this phone. Arclet has no servers and can’t recover your wallet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center' },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: { marginTop: spacing.sm, fontSize: 16, lineHeight: 22 },
  points: { marginTop: spacing.xl, gap: spacing.md },
  point: { flexDirection: 'row', alignItems: 'center' },
});
