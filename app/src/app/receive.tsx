import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import { getPublicClient } from '@/lib/clients';
import { formatPaymentAmount as formatUsdc, parseUsdcInput, usdcToDecimal } from '@/lib/format';
import { addTagReadListener, canBroadcastNfc, hceNfcEnabled, openNfcSettings, startBroadcast, stopBroadcast } from '@/lib/nfc';
import { NETWORKS } from '@/lib/networks';
import {
  buildEip681Uri,
  buildRequestUri,
  findIncomingPayment,
  MAX_NOTE_LENGTH,
  newRef,
  type IncomingPayment,
  type PaymentRequest,
} from '@/lib/payments';
import { useActivity } from '@/state/activity';
import { useContacts } from '@/state/contacts';
import { useReadyWallet } from '@/state/wallet';
import { AmountInput, Banner, Button, Card, Field, Screen, Segmented, PageIntro, SuccessMark } from '@/ui/components';
import { Pulse } from '@/ui/motion';
import { radius, spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

type Phase = 'edit' | 'waiting' | 'paid';

export default function Receive() {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  const { width } = useWindowDimensions();
  const qrSize = Math.min(220, width - 110);
  const { address, network, refreshBalance } = useReadyWallet();
  const { label, nameOf } = useContacts();
  const { refresh: refreshActivity } = useActivity();
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('edit');
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [format, setFormat] = useState<'arclet' | 'any'>('arclet');
  const [nfcState, setNfcState] = useState<'off' | 'unsupported' | 'ready' | 'read' | 'error'>('unsupported');
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [paid, setPaid] = useState<IncomingPayment | null>(null);
  const watch = useRef<{ ref: string; amount?: bigint; fromBlock: bigint; stop: boolean } | null>(null);

  const amount = amountInput ? parseUsdcInput(amountInput) : null;
  const amountInvalid = !!amountInput && (!amount || amount <= 0n);
  const chainId = NETWORKS[network].chain.id;

  const stopAll = useCallback(() => {
    if (watch.current) watch.current.stop = true;
    watch.current = null;
    stopBroadcast().catch(() => {});
  }, []);

  // Stop broadcasting/polling whenever the screen loses focus.
  useFocusEffect(useCallback(() => stopAll, [stopAll]));

  useEffect(() => {
    const sub = addTagReadListener(() => {
      setNfcState('read');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const start = async () => {
    stopAll();
    setConnectionIssue(false);
    const req: PaymentRequest = {
      to: address,
      amount: amount ? usdcToDecimal(amount) : undefined,
      note: note.trim() || undefined,
      ref: newRef(),
      chainId,
    };
    setRequest(req);
    setPhase('waiting');
    setPaid(null);
    // Register immediately so Cancel/back also stops setup that is still awaiting the network.
    const w = { ref: req.ref!, amount: amount ?? undefined, fromBlock: 0n, stop: false };
    watch.current = w;

    if (canBroadcastNfc()) {
      if (!hceNfcEnabled()) setNfcState('off');
      else {
        try {
          await startBroadcast(buildRequestUri(req));
          if (!w.stop) setNfcState('ready');
        } catch {
          if (!w.stop) setNfcState('error');
        }
      }
    } else setNfcState('unsupported');

    if (w.stop) { if (!watch.current) stopBroadcast().catch(() => {}); return; }
    const latest = await getPublicClient(network).getBlockNumber().catch(() => 0n);
    if (w.stop) return;
    w.fromBlock = latest > 5n ? latest - 5n : 0n;
    poll(w);
  };

  const poll = async (w: NonNullable<typeof watch.current>) => {
    while (!w.stop) {
      try {
        const hit = await findIncomingPayment({ network, me: address, ref: w.ref, amount: w.amount, fromBlock: w.fromBlock });
        if (!w.stop) setConnectionIssue(false);
        if (hit && !w.stop) {
          w.stop = true;
          stopBroadcast().catch(() => {});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setPaid(hit);
          setPhase('paid');
          refreshBalance();
          refreshActivity();
          return;
        }
      } catch {
        if (!w.stop) setConnectionIssue(true);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const reset = () => {
    stopAll();
    setPhase('edit');
    setRequest(null);
    setPaid(null);
  };

  if (phase === 'paid' && paid) {
    return (
      <Screen
        scroll={false}
        footer={
          <>
            <Button title="New request" onPress={reset} />
            <Button title="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
          </>
        }>
        <View style={styles.center}>
          <SuccessMark />
          <Text style={[type.heading, { marginTop: spacing.lg }]}>Payment received</Text>
          <Text style={[type.hero, { marginTop: spacing.lg }]}>${formatUsdc(paid.amount)}</Text>
          <Text style={type.muted}>from {label(paid.from)}</Text>
          {paid.note ? <Text style={[type.body, { marginTop: spacing.sm }]}>“{paid.note}”</Text> : null}
          <Text style={[type.small, { marginTop: spacing.md }]}>Received and final on Arc.</Text>
          {!nameOf(paid.from) ? (
            <Button
              title={`Save ${label(paid.from)} as contact`}
              variant="secondary"
              icon="person-add-outline"
              onPress={() => router.push({ pathname: '/contact/new', params: { address: paid.from } })}
              style={{ alignSelf: 'stretch', marginTop: spacing.xl }}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  if (phase === 'waiting' && request) {
    const uri = format === 'arclet' ? buildRequestUri(request) : buildEip681Uri(request, chainId);
    return (
      <Screen
        footer={
          <>
            <Button
              key="share-request"
              title="Share link"
              variant="secondary"
              icon="share-outline"
              onPress={() => Share.share({ message: buildRequestUri(request) })}
            />
            <Button title="Cancel" variant="ghost" onPress={reset} style={{ marginTop: spacing.sm }} />
          </>
        }>
        <View style={{ alignItems: 'center' }}>
          <Text style={type.muted}>{request.amount ? 'Requesting' : 'Any amount'}</Text>
          {request.amount ? <Text style={type.hero} adjustsFontSizeToFit numberOfLines={1}>${formatUsdc(parseUsdcInput(request.amount)!)}</Text> : null}
          {request.note ? <Text style={[type.body, { marginBottom: spacing.sm }]}>“{request.note}”</Text> : null}
        </View>

        <NfcStatus state={nfcState} />
        {connectionIssue ? <Banner tone="warning">Connection interrupted. We’ll keep checking for payment. Keep this request open.</Banner> : null}

        <Card style={styles.qrCard}>
          <View style={styles.qr} accessible accessibilityLabel="Payment request QR code">
            <QRCode value={uri} size={qrSize} backgroundColor="#FFFFFF" color="#0B0F17" quietZone={12} />
          </View>
          <View style={{ alignSelf: 'stretch' }}><Segmented
            options={[
              { value: 'arclet', label: 'Arclet' },
              { value: 'any', label: 'Any wallet' },
            ]}
            value={format}
            onChange={setFormat}
          /></View>
          <Text style={[type.small, { textAlign: 'center' }]}>
            {format === 'arclet'
              ? 'Scan with Arclet: amount and note are filled in, and this screen updates when paid.'
              : `For compatible wallets such as MetaMask. Notes aren’t included. Payment is matched by amount${request.amount ? '' : ' — set an amount to auto-detect'}.`}
          </Text>
        </Card>
<Pulse><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} /><Text accessibilityLiveRegion="polite" style={type.muted}>Waiting for payment…</Text></View></Pulse>
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button key="create-request" title="Show request" icon="qr-code-outline" onPress={start} disabled={amountInvalid} />}>
      <PageIntro eyebrow="Receive money" title="Share a QR. Get paid." body="Choose an amount, or let the sender choose. We’ll update your request when payment arrives." />
      <AmountInput value={amountInput} onChange={setAmountInput} />
      <Text style={[type.small, { textAlign: 'center', marginTop: -spacing.md, marginBottom: spacing.md }]}>
        Leave empty to let the payer choose
      </Text>
      <Field
        label="Note (optional)"
        placeholder="e.g. Pizza night 🍕"
        value={note}
        onChangeText={(t) => setNote(t.slice(0, MAX_NOTE_LENGTH))}
        hint="Pre-fills the payer’s note. Notes are public onchain."
      />
      {amountInvalid ? <Banner tone="error">Enter an amount greater than zero, or leave it empty for any amount.</Banner> : null}
      {Platform.OS === 'ios' ? (
        <Banner>iPhone can’t broadcast over NFC (Apple restriction). Payers can scan your QR, or you can tap an Android phone to pay.</Banner>
      ) : null}
    </Screen>
  );
}

function NfcStatus({ state }: { state: 'off' | 'unsupported' | 'ready' | 'read' | 'error' }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  if (state === 'unsupported') return null;
  const map = {
    ready: { icon: 'radio-outline', text: 'Ready to tap: the payer just holds their unlocked phone to the back of this one. Arclet opens on their phone automatically.', color: colors.accent },
    read: { icon: 'checkmark-circle-outline', text: 'Request sent to their phone. Waiting for them to confirm…', color: colors.positive },
    off: { icon: 'warning-outline', text: 'NFC is turned off. Tap here to enable it.', color: colors.warning },
    error: { icon: 'warning-outline', text: 'Couldn’t start NFC. Use the QR code instead.', color: colors.negative },
  } as const;
  const s = map[state];
  return (
    <Text
      onPress={state === 'off' ? openNfcSettings : undefined}
      style={[styles.nfc, { borderColor: s.color, color: s.color }]}>
      <Ionicons name={s.icon} size={16} color={s.color} /> {s.text}
    </Text>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: { alignItems: 'center', gap: spacing.sm },
  qr: { borderRadius: radius.md, overflow: 'hidden', marginVertical: spacing.sm },
  nfc: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    fontWeight: '600',
    textAlign: 'center',
  },
});
