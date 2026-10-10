import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getAddress, isAddress } from 'viem';
import { confirmWithBiometrics } from '@/lib/auth';
import { formatPaymentAmount as formatUsdc, parseUsdcInput, usdcToDecimal } from '@/lib/format';
import { recordCashSettlement, settleDebt } from '@/lib/groups';
import { friendlyError } from '@/lib/tx';
import { useActivity } from '@/state/activity';
import { useContacts } from '@/state/contacts';
import { useGroups } from '@/state/groups';
import { useGroup } from '@/state/useGroup';
import { useReadyWallet } from '@/state/wallet';
import { AmountInput, Avatar, Banner, Button, Field, PageIntro, Screen } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

/**
 * Two modes:
 *  - creditor param: I owe them → pay USDC through the group contract (updates the ledger atomically).
 *  - debtor param: they owe me → I confirm they paid me outside Arclet (cash, bank).
 */
export default function Settle() {
  const { type } = useTheme();
  const params = useLocalSearchParams<{ address: string; creditor?: string; debtor?: string; amount?: string }>();
  const { account, network, refreshBalance } = useReadyWallet();
  const { label } = useContacts();
  const { refresh: refreshGroups } = useGroups();
  const { refresh: refreshActivity } = useActivity();
  const { address, detail, error: loadError } = useGroup(params.address);
  const max = params.amount && /^\d+$/.test(params.amount) ? BigInt(params.amount) : 0n;
  const [amountInput, setAmountInput] = useState(max ? usdcToDecimal(max) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const creditor = params.creditor && isAddress(params.creditor) ? getAddress(params.creditor) : null;
  const debtor = params.debtor && isAddress(params.debtor) ? getAddress(params.debtor) : null;
  const other = creditor ?? debtor;
  const amount = parseUsdcInput(amountInput);
  const valid = !!address && !!other && !!amount && amount > 0n && (max === 0n || amount <= max);

  const onSettle = async () => {
    if (!address || !amount) return;
    setError(undefined);
    const prompt = creditor ? `Pay ${formatUsdc(amount)} USDC to ${label(creditor)}` : 'Confirm you were paid';
    if (!(await confirmWithBiometrics(prompt))) return;
    setBusy(true);
    try {
      if (creditor) await settleDebt({ network, account, group: address, creditor, amount, note: note.trim() });
      else if (debtor) await recordCashSettlement({ network, account, group: address, debtor, amount, note: note.trim() });
      refreshBalance();
      refreshGroups();
      refreshActivity();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  if (!other) return <Screen><Banner tone="error">Missing who to settle with.</Banner></Screen>;

  return (
    <Screen
      footer={
        <Button
          title={creditor ? `Pay ${amount ? `$${formatUsdc(amount)}` : ''}` : 'Mark as paid'}
          onPress={onSettle}
          loading={busy}
          disabled={!valid}
        />
      }>
      <PageIntro eyebrow="Settle up" title={creditor ? 'Square things up.' : 'Already paid you back?'} body={creditor ? 'Send your share and clear the balance together.' : 'Only mark this as paid after you’ve received the money.'} />
      <View style={{ alignItems: 'center', marginTop: spacing.md }}>
        <Avatar address={other} name={label(other)} size={56} />
        <Text style={[type.heading, { marginTop: spacing.sm }]}>
          {creditor ? `You owe ${label(other)}` : `${label(other)} owes you`}
        </Text>
        <Text style={type.muted}>in {detail?.name ?? '…'} · ${formatUsdc(max)}</Text>
      </View>
      <AmountInput value={amountInput} onChange={setAmountInput} />
      <Field label="Note (optional)" placeholder={creditor ? 'Thanks for dinner!' : 'Paid me in cash'} value={note} onChangeText={(t) => setNote(t.slice(0, 280))} hint="Notes are public on Arc." />
      <Banner>
        {creditor
          ? 'Pay them in USDC and clear this split balance at the same time.'
          : 'This records a repayment made in cash or through another app. It doesn’t transfer money.'}
      </Banner>
      {amount && max && amount > max ? <Banner tone="error">That’s more than what’s owed.</Banner> : null}
      {loadError ? <Banner tone="error">Couldn’t load this group. Go back and try again.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}
