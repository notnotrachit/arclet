import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { confirmWithBiometrics } from '@/lib/auth';
import { formatPaymentAmount as formatUsdc, parseUsdcInput } from '@/lib/format';
import { depositToGroup } from '@/lib/groups';
import { friendlyError } from '@/lib/tx';
import { useActivity } from '@/state/activity';
import { useGroups } from '@/state/groups';
import { useGroup } from '@/state/useGroup';
import { useReadyWallet } from '@/state/wallet';
import { AmountInput, Banner, Button, Field, PageIntro, Screen } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function Deposit() {
  const { type } = useTheme();
  const { address: param } = useLocalSearchParams<{ address: string }>();
  const { account, network, balance, refreshBalance } = useReadyWallet();
  const { address, detail, error: loadError } = useGroup(param);
  const { refresh: refreshGroups } = useGroups();
  const { refresh: refreshActivity } = useActivity();
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const amount = parseUsdcInput(amountInput);
  const tooMuch = amount !== null && balance !== null && amount > balance - 20_000n;
  const valid = balance !== null && !!detail && !!amount && amount > 0n && !tooMuch && !!address;

  const onDeposit = async () => {
    if (!amount || !address) return;
    setError(undefined);
    if (!(await confirmWithBiometrics(`Add ${formatUsdc(amount)} USDC to ${detail?.name ?? 'group'}`))) return;
    setBusy(true);
    try {
      await depositToGroup({ network, account, group: address, amount, note: note.trim() });
      refreshBalance();
      refreshGroups();
      refreshActivity();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title="Add to group" onPress={onDeposit} loading={busy} disabled={!valid} />}>
      <PageIntro eyebrow="Chip in" title="Add to the shared pot." body="Move USDC from your wallet into the group. All members can see your contribution." />
      <Text style={[type.muted, { textAlign: 'center' }]}>To {detail?.name ?? '…'}</Text>
      <AmountInput value={amountInput} onChange={setAmountInput} autoFocus />
      <Text style={[type.small, { textAlign: 'center', marginBottom: spacing.md }]}>
        You have ${balance === null ? '…' : formatUsdc(balance)}
      </Text>
      <Field label="Note (optional)" placeholder="e.g. My share for the villa" value={note} onChangeText={(t) => setNote(t.slice(0, 280))} hint="Notes are public on Arc." />
      <Banner>
        Your contribution goes into the shared group wallet. Keep a few cents in your personal wallet for network fees.
      </Banner>
      {tooMuch ? <Banner tone="error">Not enough USDC (keep a few cents for fees).</Banner> : null}
      {loadError ? <Banner tone="error">Couldn’t load this group. Go back and try again.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}
