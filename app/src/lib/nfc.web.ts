// Web build: NFC is unavailable; QR covers payments.
export const canReadNfc = async () => false;
export const isNfcOn = async () => false;
export const openNfcSettings = async () => {};
export const canBroadcastNfc = () => false;
export const startBroadcast = async (_uri: string) => {
  throw new Error('NFC is not available on the web');
};
export const stopBroadcast = async () => {};
export const addTagReadListener = (_l: () => void) => ({ remove: () => {} });
export const hceNfcEnabled = () => false;
export const readPaymentTag = async (): Promise<string> => {
  throw new Error('NFC is not available on the web');
};
export const cancelNfcRead = async () => {};
