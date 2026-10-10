import { Touch } from '@/ui/motion';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAddress, isAddress, type Address } from 'viem';
import { MAX_CONTACT_NAME } from '@/lib/contacts';
import { parsePaymentUri } from '@/lib/payments';
import { requestScannedAddress } from '@/lib/scanBus';
import { useContacts } from '@/state/contacts';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { Avatar, Banner, Button, Field, PageIntro, Screen } from '@/ui/components';
import { radius, spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

/** Add a contact, or edit one when opened with an address that's already saved. */
export default function NewContact() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ address?: string; name?: string }>();
  const { address: me } = useReadyWallet();
  const { nameOf, save } = useContacts();
  const toast = useToast();
  const initial = params.address && isAddress(params.address) ? getAddress(params.address) : null;
  const [addressInput, setAddressInput] = useState<string>(initial ?? '');
  const [name, setName] = useState(params.name ?? (initial ? nameOf(initial) ?? '' : ''));
  const [busy, setBusy] = useState(false);

  const trimmed = addressInput.trim();
  const parsed: Address | null = isAddress(trimmed) ? getAddress(trimmed) : parsePaymentUri(trimmed)?.to ?? null;
  const isSelf = parsed?.toLowerCase() === me.toLowerCase();
  const existing = parsed ? nameOf(parsed) : undefined;
  const editing = !!initial && !!nameOf(initial);
  const error = trimmed && !parsed ? 'Not a valid address' : isSelf ? 'That’s your own address' : undefined;
  const valid = !!parsed && !isSelf && name.trim().length > 0;

  const onSave = async () => {
    if (!parsed) return;
    setBusy(true);
    await save(parsed, name);
    toast({ title: `${name.trim()} saved`, tone: 'success' });
    router.back();
  };

  return (
    <Screen footer={<Button title={editing ? 'Save changes' : 'Save contact'} onPress={onSave} disabled={!valid} loading={busy} />}>
      <Stack.Screen options={{ title: editing ? 'Edit contact' : 'New contact' }} />
      <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
        <Avatar address={parsed ?? '0x000000'} name={name || undefined} size={64} />
      </View>
      <PageIntro eyebrow="Your people" title={editing ? 'Update their details.' : 'Put a name to an address.'} body="Save a name so it’s easier to find and pay the right person." />
      <Field
        label="Name"
        placeholder="e.g. Priya"
        value={name}
        onChangeText={(t) => setName(t.slice(0, MAX_CONTACT_NAME))}
        autoFocus={!!initial}
      />
      <View style={{ marginBottom: spacing.md }}>
        <Field
          label="Arc address"
          placeholder="0x… (paste or scan)"
          value={addressInput}
          onChangeText={setAddressInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!initial}
          error={error}
        />
        {!initial ? (
          <View style={styles.actions}>
            <Touch
              accessibilityRole="button"
              accessibilityLabel="Scan address QR"
              style={styles.iconBtn}
              onPress={() => {
                requestScannedAddress((a) => setAddressInput(a));
                router.push('/scan');
              }}>
              <Ionicons name="qr-code-outline" size={20} color={colors.text} />
            </Touch>
          </View>
        ) : null}
      </View>
      {existing && !editing ? <Banner tone="warning">This address is already saved as “{existing}”. Saving will rename it.</Banner> : null}
      <Banner>Names are private to this phone. They never go onchain.</Banner>
    </Screen>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -spacing.sm },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
});
