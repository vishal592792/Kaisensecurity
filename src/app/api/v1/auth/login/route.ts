/**
 * Client Authentication Endpoint
 * POST /api/v1/auth/login
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { query } from '@/lib/db';
import { computeKeyHmac, verifyKeyHmac } from '@/lib/client-auth/keys';
import { evaluateAppIntegrity } from '@/lib/client-auth/integrity';
import { issueClientSession } from '@/lib/client-auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limiter';

const LoginSchema = z.object({
  apiKey: z.string().min(16).max(128),
  deviceId: z.string().min(6).max(128),
  appVersion: z.string().min(1).max(32),
  integrityToken: z.string().max(4096).optional(),
  androidVersion: z.string().max(32).optional()
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = LoginSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return errorResponse('Invalid login request payload format', 400, 'ERR_INVALID_SCHEMA');
    }

    const { apiKey, deviceId, appVersion, integrityToken, androidVersion } = parseResult.data;
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'VishalSecureScan-Android';

    // 1. IP Rate Limiting: 60 attempts/minute
    const ipLimit = checkRateLimit(`auth_ip_${ipAddress}`, 60, 60);
    if (!ipLimit.allowed) {
      return errorResponse('Rate limit exceeded. Too many login attempts.', 429, 'ERR_RATE_LIMITED');
    }

    // 2. Locate Key Record via HMAC verifier
    const suppliedHmac = computeKeyHmac(apiKey);
    const keyRes = await query(
      `SELECT k.*, u.status as user_status, u.id as user_id, u.name as user_name
       FROM api_keys k
       JOIN users u ON k.user_id = u.id
       WHERE k.key_hmac = $1 LIMIT 1`,
      [suppliedHmac]
    );

    if (keyRes.rows.length === 0) {
      // Record failed authentication attempt and security event
      const eventId = `auth_fail_${crypto.randomBytes(8).toString('hex')}`;
      await query(
        `INSERT INTO authentication_events (
          id, event_type, ip_address, user_agent, failure_reason, timestamp
        ) VALUES ($1, 'KEY_INVALID', $2, $3, 'API Key HMAC mismatch', CURRENT_TIMESTAMP)`,
        [eventId, ipAddress, userAgent]
      );

      await query(
        `INSERT INTO integrity_events (
          id, category, severity, app_version, safe_ip, details, resolution_status
        ) VALUES ($1, 'INVALID_API_KEY', 'LOW', $2, $3, $4, 'NEW')`,
        [
          `evt_${crypto.randomBytes(10).toString('hex')}`,
          appVersion,
          ipAddress,
          JSON.stringify({ reason: 'Invalid or unknown API key presented' })
        ]
      );

      return errorResponse('Invalid API key credentials provided.', 401, 'ERR_INVALID_CREDENTIALS');
    }

    const key = keyRes.rows[0];

    // Constant-time HMAC comparison
    if (!verifyKeyHmac(apiKey, key.key_hmac)) {
      return errorResponse('Invalid API key credentials provided.', 401, 'ERR_INVALID_CREDENTIALS');
    }

    // 3. Status and Expiry Checks
    if (key.status === 'revoked') {
      await recordAuthFailure(key.id, key.user_id, 'KEY_REVOKED', 'Key is revoked', ipAddress, userAgent);
      return errorResponse('This API key has been permanently revoked.', 403, 'ERR_KEY_REVOKED');
    }

    if (key.status === 'suspended') {
      await recordAuthFailure(key.id, key.user_id, 'KEY_SUSPENDED', 'Key is suspended', ipAddress, userAgent);
      return errorResponse('This API key has been suspended. Contact support.', 403, 'ERR_KEY_SUSPENDED');
    }

    if (key.status !== 'active' || new Date(key.expires_at) < new Date()) {
      await recordAuthFailure(key.id, key.user_id, 'KEY_EXPIRED', 'Key has expired', ipAddress, userAgent);
      return errorResponse('This API key has expired.', 403, 'ERR_KEY_EXPIRED');
    }

    // 4. User Status Check
    if (key.user_status !== 'active') {
      await recordAuthFailure(key.id, key.user_id, 'USER_SUSPENDED', 'User account suspended', ipAddress, userAgent);
      return errorResponse('The organization account associated with this key is suspended.', 403, 'ERR_USER_SUSPENDED');
    }

    // 5. Device Binding and Device Limit Enforcement
    let deviceRecordId = '';
    const existingDev = await query(
      `SELECT id, status FROM devices WHERE key_id = $1 AND app_installation_id = $2 LIMIT 1`,
      [key.id, deviceId]
    );

    if (existingDev.rows.length > 0) {
      if (existingDev.rows[0].status === 'revoked') {
        await recordAuthFailure(key.id, key.user_id, 'DEVICE_REVOKED', 'Device has been revoked', ipAddress, userAgent, existingDev.rows[0].id);
        return errorResponse('This device installation has been revoked by an administrator.', 403, 'ERR_DEVICE_REVOKED');
      }
      deviceRecordId = existingDev.rows[0].id;
      // Update last seen
      await query(
        `UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP, app_version = $1, android_version = $2, last_ip = $3 WHERE id = $4`,
        [appVersion, androidVersion || null, ipAddress, deviceRecordId]
      );
    } else {
      // Check device limits
      const countRes = await query(
        `SELECT COUNT(*) as count FROM devices WHERE key_id = $1 AND status = 'registered'`,
        [key.id]
      );
      const activeDeviceCount = parseInt(countRes.rows[0].count, 10);

      if (activeDeviceCount >= key.device_limit) {
        await query(
          `INSERT INTO integrity_events (
            id, category, severity, key_id, user_id, app_version, safe_ip, details, resolution_status
          ) VALUES ($1, 'DEVICE_LIMIT_VIOLATION', 'HIGH', $2, $3, $4, $5, $6, 'NEW')`,
          [
            `evt_${crypto.randomBytes(10).toString('hex')}`,
            key.id,
            key.user_id,
            appVersion,
            ipAddress,
            JSON.stringify({ deviceLimit: key.device_limit, attemptedDeviceId: deviceId })
          ]
        );
        return errorResponse(`Device registration limit exceeded (${key.device_limit} max registered devices allowed).`, 403, 'ERR_DEVICE_LIMIT_EXCEEDED');
      }

      // Register new device
      deviceRecordId = `dev_${crypto.randomBytes(10).toString('hex')}`;
      await query(
        `INSERT INTO devices (
          id, user_id, key_id, app_installation_id, app_version, android_version,
          status, integrity_status, first_seen_at, last_seen_at, last_ip
        ) VALUES ($1, $2, $3, $4, $5, $6, 'registered', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $7)`,
        [deviceRecordId, key.user_id, key.id, deviceId, appVersion, androidVersion || null, ipAddress]
      );
    }

    // 6. Security Policy & App Integrity Evaluation
    const policyRes = await query(`SELECT * FROM security_policies WHERE id = 'policy_default' LIMIT 1`);
    const policy = policyRes.rows[0] || {
      integrity_policy: 'STRICT',
      min_supported_app_version: '1.0.0',
      maintenance_mode: false
    };

    if (policy.maintenance_mode) {
      return errorResponse('Kaisen Security platform is currently undergoing scheduled maintenance.', 503, 'ERR_MAINTENANCE_MODE');
    }

    const integrityVerdict = await evaluateAppIntegrity({
      appVersion,
      minSupportedVersion: policy.min_supported_app_version,
      integrityPolicy: policy.integrity_policy as any,
      integrityToken
    });

    if (!integrityVerdict.passed) {
      await query(
        `INSERT INTO integrity_events (
          id, category, severity, key_id, user_id, device_id, app_version, safe_ip, details, resolution_status
        ) VALUES ($1, 'FAILED_INTEGRITY_VERIFICATION', 'CRITICAL', $2, $3, $4, $5, $6, $7, 'NEW')`,
        [
          `evt_${crypto.randomBytes(10).toString('hex')}`,
          key.id,
          key.user_id,
          deviceRecordId,
          appVersion,
          ipAddress,
          JSON.stringify(integrityVerdict.details)
        ]
      );

      await query(`UPDATE devices SET integrity_status = 'FAILED' WHERE id = $1`, [deviceRecordId]);

      return errorResponse(`Device integrity verification failed: ${integrityVerdict.details.reason}`, 403, 'ERR_INTEGRITY_FAILED');
    }

    // 7. Issue Client Session and Tokens
    const session = await issueClientSession({
      keyId: key.id,
      deviceId: deviceRecordId,
      userId: key.user_id
    });

    // Update key last authenticated
    await query(`UPDATE api_keys SET last_authenticated_at = CURRENT_TIMESTAMP WHERE id = $1`, [key.id]);

    // Record success audit & auth event
    const authEventId = `auth_ok_${crypto.randomBytes(8).toString('hex')}`;
    await query(
      `INSERT INTO authentication_events (
        id, event_type, key_id, user_id, device_id, ip_address, user_agent, timestamp
      ) VALUES ($1, 'LOGIN_SUCCESS', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [authEventId, key.id, key.user_id, deviceRecordId, ipAddress, userAgent]
    );

    return jsonResponse({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      tokenType: session.tokenType,
      deviceId: deviceRecordId,
      keyId: key.id,
      integrityVerdict: integrityVerdict.verdict
    });
  } catch (error: any) {
    console.error('Login route error:', error);
    return errorResponse('Authentication service internal error', 500, 'ERR_INTERNAL_SERVER');
  }
}

async function recordAuthFailure(
  keyId: string,
  userId: string,
  eventType: string,
  reason: string,
  ip: string,
  ua: string,
  deviceId?: string
) {
  const id = `auth_fail_${crypto.randomBytes(8).toString('hex')}`;
  await query(
    `INSERT INTO authentication_events (
      id, event_type, key_id, user_id, device_id, ip_address, user_agent, failure_reason, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
    [id, eventType, keyId, userId, deviceId || null, ip, ua, reason]
  );
}
