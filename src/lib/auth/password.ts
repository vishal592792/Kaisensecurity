/**
 * Password Hashing & Verification with Argon2id
 */

import * as argon2 from '@node-rs/argon2';
import crypto from 'crypto';

export async function hashPassword(plainText: string): Promise<string> {
  return await argon2.hash(plainText, {
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
    algorithm: 2, // Algorithm.Argon2id = 2 (const enum safe under isolatedModules)
  });
}

export async function verifyPassword(hash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch (err) {
    return false;
  }
}

/**
 * Generate cryptographically strong random token
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Securely hash tokens (for reset tokens, recovery codes, refresh tokens)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
