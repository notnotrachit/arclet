import { Platform } from 'react-native';
import { NativeModule, requireOptionalNativeModule } from 'expo';

type ArcletHceEvents = {
  onTagRead: () => void;
};

declare class ArcletHceNativeModule extends NativeModule<ArcletHceEvents> {
  isSupported(): boolean;
  isNfcEnabled(): boolean;
  start(uri: string): Promise<void>;
  stop(): Promise<void>;
}

// Android-only: iOS does not allow third-party apps to emulate NFC tags.
const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<ArcletHceNativeModule>('ArcletHce') : null;

/** True when this phone can broadcast a payment request over NFC (Android with HCE hardware). */
export function isHceSupported(): boolean {
  return native?.isSupported() ?? false;
}

export function isNfcEnabled(): boolean {
  return native?.isNfcEnabled() ?? false;
}

/** Start answering NFC readers with `uri` as an NDEF URI record (Type 4 Tag emulation). */
export async function startBroadcast(uri: string): Promise<void> {
  if (!native) throw new Error('NFC broadcast is not supported on this device');
  await native.start(uri);
}

export async function stopBroadcast(): Promise<void> {
  await native?.stop();
}

/** Fires when a reader has read the full payment request. */
export function addTagReadListener(listener: () => void): { remove: () => void } {
  if (!native) return { remove: () => {} };
  return native.addListener('onTagRead', listener);
}
