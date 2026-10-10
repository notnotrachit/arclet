import AsyncStorage from '@react-native-async-storage/async-storage';

// JSON with bigint support: bigints are stored as {"$big":"123"}.
const replacer = (_: string, v: unknown) => (typeof v === 'bigint' ? { $big: v.toString() } : v);
const reviver = (_: string, v: unknown) =>
  v && typeof v === 'object' && '$big' in (v as Record<string, unknown>)
    ? BigInt((v as { $big: string }).$big)
    : v;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw, reviver) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value, replacer));
}

export async function removeKeys(prefix: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(prefix)));
}
