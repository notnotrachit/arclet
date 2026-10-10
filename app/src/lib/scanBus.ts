import type { Address } from 'viem';

/**
 * Tiny one-shot channel so screens can ask the scanner for an address (e.g. adding a group member)
 * instead of a full payment request.
 */
let pending: ((a: Address) => void) | null = null;

export function requestScannedAddress(cb: (a: Address) => void) {
  pending = cb;
}

export function hasPendingAddressRequest() {
  return pending !== null;
}

export function resolveScannedAddress(a: Address) {
  const cb = pending;
  pending = null;
  cb?.(a);
}

export function cancelScannedAddress() {
  pending = null;
}
