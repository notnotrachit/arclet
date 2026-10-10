import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, isHex, type Hex } from 'viem';
import { english, generateMnemonic, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

/**
 * Self-custodial key storage. The private key lives in the iOS Keychain / Android Keystore-backed
 * SecureStore, never leaves the device, and is not included in backups (THIS_DEVICE_ONLY).
 *
 * Arclet must use a plain EOA: Arc's Memo and Multicall3From predeploys reject smart-contract wallets.
 */
const KEY_PK = 'arclet.privateKey';
const KEY_MNEMONIC = 'arclet.mnemonic';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Web has no secure enclave; fall back to localStorage so the demo build works. Not for real funds.
const isWeb = Platform.OS === 'web';
const store = {
  get: (k: string) => (isWeb ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k, options)),
  set: (k: string, v: string) =>
    isWeb ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v, options),
  del: (k: string) => (isWeb ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k, options)),
};

export const isInsecureStorage = isWeb;

/** Lets the UI paint a spinner before the CPU-heavy BIP-39 seed derivation runs on the JS thread. */
const nextFrame = () => new Promise((r) => setTimeout(r, 50));

export async function createWallet(): Promise<{ privateKey: Hex; mnemonic: string }> {
  await nextFrame();
  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);
  const pk = account.getHdKey().privateKey;
  if (!pk) throw new Error('Key derivation failed');
  const privateKey = bytesToHex(pk);
  await store.set(KEY_PK, privateKey);
  await store.set(KEY_MNEMONIC, mnemonic);
  return { privateKey, mnemonic };
}

/** Accepts a 12/24-word recovery phrase or a 0x-prefixed 32-byte private key. */
export async function importWallet(input: string): Promise<Hex> {
  const trimmed = input.trim();
  const words = trimmed.toLowerCase().split(/\s+/);
  await nextFrame();

  if (words.length === 12 || words.length === 24) {
    const phrase = words.join(' ');
    let account;
    try {
      account = mnemonicToAccount(phrase);
    } catch {
      throw new Error('That recovery phrase is not valid.');
    }
    const pk = account.getHdKey().privateKey;
    if (!pk) throw new Error('Key derivation failed');
    const privateKey = bytesToHex(pk);
    await store.set(KEY_PK, privateKey);
    await store.set(KEY_MNEMONIC, phrase);
    return privateKey;
  }

  const hex = (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as Hex;
  if (!isHex(hex) || hex.length !== 66) throw new Error('Enter a 12/24-word phrase or a 64-character private key.');
  privateKeyToAccount(hex); // validates the scalar
  await store.set(KEY_PK, hex);
  await store.del(KEY_MNEMONIC);
  return hex;
}

export const loadPrivateKey = async () => (await store.get(KEY_PK)) as Hex | null;
export const loadMnemonic = () => store.get(KEY_MNEMONIC);

export async function wipeWallet() {
  await store.del(KEY_PK);
  await store.del(KEY_MNEMONIC);
}
