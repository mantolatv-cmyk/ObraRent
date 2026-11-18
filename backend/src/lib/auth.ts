import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

const AUTH_SECRET = process.env.AUTH_SECRET || env.GATEWAY_WEBHOOK_TOKEN || 'mantovani-rental-auth-secret-key-2026';

export interface TokenPayload {
  clientId: string;
  cnpj: string;
  issuedAt: number;
}

/**
 * Hashes a plaintext password using standard scrypt (recommended by OWASP).
 * Format: `<salt_hex>:<derived_key_hex>`
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Validates a plaintext password against the stored scrypt hash in constant time.
 */
export function verifyPassword(password: string, combinedHash: string | null | undefined): boolean {
  if (!combinedHash || !combinedHash.includes(':')) {
    return false;
  }
  const [salt, key] = combinedHash.split(':');
  if (!salt || !key) return false;

  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generates a signed HMAC-SHA256 session token with 30-day validity.
 */
export function createAuthToken(payload: { clientId: string; cnpj: string }): string {
  const fullPayload: TokenPayload = {
    ...payload,
    issuedAt: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Verifies and decodes a signed HMAC-SHA256 session token.
 */
export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  try {
    const expectedSig = createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    // Expire after 30 days
    if (Date.now() - payload.issuedAt > 30 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
