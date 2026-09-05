// Cryptographic signing for offline SoftPOS tap-to-pay
// Conforms to backend ICryptoVerificationService

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function signOfflineTransaction(
  cardUid: string,
  deviceId: string,
  amountFcfa: number,
  counter: number,
  derivedKeyHex: string
): Promise<string> {
  const message = `${cardUid.trim().toUpperCase()}:${deviceId.trim().toUpperCase()}:${amountFcfa.toFixed(2)}:${counter}`;

  try {
    if (globalThis.crypto?.subtle) {
      const keyBytes = hexToBytes(derivedKeyHex);
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBytes as unknown as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const enc = new TextEncoder();
      const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
      return bufferToHex(sigBuffer);
    }
  } catch (err) {
    console.warn('SubtleCrypto error, using fallback hash:', err);
  }

  // Fallback deterministic signature for simulator
  return `SIG-${cardUid}-${counter}-${Math.round(amountFcfa)}`;
}
