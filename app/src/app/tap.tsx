import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { cancelNfcRead, canReadNfc, isNfcOn, openNfcSettings, readPaymentTag } from '@/lib/nfc';
import { parsePaymentUri } from '@/lib/payments';
import { openPayRequest } from '@/lib/routing';
import { Button, Screen } from '@/ui/components';
import { Pulse } from '@/ui/motion';
import { spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

type State = 'checking' | 'unsupported' | 'off' | 'scanning' | 'error';

export default function Tap() {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  const [state, setState] = useState<State>('checking');
  const [error, setError] = useState<string>();
  const active = useRef(true);

  const scan = useCallback(async () => {
    const supported = await canReadNfc();
    setError(undefined);
    if (!supported) return setState('unsupported');
    if (!(await isNfcOn())) return setState('off');
    setState('scanning');
    try {
      const raw = await readPaymentTag();
      const req = parsePaymentUri(raw);
      if (!req) throw new Error('That tag isn’t an Arclet payment request.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      openPayRequest(req, { replace: true });
    } catch (e) {
      if (!active.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      // Cancelling (closing the iOS sheet / leaving the screen) isn't an error worth showing.
      if (/cancel/i.test(msg) || msg === '') return router.back();
      setError(msg);
      setState('error');
    }
  }, []);

  useEffect(() => {
    active.current = true;
    // scan() awaits the NFC capability check before touching state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    scan();
    return () => {
      active.current = false;
      cancelNfcRead();
    };
  }, [scan]);

  return (
    <Screen
      scroll={false}
      footer={
        state === 'unsupported' ? (
          <Button title="Scan a QR instead" icon="qr-code-outline" onPress={() => router.replace('/scan')} />
        ) : state === 'off' ? (
          <Button title="Open NFC settings" onPress={openNfcSettings} />
        ) : state === 'error' ? (
          <Button title="Try again" onPress={scan} />
        ) : (
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        )
      }>
      <View style={styles.center}>
        <Pulse active={state === 'scanning'} style={styles.pulse}>
          <Ionicons name="radio-outline" size={64} color={colors.accent} />
        </Pulse>
        <Text style={[type.title, { marginTop: spacing.lg }]}>
          {state === 'unsupported' ? 'NFC not available' : state === 'off' ? 'NFC is off' : state === 'error' ? 'Let’s try that again' : state === 'checking' ? 'Checking NFC…' : 'Bring phones together'}
        </Text>
        <Text style={[type.muted, styles.text]}>
          {state === 'unsupported'
            ? 'This phone has no NFC reader. Scan their QR code instead.'
            : state === 'off'
              ? 'Turn on NFC, then come back.'
              : state === 'error'
                ? error
                : Platform.OS === 'ios'
                  ? 'Hold the top of your iPhone near the receiver’s Android phone showing an Arclet request.'
                  : 'Hold the back of your phone against the receiver’s phone showing an Arclet request.'}
        </Text>
      </View>
    </Screen>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg },
});
