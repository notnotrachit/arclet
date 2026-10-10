// crypto.getRandomValues for viem / @noble key + mnemonic generation on Hermes.
import 'react-native-get-random-values';

// Minimal UTF-8 TextDecoder for runtimes that lack it (viem's hexToString uses it for memo notes).
if (typeof globalThis.TextDecoder === 'undefined') {
  class Utf8Decoder {
    readonly encoding = 'utf-8';
    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return '';
      const bytes =
        input instanceof Uint8Array
          ? input
          : ArrayBuffer.isView(input)
            ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
            : new Uint8Array(input);
      let out = '';
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i++];
        let cp: number;
        if (b < 0x80) cp = b;
        else if (b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        else if (b < 0xf0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else
          cp =
            ((b & 0x07) << 18) |
            ((bytes[i++] & 0x3f) << 12) |
            ((bytes[i++] & 0x3f) << 6) |
            (bytes[i++] & 0x3f);
        out += String.fromCodePoint(cp);
      }
      return out;
    }
  }
  (globalThis as unknown as { TextDecoder: unknown }).TextDecoder = Utf8Decoder;
}
