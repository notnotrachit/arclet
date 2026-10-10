import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { confirmWithBiometrics } from '@/lib/auth';
import { isInsecureStorage, loadMnemonic } from '@/lib/keystore';
import { Banner, Button, Screen } from '@/ui/components';
import { colors, radius, spacing, type } from '@/ui/theme';

export default function Backup() {
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const [words, setWords] = useState<string[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      // Freshly created wallets show the phrase right away; otherwise require the device owner.
      if (!fresh && !(await confirmWithBiometrics('Show recovery phrase'))) return router.back();
      const m = await loadMnemonic();
      if (m) setWords(m.split(' '));
      else setMissing(true);
    })();
  }, [fresh]);

  return (
    <Screen
      footer={
        fresh ? <Button title="I’ve saved it" onPress={() => router.replace('/')} /> : undefined
      }>
      <Banner tone="warning">
        Write these words down in order and keep them offline. They are the only way to restore this wallet.
      </Banner>
      {isInsecureStorage ? (
        <Banner tone="error">Web demo: keys are kept in browser storage. Don’t hold real funds here.</Banner>
      ) : null}
      {missing ? (
        <Text style={type.muted}>This wallet was imported from a private key, so there is no recovery phrase.</Text>
      ) : (
        <View style={styles.grid}>
          {(words ?? Array(12).fill('•••')).map((w, i) => (
            <View key={i} style={styles.word}>
              <Text style={styles.index}>{i + 1}</Text>
              <Text style={styles.text} selectable>
                {w}
              </Text>
            </View>
          ))}
        </View>
      )}
      {words ? (
        <Button
          title="Copy to clipboard"
          variant="ghost"
          icon="copy-outline"
          onPress={() => Clipboard.setStringAsync(words.join(' '))}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  word: {
    width: '31%',
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
