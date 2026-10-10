import { formatUnits, parseUnits, type Address } from 'viem';
import { NATIVE_TO_USDC, USDC_DECIMALS } from './contracts/arc';

/** Formats 6-decimal USDC units, e.g. 12_500000n -> "12.50". Shows more precision for tiny amounts. */
export function formatUsdc(units: bigint, { sign = false, exact = false }: { sign?: boolean; exact?: boolean } = {}): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const raw = formatUnits(abs, USDC_DECIMALS);
  const [whole, frac = ''] = raw.split('.');
  let decimals = frac.padEnd(2, '0');
  if (exact || (abs > 0n && abs < 10_000n)) decimals = frac.replace(/0+$/, '').padEnd(2, '0'); // < $0.01: keep precision
  else decimals = decimals.slice(0, 2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = negative ? '-' : sign && abs > 0n ? '+' : '';
  return `${prefix}${grouped}.${decimals}`;
}

/** Full payment precision so review screens always match the amount being sent. */
export const formatPaymentAmount = (units: bigint) => formatUsdc(units, { exact: true });

/** Native balance (18 decimals) -> 6-decimal units, truncating sub-micro dust. */
export const nativeToUsdc = (wei: bigint) => wei / NATIVE_TO_USDC;

/** Parses user input like "12", "12.5", "0.000001". Returns null if invalid or > 6 decimals. */
export function parseUsdcInput(input: string): bigint | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const [, frac = ''] = s.split('.');
  if (frac.length > USDC_DECIMALS) return null;
  try {
    return parseUnits(s, USDC_DECIMALS);
  } catch {
    return null;
  }
}

/** Plain decimal string for URIs, e.g. 12_500000n -> "12.5". */
export const usdcToDecimal = (units: bigint) => formatUnits(units, USDC_DECIMALS);

export const shortAddress = (a: Address | string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}
