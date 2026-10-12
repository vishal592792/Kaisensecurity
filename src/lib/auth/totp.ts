/**
 * RFC 6238 Time-based One-Time Password (TOTP) & Recovery Codes
 */

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hashToken } from './password';

export interface TotpSetupResult {
  secret: string;
  uri: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
  hashedRecoveryCodes: string[];
}

/**
 * Generate a new TOTP secret, authenticator URI, QR code, and 8 recovery codes
 */
export async function generateTotpSetup(
  adminUsername: string,
  issuer = 'Kaisen SECURE ADMIN'
): Promise<TotpSetupResult> {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: adminUsername,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 })
  });

  const secret = totp.secret.base32;
  const uri = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#00f0ff',
      light: '#0a0f1d'
    }
  });

  // Generate 8 cryptographically secure recovery codes
  const recoveryCodes: string[] = [];
  const hashedRecoveryCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const rawCode = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    const formatted = `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`;
    recoveryCodes.push(formatted);
    hashedRecoveryCodes.push(hashToken(formatted));
  }

  return {
    secret,
    uri,
    qrCodeDataUrl,
    recoveryCodes,
    hashedRecoveryCodes
  };
}

/**
 * Verify a 6-digit TOTP code
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: 'Kaisen SECURE ADMIN',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    const delta = totp.validate({
      token: token.trim(),
      window: 1 // ±30s drift tolerance
    });

    return delta !== null;
  } catch (err) {
    return false;
  }
}

/**
 * Verify a recovery code and return remaining hashed codes if valid
 */
export function verifyAndConsumeRecoveryCode(
  providedCode: string,
  hashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const targetHash = hashToken(providedCode.trim().toUpperCase());
  const index = hashedCodes.findIndex((h) => h === targetHash);

  if (index === -1) {
    return { valid: false, remainingHashedCodes: hashedCodes };
  }

  const remaining = [...hashedCodes];
  remaining.splice(index, 1);
  return { valid: true, remainingHashedCodes: remaining };
}
