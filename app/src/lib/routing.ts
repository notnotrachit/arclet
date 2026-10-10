import { router } from 'expo-router';
import type { PaymentRequest } from './payments';

/** Opens the Pay screen pre-filled from a scanned / tapped / linked request. */
export function openPayRequest(req: PaymentRequest, opts: { replace?: boolean } = {}) {
  const params: Record<string, string> = { to: req.to };
  if (req.amount) params.amount = req.amount;
  if (req.note) params.note = req.note;
  if (req.ref) params.ref = req.ref;
  if (req.chainId) params.chain = String(req.chainId);
  if (req.label) params.label = req.label;
  const nav = opts.replace ? router.replace : router.push;
  nav({ pathname: '/pay', params });
}
