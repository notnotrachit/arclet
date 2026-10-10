import { useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { confirmWithBiometrics } from '@/lib/auth';
import { formatUsdc, parseUsdcInput } from '@/lib/format';
import { depositToGroup } from '@/lib/groups';
import { friendlyError } from '@/lib/tx';
import { useActivity } from '@/state/activity';
import { useGroups } from '@/state/groups';
import { useGroup } from '@/state/useGroup';
import { useReadyWallet } from '@/state/wallet';
import { AmountInput, Banner, Button, Field, Screen } from '@/ui/components';
import { spacing, type } from '@/ui/theme';

export default function Deposit() {
  const { address: param } = useLocalSearchParams<{ address: string }>();
  const { account, network, balance, refreshBalance } = useReadyWallet();
  const { address, detail } = useGroup(param);
  const { refresh: refreshGroups } = useGroups();
  const { refresh: refreshActivity } = useActivity();
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const amount = parseUsdcInput(amountInput);
  const tooMuch = amount !== null && balance !== null && amount > balance - 20_000n;
  const valid = !!amount && amount > 0n && !tooMuch && !!address;

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
      <Text style={[type.muted, { textAlign: 'center' }]}>To {detail?.name ?? '…'}</Text>
      <AmountInput value={amountInput} onChange={setAmountInput} autoFocus />
      <Text style={[type.small, { textAlign: 'center', marginBottom: spacing.md }]}>
        You have ${balance === null ? '…' : formatUsdc(balance)}
      </Text>
      <Field label="Note" placeholder="e.g. My share for the villa" value={note} onChangeText={(t) => setNote(t.slice(0, 280))} />
      <Banner>
        Uses one Arc transaction when possible: approve + deposit are batched with Arc’s Multicall3From, which keeps you as the
        sender for both calls.
      </Banner>
      {tooMuch ? <Banner tone="error">Not enough USDC (keep a few cents for fees).</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}
