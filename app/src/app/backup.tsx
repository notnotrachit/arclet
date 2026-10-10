import { useCallback, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/state/toast';
import { confirmRecoveryReveal } from '@/lib/auth';
import { isInsecureStorage, loadMnemonic } from '@/lib/keystore';
import { Banner, Button, PageIntro, Screen } from '@/ui/components';
import { radius, spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

export default function Backup() {
  const styles = useThemeStyles(createStyles);
  const { type } = useTheme();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const [words, setWords] = useState<string[] | null>(null);
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState(false);

  const [authError, setAuthError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const focused = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);

  const lock = useCallback(() => {
    generation.current++;
    setWords(null);
    setSaved(false);
    setMissing(false);
  }, []);

  const reveal = useCallback(async () => {
    if (pending.current || !focused.current) return;
    pending.current = true;
    setVerifying(true);
    setAuthError(undefined);
    lock();
    const request = generation.current;
    try {
      if (!(await confirmRecoveryReveal())) return;
      if (!focused.current || request !== generation.current) return;
      const mnemonic = await loadMnemonic();
      if (!focused.current || request !== generation.current || AppState.currentState === 'background') return;
      if (mnemonic) setWords(mnemonic.split(' '));
      else setMissing(true);
    } catch (error) {
      if (focused.current && request === generation.current) {
        setAuthError(error instanceof Error ? error.message : 'Couldn’t verify your identity. Please try again.');
      }
    } finally {
      pending.current = false;
      setVerifying(false);
    }
  }, [lock]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setForeground(AppState.currentState !== 'background');
    void reveal();
    const stateSubscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      // iOS may become inactive while its biometric sheet is open.
      if (state === 'background' || (state === 'inactive' && !pending.current)) lock();
    });
    const blurSubscription = Platform.OS === 'android'
      ? AppState.addEventListener('blur', () => { if (!pending.current) lock(); })
      : undefined;
    return () => {
      focused.current = false;
      lock();
      stateSubscription.remove();
      blurSubscription?.remove();
    };
  }, [lock, reveal]));

  const visibleWords = foreground ? words : null;

  return (
    <Screen
      footer={
        fresh ? <Button title="Continue to my wallet" onPress={() => router.replace('/')} disabled={!saved || !visibleWords} /> : undefined
      }>
      <PageIntro eyebrow="Keep it safe" title="Your wallet’s spare key." body="Write down each word in order. Store the list somewhere only you can access." />
      <Banner tone="warning">
        Write these words down in order and keep them offline. They are the only way to restore this wallet.
      </Banner>
      {isInsecureStorage ? (
        <Banner tone="error">Web demo: keys are kept in browser storage. Don’t hold real funds here.</Banner>
      ) : null}
      {authError ? <Banner tone="error">{authError}</Banner> : null}
      {!visibleWords && !missing ? <View style={{ marginVertical: spacing.md }}>
        <Button title="Reveal recovery phrase" icon="finger-print-outline" onPress={reveal} loading={verifying} loadingTitle="Verifying your identity…" />
        <Text style={[type.small, { textAlign: 'center', marginTop: spacing.sm }]}>A fresh biometric confirmation is required every time.</Text>
      </View> : null}
      {missing ? (
        <Text style={type.muted}>This wallet was imported from a private key, so there is no recovery phrase.</Text>
      ) : (
        <View style={styles.grid}>
          {(visibleWords ?? Array(12).fill('•••')).map((w, i) => (
            <View key={i} style={styles.word}>
              <Text style={styles.index}>{i + 1}</Text>
              <Text style={styles.text} selectable>
                {w}
              </Text>
            </View>
          ))}
        </View>
      )}
      {fresh && visibleWords ? <Button title={saved ? '✓ I have saved my recovery phrase' : 'I have saved my recovery phrase'} variant="secondary" onPress={() => setSaved(!saved)} style={{ marginTop: spacing.md }} /> : null}
      {visibleWords ? <Button title="Hide recovery phrase" variant="secondary" icon="eye-off-outline" onPress={lock} style={{ marginTop: spacing.md }} /> : null}
      {visibleWords ? (
        <Button
          title="Copy to clipboard"
          variant="ghost"
          icon="copy-outline"
          onPress={async () => { await Clipboard.setStringAsync(visibleWords.join(' ')); toast({ title: 'Recovery phrase copied', body: 'Store it safely and clear your clipboard when finished.', tone: 'info' }); }}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </Screen>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  word: {
    flexBasis: '30%', flexGrow: 1, minWidth: 95,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  index: { color: colors.textFaint, width: 22, fontSize: 12 },
  text: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
