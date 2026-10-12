import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { query, runMigrations } from '../src/lib/db';
import { generateApiKey } from '../src/lib/client-auth/keys';
import { issueClientSession, rotateRefreshToken, verifyClientAccessToken } from '../src/lib/client-auth/session';
import { logAuditEvent } from '../src/lib/audit/logger';

describe('End-to-End Security & Integration Lifecycle', () => {
  const testUserId = `usr_test_${crypto.randomBytes(6).toString('hex')}`;
  const testKeyId = `ksk_test_${crypto.randomBytes(6).toString('hex')}`;
  const testDeviceId = `dev_test_${crypto.randomBytes(6).toString('hex')}`;
  let generatedKey: ReturnType<typeof generateApiKey>;

  beforeAll(async () => {
    await runMigrations();

    // 1. Create a test user
    await query(
      `INSERT INTO users (id, name, label, email, status, created_at, updated_at)
       VALUES ($1, 'FinSec QA Partner', 'Test Tenant', 'qa@finsec.test', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [testUserId]
    );

    // 2. Administrator provisions an API Key
    generatedKey = generateApiKey('ksk_live_');
    const expiresAt = new Date(Date.now() + 30 * 86400 * 1000); // 30 days

    await query(
      `INSERT INTO api_keys (
        id, user_id, key_prefix, masked_key, key_hmac, status, device_limit,
        device_binding_enabled, scan_quota_daily, rate_limit_per_minute,
        expires_at, created_at, internal_note
      ) VALUES ($1, $2, 'ksk_live_', $3, $4, 'active', 2, true, 50, 30, $5, CURRENT_TIMESTAMP, 'Integration test key')`,
      [testKeyId, testUserId, generatedKey.maskedKey, generatedKey.keyHmac, expiresAt]
    );

    await logAuditEvent({
      actorId: 'adm_test_provisioner',
      actorEmail: 'admin@kaisensecurity.com',
      action: 'API_KEY_CREATED',
      targetType: 'api_key',
      targetId: testKeyId,
      outcome: 'SUCCESS'
    });
  });

  it('provisions key without storing raw plaintext in database', async () => {
    const dbKey = await query(`SELECT * FROM api_keys WHERE id = $1`, [testKeyId]);
    expect(dbKey.rows).toHaveLength(1);
    
    // Key in DB must NOT match raw key
    expect(dbKey.rows[0].key_hmac).not.toBe(generatedKey.rawKey);
    expect(dbKey.rows[0].masked_key).toContain('••••');
    expect(dbKey.rows[0].status).toBe('active');
  });

  it('registers device and issues short-lived session with token rotation', async () => {
    // Register device
    await query(
      `INSERT INTO devices (
        id, user_id, key_id, app_installation_id, app_version, android_version,
        status, integrity_status, first_seen_at, last_seen_at
      ) VALUES ($1, $2, $3, 'app_inst_unit_test_99', '1.2.0', '14.0', 'registered', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [testDeviceId, testUserId, testKeyId]
    );

    // Issue session
    const session = await issueClientSession({
      keyId: testKeyId,
      deviceId: testDeviceId,
      userId: testUserId
    });

    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toMatch(/^rt_[a-f0-9]{64}$/);
    expect(session.tokenType).toBe('Bearer');
    expect(session.expiresIn).toBe(15 * 60);

    // Verify access token with mocked Request header
    const mockReq = new Request('https://api.kaisensecurity.com/api/v1/scans', {
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });

    const verifyResult = await verifyClientAccessToken(mockReq);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.userId).toBe(testUserId);
    expect(verifyResult.keyId).toBe(testKeyId);
    expect(verifyResult.deviceId).toBe(testDeviceId);

    // Rotate refresh token
    const rotation = await rotateRefreshToken(session.refreshToken);
    expect(rotation.success).toBe(true);
    expect(rotation.session?.refreshToken).not.toBe(session.refreshToken);

    // Token reuse detection: Re-using old refresh token must fail and revoke family
    const replayed = await rotateRefreshToken(session.refreshToken);
    expect(replayed.success).toBe(false);
    expect(replayed.error).toContain('reuse detected');
  });

  it('immediately blocks protected access when user account is suspended', async () => {
    // Issue fresh session
    const session = await issueClientSession({
      keyId: testKeyId,
      deviceId: testDeviceId,
      userId: testUserId
    });

    // Suspend user
    await query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [testUserId]);

    const mockReq = new Request('https://api.kaisensecurity.com/api/v1/scans', {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });

    const verifyResult = await verifyClientAccessToken(mockReq);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.error).toContain('User account has been suspended');

    // Restore user
    await query(`UPDATE users SET status = 'active' WHERE id = $1`, [testUserId]);
  });

  it('immediately blocks protected access when device is revoked', async () => {
    const session = await issueClientSession({
      keyId: testKeyId,
      deviceId: testDeviceId,
      userId: testUserId
    });

    // Revoke device
    await query(`UPDATE devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [testDeviceId]);

    const mockReq = new Request('https://api.kaisensecurity.com/api/v1/scans', {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });

    const verifyResult = await verifyClientAccessToken(mockReq);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.error).toContain('Device registration revoked');

    // Restore device
    await query(`UPDATE devices SET status = 'registered', revoked_at = NULL WHERE id = $1`, [testDeviceId]);
  });

  it('immediately blocks protected access when API key is revoked or suspended', async () => {
    const session = await issueClientSession({
      keyId: testKeyId,
      deviceId: testDeviceId,
      userId: testUserId
    });

    // Suspend key
    await query(`UPDATE api_keys SET status = 'suspended' WHERE id = $1`, [testKeyId]);

    const mockReq = new Request('https://api.kaisensecurity.com/api/v1/scans', {
      headers: { authorization: `Bearer ${session.accessToken}` }
    });

    const verifyResult = await verifyClientAccessToken(mockReq);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.error).toContain('API key is revoked or suspended');

    // Revoke key permanently
    await query(`UPDATE api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [testKeyId]);
    const verifyRevoked = await verifyClientAccessToken(mockReq);
    expect(verifyRevoked.valid).toBe(false);
  });
});
