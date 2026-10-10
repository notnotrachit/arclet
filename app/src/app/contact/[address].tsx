import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAddress, isAddress } from 'viem';
import { formatUsdc, shortAddress } from '@/lib/format';
import { addressUrl } from '@/lib/networks';
import { useActivity } from '@/state/activity';
import { useContacts } from '@/state/contacts';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { ActivityRow } from '@/ui/ActivityRow';
import { Avatar, Banner, Button, Card, Empty, Screen, SectionTitle } from '@/ui/components';
import { colors, radius, spacing, type } from '@/ui/theme';

export default function ContactDetail() {
  const { address: param } = useLocalSearchParams<{ address: string }>();
  const { network } = useReadyWallet();
  const { nameOf, remove } = useContacts();
  const { items } = useActivity();
  const toast = useToast();

  if (!param || !isAddress(param)) return <Screen><Banner tone="error">Invalid address.</Banner></Screen>;
  const address = getAddress(param);
  const name = nameOf(address);
  const history = items.filter((i) => i.counterparty.toLowerCase() === address.toLowerCase());
  const sent = history.filter((i) => i.direction === 'out').reduce((s, i) => s + i.amount, 0n);
  const received = history.filter((i) => i.direction === 'in').reduce((s, i) => s + i.amount, 0n);

  const onDelete = () => {
    const doIt = async () => {
      await remove(address);
      toast({ title: `${name ?? 'Contact'} removed`, tone: 'info' });
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Remove ${name}?`)) doIt();
      return;
    }
    Alert.alert(`Remove ${name}?`, 'Their address will show instead of their name.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: name ?? 'Contact' }} />
      <View style={styles.header}>
        <Avatar address={address} name={name} size={72} />
        <Text style={[type.title, { marginTop: spacing.sm }]}>{name ?? shortAddress(address)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy address"
          onPress={async () => {
            await Clipboard.setStringAsync(address);
            toast({ title: 'Address copied', tone: 'info' });
          }}
          style={styles.addr}>
          <Text style={type.mono}>{shortAddress(address)}</Text>
          <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Pay"
          icon="arrow-up"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/pay', params: { to: address, ...(name ? { label: name } : {}) } })}
        />
        <Button
          title={name ? 'Edit' : 'Save'}
          icon="create-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/contact/new', params: { address } })}
        />
      </View>

      {history.length > 0 ? (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={type.small}>You sent</Text>
            <Text style={type.heading}>${formatUsdc(sent)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={type.small}>You received</Text>
            <Text style={[type.heading, { color: colors.positive }]}>${formatUsdc(received)}</Text>
          </View>
        </View>
      ) : null}

      <SectionTitle>Payments with {name ?? 'this address'}</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        {history.length === 0 ? (
          <Empty icon="swap-horizontal-outline" title="No payments yet" />
        ) : (
          history.map((i) => <ActivityRow key={i.id} item={i} network={network} />)
        )}
      </Card>

      <Button title="View on explorer" variant="ghost" icon="open-outline" onPress={() => Linking.openURL(addressUrl(network, address))} />
      {name ? <Button title="Remove contact" variant="danger" onPress={onDelete} style={{ marginTop: spacing.sm }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginVertical: spacing.md },
  addr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
});
