/**
 * crockfordBase32.ts
 * ------------------
 * Encoder/Decoder für Crockford-Base32-Strings, wie sie von GNU Taler
 * für Ed25519-Public-Keys, Reserve-Publics und Coin-Publics verwendet werden.
 *
 * Eigenschaften (per Crockford Spec, http://www.crockford.com/base32.html):
 *   - Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ (kein I, L, O, U)
 *   - Kein Padding (=)
 *   - Case-insensitive (wir erlauben lower/upper und normalisieren)
 *
 * Taler serialisiert Ed25519-Public-Keys (32 Bytes) als low-case Crockford-Base32.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODE_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  DECODE_MAP[ALPHABET[i]] = i;
}
// Visuell verwechselbare Zeichen zulassen, aber auf den kanonischen Wert mappen
DECODE_MAP['O'] = 0;
DECODE_MAP['I'] = 1;
DECODE_MAP['L'] = 1;

/**
 * Kodiert ein Uint8Array zu low-case Crockford-Base32 (kein Padding).
 * Beispiel: encode(new Uint8Array([0xAB,0xCD])) → "40pn"
 */
export function crockfordEncode(input: Uint8Array): string {
  if (!(input instanceof Uint8Array)) {
    throw new TypeError('crockfordEncode expects Uint8Array');
  }
  // RFC4648-Base32 decodieren in 5-bit-Chunks, dann in Crockford-Alphabet transliterieren
  // Wir nutzen eine eigene Bitschleife, weil Node-Buffer keine direkte Base32-Encoder hat
  // und wir die alphabet-Substitution (Crockford) brauchen.

  // 5-bit-Strom aus dem Byte-Strom aufbauen
  const out: string[] = [];
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < input.length; i++) {
    buffer = (buffer << 8) | input[i];
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      const idx = (buffer >> bitsInBuffer) & 0x1f;
      out.push(ALPHABET[idx]);
    }
  }
  if (bitsInBuffer > 0) {
    const idx = (buffer << (5 - bitsInBuffer)) & 0x1f;
    out.push(ALPHABET[idx]);
  }

  return out.join('').toLowerCase();
}

/**
 * Dekodiert einen Crockford-Base32-String (case-insensitive) zu einem Uint8Array.
 * Whitespace und '-' werden toleriert (visuelle Trenner).
 */
export function crockfordDecode(input: string): Uint8Array {
  if (typeof input !== 'string') {
    throw new TypeError('crockfordDecode expects string');
  }
  const normalized = input.replace(/[\s\-=]/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const ch of normalized) {
    const v = DECODE_MAP[ch];
    if (v === undefined) {
      throw new Error(`crockfordDecode: invalid character '${ch}'`);
    }
    buffer = (buffer << 5) | v;
    bitsInBuffer += 5;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes.push((buffer >> bitsInBuffer) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/** Convenience: 32-Byte Ed25519-Public → Crockford-Base32 (Taler-Format). */
export function ed25519PubToCrockford(pubDerOrRaw: Buffer | Uint8Array): string {
  // Akzeptiert entweder rohe 32 Bytes oder SPKI-DER (12-byte Header + 32-byte raw);
  // SPKI-DER beginnt typischerweise mit 0x30 0x2A 0x30 ... und enthält 0x06 0x03 0x2B 0x65 0x70.
  if (pubDerOrRaw.length === 32) {
    return crockfordEncode(pubDerOrRaw);
  }
  // SPKI-Header (12 Bytes) überspringen
  if (pubDerOrRaw.length === 44 && pubDerOrRaw[0] === 0x30 && pubDerOrRaw[2] === 0x30) {
    return crockfordEncode(pubDerOrRaw.subarray(12));
  }
  throw new Error(`ed25519PubToCrockford: unexpected key length ${pubDerOrRaw.length}`);
}
