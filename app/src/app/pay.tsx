import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAddress, isAddress, type Address, type Hex } from 'viem';
import { confirmWithBiometrics } from '@/lib/auth';
import { formatUsdc, parseUsdcInput, shortAddress } from '@/lib/format';
import { networkByChainId, NETWORKS, txUrl } from '@/lib/networks';
import { MAX_NOTE_LENGTH, payFromGroup, payPersonal } from '@/lib/payments';
import { friendlyError } from '@/lib/tx';
import { useActivity } from '@/state/activity';
import { useContacts } from '@/state/contacts';
import { useGroups } from '@/state/groups';
import { useReadyWallet } from '@/state/wallet';
import { AmountInput, Avatar, Banner, Button, Card, Field, Screen, SectionTitle } from '@/ui/components';
import { ContactChips } from '@/ui/ContactChips';
import { colors, radius, spacing, type } from '@/ui/theme';

/** Reserve kept back from "personal" payments so the wallet can still pay gas (in USDC). */
const FEE_RESERVE = 10_000n; // $0.01

type Params = { to?: string; amount?: string; note?: string; ref?: string; chain?: string; label?: string; from?: string };

export default function Pay() {
  const params = useLocalSearchParams<Params>();
  const { account, address, balance, network, setNetwork, refreshBalance } = useReadyWallet();
  const { groups, refresh: refreshGroups } = useGroups();
  const { label, nameOf } = useContacts();
  const { refresh: refreshActivity } = useActivity();

  const fixedTo = params.to && isAddress(params.to) ? getAddress(params.to) : null;
  const fixedAmount = params.amount ? parseUsdcInput(params.amount) : null;
  const requestedNetwork = params.chain ? networkByChainId(Number(params.chain)) : undefined;
  const wrongNetwork = requestedNetwork && requestedNetwork.id !== network;

  const [toInput, setToInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState(params.note ?? '');
  const [source, setSource] = useState<Address | 'personal'>(
    params.from && isAddress(params.from) ? getAddress(params.from) : 'personal',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ hash: Hex; amount: bigint } | null>(null);

  // A saved contact name wins over the name the requester put in their QR/NFC request.
  const recipientName = fixedTo ? nameOf(fixedTo) ?? params.label ?? label(fixedTo) : '';

  const to = fixedTo ?? (isAddress(toInput.trim()) ? getAddress(toInput.trim()) : null);
  const amount = fixedAmount ?? parseUsdcInput(amountInput);
  const group = source === 'personal' ? null : groups.find((g) => g.address === source) ?? null;
  const available = group ? group.balance : balance !== null ? balance - FEE_RESERVE : null;

  const validation = useMemo(() => {
    if (!to) return toInput ? 'Enter a valid 0x address.' : null;
    if (to.toLowerCase() === address.toLowerCase()) return 'You can’t pay yourself.';
    if (group && to.toLowerCase() === group.address.toLowerCase()) return 'Pick a different recipient.';
    if (!amount || amount <= 0n) return null;
    if (available !== null && amount > available) return group ? 'Not enough in the group wallet.' : 'Not enough USDC (keep a cent for fees).';
    return null;
  }, [to, toInput, address, amount, available, group]);

  const canPay = !!to && !!amount && amount > 0n && !validation && !wrongNetwork;

  const onPay = async () => {
    if (!to || !amount) return;
    setError(undefined);
    if (!(await confirmWithBiometrics(`Pay ${formatUsdc(amount)} USDC`))) return;
    setBusy(true);
    try {
      const common = { network, account, to, amount, note: note.trim() || undefined, ref: params.ref };
      const tx = group ? await payFromGroup({ ...common, group: group.address }) : await payPersonal(common);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone({ hash: tx.hash, amount });
      refreshBalance();
      refreshActivity();
      refreshGroups();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (done && to) {
    const known = nameOf(to) ?? params.label ?? label(to);
    return (
      <Screen
        scroll={false}
        footer={
          <>
            <Button title="Done" onPress={() => router.dismissAll()} />
            <Button
              title="View on explorer"
              variant="ghost"
              icon="open-outline"
              onPress={() => Linking.openURL(txUrl(network, done.hash))}
              style={{ marginTop: spacing.sm }}
            />
          </>
        }>
        <View style={styles.success}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={56} color={colors.bg} />
          </View>
          <Text style={[type.hero, { marginTop: spacing.lg }]}>${formatUsdc(done.amount)}</Text>
          <Text style={type.muted}>sent to {known}{group ? ` from ${group.name}` : ''}</Text>
          <Text style={[type.small, { marginTop: spacing.sm }]}>Final on Arc. No confirmations to wait for.</Text>
          {!nameOf(to) ? (
            <Button
              title="Save as contact"
              variant="secondary"
              icon="person-add-outline"
              onPress={() => router.push({ pathname: '/contact/new', params: { address: to, ...(params.label ? { name: params.label } : {}) } })}
              style={{ alignSelf: 'stretch', marginTop: spacing.xl }}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          title={amount ? `Pay $${formatUsdc(amount)}` : 'Pay'}
          icon="lock-closed-outline"
          onPress={onPay}
          loading={busy}
          disabled={!canPay}
        />
      }>
      {wrongNetwork && requestedNetwork ? (
        <Banner tone="warning">
          This request is for {requestedNetwork.label}, but you’re on {NETWORKS[network].label}.{' '}
          <Text style={{ color: colors.accent, fontWeight: '700' }} onPress={() => setNetwork(requestedNetwork.id)}>
            Switch
          </Text>
        </Banner>
      ) : null}

      {fixedTo ? (
        <Card style={styles.recipient}>
          <Avatar address={fixedTo} name={recipientName} size={48} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={type.heading} numberOfLines={1}>
              {recipientName}
            </Text>
            <Text style={type.mono}>{shortAddress(fixedTo)}</Text>
          </View>
          {!nameOf(fixedTo) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save as contact"
              hitSlop={8}
              onPress={() =>
                router.push({ pathname: '/contact/new', params: { address: fixedTo, ...(params.label ? { name: params.label } : {}) } })
              }>
              <Ionicons name="person-add-outline" size={22} color={colors.accent} />
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <View>
          <Field
            label="To"
            placeholder="0x… address, or pick a contact below"
            value={toInput}
            onChangeText={setToInput}
            autoCapitalize="none"
            autoCorrect={false}
            error={validation && !to ? validation : undefined}
            hint={to ? `Paying ${label(to)}` : undefined}
          />
          <ContactChips onPick={(a) => setToInput(a)} exclude={[address]} />
          <Button title="Scan a QR instead" variant="ghost" icon="qr-code-outline" onPress={() => router.replace('/scan')} />
        </View>
      )}

      {fixedAmount ? (
        <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
          <Text style={type.muted}>Requested</Text>
          <Text style={type.hero}>${formatUsdc(fixedAmount)}</Text>
        </View>
      ) : (
        <AmountInput value={amountInput} onChange={setAmountInput} autoFocus={!!fixedTo} />
      )}

      <Field
        label="Note"
        placeholder="What’s it for? (visible onchain)"
        value={note}
        onChangeText={(t) => setNote(t.slice(0, MAX_NOTE_LENGTH))}
        hint={`${note.length}/${MAX_NOTE_LENGTH} · notes are public on Arc`}
      />

      <SectionTitle>Pay from</SectionTitle>
      <SourceOption
        selected={source === 'personal'}
        title="My wallet"
        subtitle={balance === null ? '…' : `$${formatUsdc(balance)} available`}
        icon="wallet-outline"
        onPress={() => setSource('personal')}
      />
      {groups.map((g) => (
        <SourceOption
          key={g.address}
          selected={source === g.address}
          title={g.name}
          subtitle={`$${formatUsdc(g.balance)} in group wallet`}
          icon="people-outline"
          onPress={() => setSource(g.address)}
        />
      ))}

      {validation && to ? <Banner tone="error">{validation}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}

function SourceOption({
  selected,
  title,
  subtitle,
  icon,
  onPress,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.source, selected && { borderColor: colors.accent }]}>
      <Ionicons name={icon} size={22} color={selected ? colors.accent : colors.textMuted} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={type.body}>{title}</Text>
        <Text style={type.small}>{subtitle}</Text>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.accent : colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  recipient: { flexDirection: 'row', alignItems: 'center' },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
