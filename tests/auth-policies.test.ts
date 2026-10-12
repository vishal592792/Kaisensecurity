import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken } from '../src/lib/auth/password';
import { generateTotpSetup, verifyTotpToken, verifyAndConsumeRecoveryCode } from '../src/lib/auth/totp';
import { checkRateLimit, resetRateLimit } from '../src/lib/auth/rate-limiter';
import { requireRole, AdminUser } from '../src/lib/auth/admin-auth';
import * as OTPAuth from 'otpauth';

describe('Administrator Security & MFA Policies', () => {
  it('hashes passwords with Argon2id and verifies correctly', async () => {
    const rawPassword = 'SecureAdminSecret#2026!';
    const hash = await hashPassword(rawPassword);
    
    expect(hash).toContain('$argon2id$');
    const valid = await verifyPassword(hash, rawPassword);
    const invalid = await verifyPassword(hash, 'WrongPassword');
    
    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });

  it('generates valid TOTP secret, QR code, and backup recovery codes', async () => {
    const setup = await generateTotpSetup('superadmin');
    
    expect(setup.secret).toBeDefined();
    expect(setup.secret.length).toBeGreaterThan(16);
    expect(setup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setup.recoveryCodes).toHaveLength(8);
    expect(setup.hashedRecoveryCodes).toHaveLength(8);

    // Verify generated code matches TOTP
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(setup.secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    });
    const currentCode = totp.generate();
    expect(verifyTotpToken(setup.secret, currentCode)).toBe(true);
    expect(verifyTotpToken(setup.secret, '000000')).toBe(false);
  });

  it('consumes single-use recovery code and removes it from remaining list', async () => {
    const setup = await generateTotpSetup('analyst');
    const firstCode = setup.recoveryCodes[0];
    
    const result1 = verifyAndConsumeRecoveryCode(firstCode, setup.hashedRecoveryCodes);
    expect(result1.valid).toBe(true);
    expect(result1.remainingHashedCodes).toHaveLength(7);

    // Replay same code should fail
    const result2 = verifyAndConsumeRecoveryCode(firstCode, result1.remainingHashedCodes);
    expect(result2.valid).toBe(false);
  });

  it('enforces login rate limiting and window reset', () => {
    const testKey = 'test_ip_ratelimit_' + Date.now();
    resetRateLimit(testKey);

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(testKey, 5, 60);
      expect(res.allowed).toBe(true);
    }

    // 6th attempt is blocked
    const blocked = checkRateLimit(testKey, 5, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    // Reset works
    resetRateLimit(testKey);
    const afterReset = checkRateLimit(testKey, 5, 60);
    expect(afterReset.allowed).toBe(true);
  });

  it('strictly enforces role-based access control (RBAC)', () => {
    const superAdmin: AdminUser = {
      id: 'adm_1',
      username: 'super',
      email: 's@test.com',
      role: 'SUPER_ADMIN',
      isActive: true,
      mfaEnabled: true
    };

    const analyst: AdminUser = {
      id: 'adm_2',
      username: 'analyst',
      email: 'a@test.com',
      role: 'READ_ONLY_ANALYST',
      isActive: true,
      mfaEnabled: true
    };

    expect(requireRole(superAdmin, ['SUPER_ADMIN'])).toBe(true);
    expect(requireRole(superAdmin, ['SUPER_ADMIN', 'SECURITY_ADMIN'])).toBe(true);
    expect(requireRole(analyst, ['SUPER_ADMIN', 'SECURITY_ADMIN'])).toBe(false);
    expect(requireRole(analyst, ['READ_ONLY_ANALYST'])).toBe(true);
  });
});
