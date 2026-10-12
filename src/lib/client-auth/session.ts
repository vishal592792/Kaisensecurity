/**
 * Client Session Management, Access Token Issuance, and Refresh Token Rotation
 */

import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { query } from '../db';
import { APP_CONFIG } from '../config/env';
import { hashToken } from '../auth/password';

const CLIENT_JWT_SECRET = new TextEncoder().encode(APP_CONFIG.security.jwtSecret);

export interface ClientSessionResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  sessionId: string;
}

/**
 * Issue new access and refresh token pair
 */
export async function issueClientSession(params: {
  keyId: string;
  deviceId: string;
  userId: string;
}): Promise<ClientSessionResult> {
  const sessionId = `csess_${crypto.randomBytes(16).toString('hex')}`;
  const accessTokenJti = `jti_${crypto.randomBytes(16).toString('hex')}`;
  const rawRefreshToken = `rt_${crypto.randomBytes(32).toString('hex')}`;
  const refreshTokenHash = hashToken(rawRefreshToken);
  const familyId = `fam_${crypto.randomBytes(12).toString('hex')}`;

  const accessLifetimeMins = APP_CONFIG.security.clientAccessTokenLifetimeMinutes;
  const refreshLifetimeDays = APP_CONFIG.security.clientRefreshTokenLifetimeDays;

  const sessionExpiresAt = new Date(Date.now() + accessLifetimeMins * 60 * 1000);
  const refreshExpiresAt = new Date(Date.now() + refreshLifetimeDays * 86400 * 1000);

  // 1. Create client session in DB
  await query(
    `INSERT INTO client_sessions (
      id, key_id, device_id, user_id, access_token_jti, status, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, 'active', $6, CURRENT_TIMESTAMP)`,
    [sessionId, params.keyId, params.deviceId, params.userId, accessTokenJti, sessionExpiresAt]
  );

  // 2. Create refresh token record
  const rtId = `rt_id_${crypto.randomBytes(12).toString('hex')}`;
  await query(
    `INSERT INTO refresh_tokens (
      id, session_id, token_hash, family_id, is_revoked, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, false, $5, CURRENT_TIMESTAMP)`,
    [rtId, sessionId, refreshTokenHash, familyId, refreshExpiresAt]
  );

  // 3. Create short-lived Access JWT (15 mins)
  const accessToken = await new SignJWT({
    sub: params.userId,
    kid: params.keyId,
    dev: params.deviceId,
    sid: sessionId,
    jti: accessTokenJti,
    type: 'client_access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('kaisen-client-auth')
    .setAudience('kaisen-client-api')
    .setExpirationTime(`${accessLifetimeMins}m`)
    .sign(CLIENT_JWT_SECRET);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: accessLifetimeMins * 60,
    tokenType: 'Bearer',
    sessionId
  };
}

/**
 * Refresh Token Rotation with automatic reuse detection
 */
export async function rotateRefreshToken(rawRefreshToken: string): Promise<{
  success: boolean;
  session?: ClientSessionResult;
  error?: string;
}> {
  const tokenHash = hashToken(rawRefreshToken.trim());

  // Locate the refresh token
  const rtRes = await query(
    `SELECT rt.*, cs.key_id, cs.device_id, cs.user_id, cs.status as session_status
     FROM refresh_tokens rt
     JOIN client_sessions cs ON rt.session_id = cs.id
     WHERE rt.token_hash = $1 LIMIT 1`,
    [tokenHash]
  );

  if (rtRes.rows.length === 0) {
    return { success: false, error: 'Invalid refresh token.' };
  }

  const existingToken = rtRes.rows[0];

  // Token reuse detection: if a revoked refresh token is presented again!
  if (existingToken.is_revoked) {
    // Invalidate entire family and revoke session immediately!
    await query(`UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1`, [existingToken.family_id]);
    await query(`UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [existingToken.session_id]);

    // Record high-severity integrity alert
    await query(
      `INSERT INTO integrity_events (
        id, category, severity, key_id, user_id, device_id, details, resolution_status
      ) VALUES ($1, 'REFRESH_TOKEN_REUSE_DETECTED', 'CRITICAL', $2, $3, $4, $5, 'NEW')`,
      [
        `evt_${crypto.randomBytes(12).toString('hex')}`,
        existingToken.key_id,
        existingToken.user_id,
        existingToken.device_id,
        JSON.stringify({ familyId: existingToken.family_id, reason: 'Reuse of revoked refresh token detected' })
      ]
    );

    return {
      success: false,
      error: 'Security alert: Refresh token reuse detected. Session has been revoked.'
    };
  }

  // Check if expired
  if (new Date(existingToken.expires_at) < new Date()) {
    return { success: false, error: 'Refresh token has expired. Reauthentication required.' };
  }

  // Check key and user status
  const keyCheck = await query(`SELECT status FROM api_keys WHERE id = $1`, [existingToken.key_id]);
  if (keyCheck.rows.length === 0 || keyCheck.rows[0].status !== 'active') {
    return { success: false, error: 'Associated API key is no longer active.' };
  }

  const userCheck = await query(`SELECT status FROM users WHERE id = $1`, [existingToken.user_id]);
  if (userCheck.rows.length === 0 || userCheck.rows[0].status !== 'active') {
    return { success: false, error: 'User account has been suspended.' };
  }

  const devCheck = await query(`SELECT status FROM devices WHERE id = $1`, [existingToken.device_id]);
  if (devCheck.rows.length === 0 || devCheck.rows[0].status !== 'registered') {
    return { success: false, error: 'Device access has been revoked.' };
  }

  // Mark current refresh token as revoked (used)
  await query(`UPDATE refresh_tokens SET is_revoked = true WHERE id = $1`, [existingToken.id]);

  // Issue new pair in the same token family
  const accessLifetimeMins = APP_CONFIG.security.clientAccessTokenLifetimeMinutes;
  const refreshLifetimeDays = APP_CONFIG.security.clientRefreshTokenLifetimeDays;
  const newRawRefreshToken = `rt_${crypto.randomBytes(32).toString('hex')}`;
  const newRtHash = hashToken(newRawRefreshToken);
  const newRtId = `rt_id_${crypto.randomBytes(12).toString('hex')}`;
  const refreshExpiresAt = new Date(Date.now() + refreshLifetimeDays * 86400 * 1000);

  await query(
    `INSERT INTO refresh_tokens (
      id, session_id, token_hash, family_id, is_revoked, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, false, $5, CURRENT_TIMESTAMP)`,
    [newRtId, existingToken.session_id, newRtHash, existingToken.family_id, refreshExpiresAt]
  );

  const accessTokenJti = `jti_${crypto.randomBytes(16).toString('hex')}`;
  const accessToken = await new SignJWT({
    sub: existingToken.user_id,
    kid: existingToken.key_id,
    dev: existingToken.device_id,
    sid: existingToken.session_id,
    jti: accessTokenJti,
    type: 'client_access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('kaisen-client-auth')
    .setAudience('kaisen-client-api')
    .setExpirationTime(`${accessLifetimeMins}m`)
    .sign(CLIENT_JWT_SECRET);

  return {
    success: true,
    session: {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: accessLifetimeMins * 60,
      tokenType: 'Bearer',
      sessionId: existingToken.session_id
    }
  };
}

/**
 * Verify client access token & enforce real-time server revocation
 */
export async function verifyClientAccessToken(req: Request): Promise<{
  valid: boolean;
  userId?: string;
  keyId?: string;
  deviceId?: string;
  sessionId?: string;
  error?: string;
}> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or malformed Authorization header.' };
  }

  const token = authHeader.substring(7).trim();

  try {
    const { payload } = await jwtVerify(token, CLIENT_JWT_SECRET, {
      issuer: 'kaisen-client-auth',
      audience: 'kaisen-client-api'
    });

    const userId = payload.sub as string;
    const keyId = payload.kid as string;
    const deviceId = payload.dev as string;
    const sessionId = payload.sid as string;

    if (!userId || !keyId || !deviceId || !sessionId) {
      return { valid: false, error: 'Token payload missing required claims.' };
    }

    // 1. Real-time server-controlled check on session
    const sessRes = await query(
      `SELECT status FROM client_sessions WHERE id = $1 AND status = 'active' LIMIT 1`,
      [sessionId]
    );
    if (sessRes.rows.length === 0) {
      return { valid: false, error: 'Session has been revoked or expired on the server.' };
    }

    // 2. Real-time check on API key status
    const keyRes = await query(
      `SELECT status, expires_at FROM api_keys WHERE id = $1 LIMIT 1`,
      [keyId]
    );
    if (keyRes.rows.length === 0 || keyRes.rows[0].status !== 'active') {
      return { valid: false, error: 'API key is revoked or suspended.' };
    }
    if (new Date(keyRes.rows[0].expires_at) < new Date()) {
      return { valid: false, error: 'API key has expired.' };
    }

    // 3. Real-time check on user status
    const userRes = await query(
      `SELECT status FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (userRes.rows.length === 0 || userRes.rows[0].status !== 'active') {
      return { valid: false, error: 'User account has been suspended.' };
    }

    // 4. Real-time check on device status
    const devRes = await query(
      `SELECT status FROM devices WHERE id = $1 LIMIT 1`,
      [deviceId]
    );
    if (devRes.rows.length === 0 || devRes.rows[0].status !== 'registered') {
      return { valid: false, error: 'Device registration revoked.' };
    }

    return {
      valid: true,
      userId,
      keyId,
      deviceId,
      sessionId
    };
  } catch (err: any) {
    return { valid: false, error: `Invalid access token: ${err.message}` };
  }
}
