import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { shortAddress } from '@/lib/format';
import { useContacts } from '@/state/contacts';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { Avatar, Button, Card, Empty, ListRow, Screen, SectionTitle } from '@/ui/components';
import { colors, radius, spacing, type } from '@/ui/theme';

export default function ContactsTab() {
  const { address } = useReadyWallet();
  const { list } = useContacts();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [showQr, setShowQr] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
  }, [list, query]);

  return (
    <Screen footer={<Button title="Add contact" icon="person-add-outline" onPress={() => router.push('/contact/new')} />}>
      <Card>
        <View style={styles.meRow}>
          <Avatar address={address} name="You" size={44} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={type.heading}>My address</Text>
            <Text style={type.mono}>{shortAddress(address)}</Text>
          </View>
          <Button title={showQr ? 'Hide' : 'Show QR'} variant="secondary" onPress={() => setShowQr((s) => !s)} style={styles.smallBtn} />
        </View>
        {showQr ? (
          <View style={styles.qrWrap}>
            <View style={styles.qr} accessible accessibilityLabel="Your address QR code">
              <QRCode value={address} size={200} backgroundColor="#FFFFFF" color="#0B0F17" quietZone={12} />
            </View>
            <Text style={[type.small, { textAlign: 'center' }]}>Friends scan this to add you as a contact.</Text>
            <Button
              title="Copy address"
              variant="ghost"
              icon="copy-outline"
              onPress={async () => {
                await Clipboard.setStringAsync(address);
                toast({ title: 'Address copied', tone: 'info' });
              }}
            />
          </View>
        ) : null}
      </Card>

      {list.length > 0 ? (
        <TextInput
          accessibilityLabel="Search contacts"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or address"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
      ) : null}

      <SectionTitle>{list.length ? `${list.length} contact${list.length === 1 ? '' : 's'}` : 'Contacts'}</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        {list.length === 0 ? (
          <Empty
            icon="people-circle-outline"
            title="No contacts yet"
            body="Save people you pay often. Their names show up instead of 0x addresses everywhere in Arclet."
          />
        ) : filtered.length === 0 ? (
          <Empty icon="search-outline" title="No matches" />
        ) : (
          filtered.map((c) => (
            <ListRow
              key={c.address}
              left={<Avatar address={c.address} name={c.name} />}
              title={c.name}
              subtitle={shortAddress(c.address)}
              onPress={() => router.push({ pathname: '/contact/[address]', params: { address: c.address } })}
            />
          ))
        )}
      </Card>
      <Text style={[type.small, { textAlign: 'center' }]}>Contacts are stored only on this phone.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meRow: { flexDirection: 'row', alignItems: 'center' },
  smallBtn: { minHeight: 38, paddingVertical: 8, paddingHorizontal: spacing.md },
  qrWrap: { alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  qr: { borderRadius: radius.md, overflow: 'hidden' },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
});
