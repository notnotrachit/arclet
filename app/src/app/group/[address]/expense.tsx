import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Address } from 'viem';
import { confirmWithBiometrics } from '@/lib/auth';
import { formatUsdc, parseUsdcInput } from '@/lib/format';
import { addExpense } from '@/lib/groups';
import { friendlyError } from '@/lib/tx';
import { useContacts } from '@/state/contacts';
import { useGroups } from '@/state/groups';
import { useGroup } from '@/state/useGroup';
import { useReadyWallet } from '@/state/wallet';
import { AmountInput, Avatar, Banner, Button, Card, Field, Screen, SectionTitle, Segmented } from '@/ui/components';
import { colors, radius, spacing, type } from '@/ui/theme';

type Mode = 'equal' | 'custom';

export default function AddExpense() {
  const { address: param } = useLocalSearchParams<{ address: string }>();
  const { account, network } = useReadyWallet();
  const { label } = useContacts();
  const { refresh: refreshGroups } = useGroups();
  const { address, detail, me } = useGroup(param);
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [paidBy, setPaidBy] = useState<Address>(me);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('equal');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const members = useMemo(() => detail?.members ?? [], [detail]);
  // Everyone is included by default; track who was unticked.
  const selected = new Set(members.map((m) => m.address).filter((a) => !deselected.has(a)));

  const amount = parseUsdcInput(amountInput);
  const participants = members.map((m) => m.address).filter((a) => selected.has(a));
  const shares = mode === 'custom' ? participants.map((p) => parseUsdcInput(custom[p] ?? '') ?? 0n) : [];
  const customTotal = shares.reduce((a, b) => a + b, 0n);
  const perPerson = amount && participants.length ? amount / BigInt(participants.length) : 0n;

  const problem = !amount || amount <= 0n
    ? null
    : participants.length === 0
      ? 'Pick at least one person to split with.'
      : mode === 'custom' && customTotal !== amount
        ? `Custom amounts add up to $${formatUsdc(customTotal)}, not $${formatUsdc(amount)}.`
        : null;
  const canAdmin = detail?.isAdmin ?? false;
  const valid = !!amount && amount > 0n && !problem && !!address;

  const onSave = async () => {
    if (!amount || !address) return;
    setError(undefined);
    if (!(await confirmWithBiometrics('Record expense'))) return;
    setBusy(true);
    try {
      await addExpense({ network, account, group: address, paidBy, amount, participants, shares, note: note.trim() });
      refreshGroups();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  const toggle = (a: Address) =>
    setDeselected((s) => {
      const n = new Set(s);
      if (n.has(a)) n.delete(a);
      else n.add(a);
      return n;
    });

  return (
    <Screen footer={<Button title="Save expense" onPress={onSave} loading={busy} disabled={!valid} />}>
      <Text style={[type.muted, { textAlign: 'center' }]}>Something someone paid for out of pocket</Text>
      <AmountInput value={amountInput} onChange={setAmountInput} autoFocus />
      <Field label="What for?" placeholder="Dinner at Thalassa" value={note} onChangeText={(t) => setNote(t.slice(0, 280))} />

      <SectionTitle>Paid by</SectionTitle>
      <View style={styles.chips}>
        {members
          .filter((m) => canAdmin || m.address.toLowerCase() === me.toLowerCase())
          .map((m) => (
            <Pressable
              key={m.address}
              accessibilityRole="radio"
              accessibilityState={{ checked: paidBy === m.address }}
              onPress={() => setPaidBy(m.address)}
              style={[styles.chip, paidBy === m.address && styles.chipOn]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{label(m.address)}</Text>
            </Pressable>
          ))}
      </View>
      {!canAdmin ? <Text style={type.small}>Only admins can record an expense on someone else’s behalf.</Text> : null}

      <SectionTitle>Split between</SectionTitle>
      <Segmented<Mode>
        options={[
          { value: 'equal', label: 'Equally' },
          { value: 'custom', label: 'Custom amounts' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Card style={{ paddingVertical: spacing.xs }}>
        {members.map((m) => {
          const on = selected.has(m.address);
          return (
            <View key={m.address} style={styles.memberRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(m.address)}
                style={styles.memberLeft}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.accent : colors.textFaint} />
                <Avatar address={m.address} name={label(m.address)} size={32} />
                <Text style={[type.body, { marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                  {label(m.address)}
                </Text>
              </Pressable>
              {on && mode === 'custom' ? (
                <TextInput
                  accessibilityLabel={`Amount for ${label(m.address)}`}
                  value={custom[m.address] ?? ''}
                  onChangeText={(t) => setCustom((c) => ({ ...c, [m.address]: t.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textFaint}
                  style={styles.shareInput}
                />
              ) : on && amount ? (
                <Text style={type.muted}>${formatUsdc(perPerson)}</Text>
              ) : null}
            </View>
          );
        })}
      </Card>
      {problem ? <Banner tone="warning">{problem}</Banner> : null}
      <Banner>Recording an expense doesn’t move money. It updates who owes whom, and people settle up later.</Banner>
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  memberLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  shareInput: {
    width: 90,
    textAlign: 'right',
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 15,
  },
});
