import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import {
  addTagReadListener,
  isHceSupported,
  isNfcEnabled as hceNfcEnabled,
  startBroadcast,
  stopBroadcast,
} from '../../modules/arclet-hce';

/**
 * Tap-to-pay transport. NFC only carries the payment *request* (an arclet:// URI);
 * the payment itself is a normal signed Arc transaction.
 *
 *  - Receiver (Android only): emulates an NFC Type 4 tag via our local `arclet-hce` Expo module.
 *  - Payer (Android + iOS): reads that tag with react-native-nfc-manager.
 */

let started = false;
async function ensureStarted() {
  if (!started) {
    await NfcManager.start();
    started = true;
  }
}

export async function canReadNfc(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function isNfcOn(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS has no NFC toggle
  try {
    await ensureStarted();
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

export const openNfcSettings = () => NfcManager.goToNfcSetting();

export const canBroadcastNfc = () => Platform.OS === 'android' && isHceSupported();

export { startBroadcast, stopBroadcast, addTagReadListener, hceNfcEnabled };

/** Waits for a tap and returns the first URI/text record. Throws if cancelled. */
export async function readPaymentTag(): Promise<string> {
  await ensureStarted();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Hold your phone near the other phone',
    });
    const tag = await NfcManager.getTag();
    const records = tag?.ndefMessage ?? [];
    for (const r of records) {
      const payload = new Uint8Array(r.payload as number[]);
      if (Ndef.isType(r, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) return Ndef.uri.decodePayload(payload);
      if (Ndef.isType(r, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) return Ndef.text.decodePayload(payload);
    }
    throw new Error('That tag doesn’t contain a payment request.');
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export const cancelNfcRead = () => NfcManager.cancelTechnologyRequest().catch(() => {});
