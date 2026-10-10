import { Alert, Linking, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { confirmWithBiometrics } from '@/lib/auth';
import { addressUrl, type NetworkId } from '@/lib/networks';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { Button, Card, ListRow, Screen, SectionTitle, Segmented, PageIntro } from '@/ui/components';
import { AppearancePicker } from '@/ui/AppearancePicker';
import { spacing, useTheme } from '@/ui/theme';

export default function Settings() {
  const { type } = useTheme();
  const { address, network, setNetwork, reset } = useReadyWallet();
  const toast = useToast();

  const onReset = () => {
    const doReset = async () => {
      if (!(await confirmWithBiometrics('Remove wallet from this phone'))) return;
      await reset();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Remove this wallet? You need your recovery phrase to restore it.')) doReset();
      return;
    }
    Alert.alert('Remove wallet?', 'You will need your recovery phrase to restore it. Funds stay onchain.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doReset },
    ]);
  };

  return (
    <Screen edges={[]}>
      <PageIntro eyebrow="Make it yours" title="Your wallet, your way." body="Choose your appearance, network, and wallet preferences." />
      <SectionTitle>Appearance</SectionTitle>
      <AppearancePicker />
      <SectionTitle>Network</SectionTitle>
      <Segmented<NetworkId>
        options={[
          { value: 'testnet', label: 'Arc Testnet' },
          { value: 'mainnet', label: 'Arc Mainnet' },
        ]}
        value={network}
        onChange={setNetwork}
      />

      <SectionTitle>Wallet</SectionTitle>
      <Card>
        <Text style={type.mono} selectable>
          {address}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            title="Copy"
            variant="secondary"
            icon="copy-outline"
            style={{ flex: 1 }}
            onPress={async () => {
              await Clipboard.setStringAsync(address);
              toast({ title: 'Address copied', tone: 'info' });
            }}
          />
          <Button
            title="Explorer"
            variant="secondary"
            icon="open-outline"
            style={{ flex: 1 }}
            onPress={() => Linking.openURL(addressUrl(network, address))}
          />
        </View>
      </Card>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow title="Show recovery phrase" subtitle="Keep a safe copy · requires device authentication" onPress={() => router.push('/backup')} />
        {network === 'testnet' ? (
          <ListRow
            title="Get testnet USDC"
            subtitle="faucet.circle.com → Arc Testnet"
            onPress={() => Linking.openURL('https://faucet.circle.com')}
          />
        ) : null}
      </Card>

      <SectionTitle>Remove wallet</SectionTitle>
      <Text style={[type.muted, { marginBottom: spacing.md }]}>Save your recovery phrase first. You’ll need it to restore this wallet.</Text>
      <Button title="Remove wallet from this phone" variant="danger" onPress={onReset} />
      <Text style={[type.small, { marginTop: spacing.lg, textAlign: 'center' }]}>
        Arclet · self-custodial · unaudited hackathon software
      </Text>
    </Screen>
  );
}
