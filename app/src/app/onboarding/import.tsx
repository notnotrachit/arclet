import { useState } from 'react';
import { router } from 'expo-router';
import { useWallet } from '@/state/wallet';
import { Banner, Button, Field, PageIntro, Screen } from '@/ui/components';

export default function ImportWallet() {
  const { importFrom } = useWallet();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const onImport = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await importFrom(input);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={<Button title="Restore my wallet" loadingTitle="Restoring wallet…" onPress={onImport} loading={busy} disabled={!input.trim()} />}>
      <PageIntro eyebrow="Welcome back" title="Bring your wallet along." body="Enter your recovery phrase or private key. Your wallet will be restored on this device." />
      <Banner tone="warning">Only import a wallet you control. Anyone with this phrase can move your funds.</Banner>
      <Field
        label="Recovery phrase or private key"
        placeholder="12 or 24 words separated by spaces, or 0x…"
        value={input}
        onChangeText={setInput}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={false}
        error={error}
      />
    </Screen>
  );
}
