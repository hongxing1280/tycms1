import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 20): string {
  const bytes = randomBytes(length);
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    output += alphabet[parseInt(chunk, 2)];
  }
  return output;
}

export function verifyTotpCode(input: { code?: string | null; secret?: string | null; now?: number; window?: number }): boolean {
  const code = normalizeTotpCode(input.code);
  const secret = normalizeTotpSecret(input.secret);
  if (!code || !secret) {
    return false;
  }

  const now = input.now ?? Date.now();
  const window = input.window ?? 1;
  const counter = Math.floor(now / 1000 / 30);
  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqual(code, generateTotpCode(secret, counter + offset))) {
      return true;
    }
  }
  return false;
}

export function createTotpCode(secret: string, now = Date.now()): string {
  return generateTotpCode(normalizeTotpSecret(secret), Math.floor(now / 1000 / 30));
}

export function normalizeTotpSecret(secret?: string | null): string {
  return (secret ?? '').replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase();
}

function normalizeTotpCode(code?: string | null): string {
  return (code ?? '').replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);
}

function generateTotpCode(secret: string, counter: number): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function decodeBase32(secret: string): Buffer {
  let bits = '';
  for (const char of secret) {
    const value = alphabet.indexOf(char);
    if (value < 0) {
      throw new Error('Invalid TOTP secret.');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
