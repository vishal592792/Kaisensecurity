/**
 * API-Key Cryptographic Generation, Hashing, and Constant-time Verification
 * Storage: Only keyed HMAC-SHA256 verifier is stored. Never raw keys.
 */

import crypto from 'crypto';
import { APP_CONFIG } from '../config/env';

export interface GeneratedKeyData {
  keyId: string;
  rawKey: string;
  maskedKey: string;
  keyHmac: string;
}

/**
 * Compute HMAC-SHA256 of raw API key using the server-side HMAC secret
 */
export function computeKeyHmac(rawKey: string): string {
  return crypto
    .createHmac('sha256', APP_CONFIG.security.apiKeyHmacSecret)
    .update(rawKey.trim())
    .digest('hex');
}

/**
 * Verify a raw API key against a stored HMAC using constant-time comparison
 */
export function verifyKeyHmac(rawKey: string, storedHmac: string): boolean {
  try {
    const computed = computeKeyHmac(rawKey);
    const bufComputed = Buffer.from(computed, 'hex');
    const bufStored = Buffer.from(storedHmac, 'hex');

    if (bufComputed.length !== bufStored.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufComputed, bufStored);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cryptographically secure API key with high entropy
 * Prefix: ksk_live_
 */
export function generateApiKey(prefix = 'ksk_live_'): GeneratedKeyData {
  // 32 random bytes (256-bit entropy)
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const rawKey = `${prefix}${randomEntropy}`;
  
  // Unique database identifier: ksk_id_<16_hex>
  const keyId = `ksk_id_${crypto.randomBytes(8).toString('hex')}`;

  // Masked representation for safe UI display (first 9 chars + •••••••• + last 4 chars)
  const lastFour = rawKey.slice(-4);
  const maskedKey = `${prefix}••••••••••••${lastFour}`;

  // Compute server-side keyed HMAC
  const keyHmac = computeKeyHmac(rawKey);

  return {
    keyId,
    rawKey,
    maskedKey,
    keyHmac
  };
}
