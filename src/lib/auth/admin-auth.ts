/**
 * Administrator Authentication & Session Management
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { query } from '../db';
import { APP_CONFIG } from '../config/env';
import { verifyPassword, hashToken, hashPassword } from './password';
import { verifyTotpToken, verifyAndConsumeRecoveryCode } from './totp';
import { checkRateLimit, resetRateLimit } from './rate-limiter';
import { logAuditEvent } from '../audit/logger';

export type AdminRole = 'SUPER_ADMIN' | 'SECURITY_ADMIN' | 'READ_ONLY_ANALYST';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled: boolean;
  sessionId?: string;
}

const JWT_SECRET = new TextEncoder().encode(APP_CONFIG.security.jwtSecret);
const COOKIE_NAME = 'kaisen_admin_session';

/**
 * Generate a signed session JWT
 */
export async function createAdminSessionToken(adminId: string, sessionId: string, role: string): Promise<string> {
  return await new SignJWT({
    sub: adminId,
    sid: sessionId,
    role,
    type: 'admin_session'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('kaisen-admin-auth')
    .setAudience('kaisen-admin-panel')
    .setExpirationTime(`${APP_CONFIG.security.adminSessionDurationHours}h`)
    .sign(JWT_SECRET);
}

/**
 * Generate a short-lived temp token for MFA stage
 */
export async function createMfaTempToken(adminId: string): Promise<string> {
  return await new SignJWT({
    sub: adminId,
    type: 'admin_mfa_challenge'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('kaisen-admin-auth')
    .setExpirationTime('5m')
    .sign(JWT_SECRET);
}

/**
 * Verify temp MFA token
 */
export async function verifyMfaTempToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'kaisen-admin-auth',
    });
    if (payload.type !== 'admin_mfa_challenge' || !payload.sub) return null;
    return payload.sub as string;
  } catch (err) {
    return null;
  }
}

/**
 * Authenticate admin with username and password (Stage 1)
 */
export async function authenticateAdminPassword(
  identifier: string,
  plainPassword: string,
  ipAddress = 'unknown',
  userAgent = 'unknown'
): Promise<{
  success: boolean;
  error?: string;
  requiresMfa?: boolean;
  tempMfaToken?: string;
  admin?: AdminUser;
  sessionToken?: string;
}> {
  // Rate limiting check: 5 attempts per 15 minutes per IP/identifier
  const rateLimitKey = `admin_login_${ipAddress}_${identifier.toLowerCase()}`;
  const rateLimit = checkRateLimit(rateLimitKey, APP_CONFIG.security.maxFailedLoginAttempts, 900);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. Please wait ${rateLimit.resetSeconds} seconds before trying again.`
    };
  }

  // Lookup admin
  const res = await query(
    `SELECT * FROM administrators WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1`,
    [identifier.trim()]
  );

  if (res.rows.length === 0) {
    await logAuditEvent({
      actorId: 'anonymous',
      actorEmail: identifier,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'admin_account',
      targetId: 'none',
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      details: { reason: 'User not found' }
    });
    return { success: false, error: 'Invalid username or password.' };
  }

  const admin = res.rows[0];

  // Check lockout
  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    const remainingMins = Math.ceil((new Date(admin.locked_until).getTime() - Date.now()) / 60000);
    return {
      success: false,
      error: `Account is temporarily locked due to security policy. Try again in ${remainingMins} minute(s).`
    };
  }

  if (!admin.is_active) {
    return { success: false, error: 'Account is deactivated. Contact the Super Administrator.' };
  }

  // Verify password using Argon2id
  const isMatch = await verifyPassword(admin.password_hash, plainPassword);
  if (!isMatch) {
    const failedAttempts = admin.failed_login_attempts + 1;
    let lockoutSql = '';
    const params: any[] = [failedAttempts, admin.id];

    if (failedAttempts >= APP_CONFIG.security.maxFailedLoginAttempts) {
      const lockUntil = new Date(Date.now() + APP_CONFIG.security.lockoutDurationMinutes * 60000);
      lockoutSql = `, locked_until = $3`;
      params.splice(2, 0, lockUntil);
    }

    await query(
      `UPDATE administrators SET failed_login_attempts = $1 ${lockoutSql}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`,
      params
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'administrator',
      targetId: admin.id,
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      details: { failedAttempts }
    });

    return { success: false, error: 'Invalid username or password.' };
  }

  // If MFA is enabled or required for privileged accounts
  // Requirement: "Mandatory MFA for privileged administrator accounts"
  if (admin.mfa_enabled) {
    const tempMfaToken = await createMfaTempToken(admin.id);
    return {
      success: true,
      requiresMfa: true,
      tempMfaToken
    };
  }

  // If MFA not yet set up for this admin, create session and flag for mandatory setup
  resetRateLimit(rateLimitKey);
  const sessionResult = await issueAdminSession(admin, ipAddress, userAgent);

  return {
    success: true,
    requiresMfa: false,
    admin: sessionResult.admin,
    sessionToken: sessionResult.sessionToken
  };
}

/**
 * Verify MFA Challenge (Stage 2)
 */
export async function authenticateAdminMfa(
  tempMfaToken: string,
  code: string,
  isRecoveryCode = false,
  ipAddress = 'unknown',
  userAgent = 'unknown'
): Promise<{
  success: boolean;
  error?: string;
  admin?: AdminUser;
  sessionToken?: string;
}> {
  const adminId = await verifyMfaTempToken(tempMfaToken);
  if (!adminId) {
    return { success: false, error: 'MFA session expired. Please log in again.' };
  }

  const adminRes = await query(`SELECT * FROM administrators WHERE id = $1 LIMIT 1`, [adminId]);
  if (adminRes.rows.length === 0 || !adminRes.rows[0].is_active) {
    return { success: false, error: 'Administrator account invalid or deactivated.' };
  }
  const admin = adminRes.rows[0];

  const mfaRes = await query(`SELECT * FROM administrator_mfa WHERE admin_id = $1 LIMIT 1`, [adminId]);
  if (mfaRes.rows.length === 0) {
    return { success: false, error: 'MFA configuration not found for account.' };
  }
  const mfa = mfaRes.rows[0];

  if (isRecoveryCode) {
    let hashedCodes: string[] = [];
    try {
      hashedCodes = JSON.parse(mfa.recovery_codes_hash);
    } catch {
      hashedCodes = [];
    }

    const { valid, remainingHashedCodes } = verifyAndConsumeRecoveryCode(code, hashedCodes);
    if (!valid) {
      await logAuditEvent({
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'ADMIN_MFA_RECOVERY_FAILED',
        targetType: 'administrator',
        targetId: admin.id,
        outcome: 'FAILURE',
        ipAddress,
        userAgent
      });
      return { success: false, error: 'Invalid recovery code.' };
    }

    // Update remaining recovery codes
    await query(
      `UPDATE administrator_mfa SET recovery_codes_hash = $1, last_used_at = CURRENT_TIMESTAMP WHERE admin_id = $2`,
      [JSON.stringify(remainingHashedCodes), admin.id]
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'ADMIN_MFA_RECOVERY_USED',
      targetType: 'administrator',
      targetId: admin.id,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      details: { remainingCodesCount: remainingHashedCodes.length }
    });
  } else {
    // Normal TOTP verification
    const isValid = verifyTotpToken(mfa.totp_secret, code);
    if (!isValid) {
      await logAuditEvent({
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'ADMIN_MFA_FAILED',
        targetType: 'administrator',
        targetId: admin.id,
        outcome: 'FAILURE',
        ipAddress,
        userAgent
      });
      return { success: false, error: 'Invalid 6-digit authenticator code.' };
    }

    await query(
      `UPDATE administrator_mfa SET last_used_at = CURRENT_TIMESTAMP WHERE admin_id = $1`,
      [admin.id]
    );
  }

  // Reset failed attempts & issue session
  await query(
    `UPDATE administrators SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [admin.id]
  );

  return await issueAdminSession(admin, ipAddress, userAgent);
}

/**
 * Issue new admin database session & JWT token
 */
export async function issueAdminSession(
  admin: any,
  ipAddress = 'unknown',
  userAgent = 'unknown'
): Promise<{ success: true; admin: AdminUser; sessionToken: string }> {
  const sessionId = `asess_${crypto.randomBytes(16).toString('hex')}`;
  const sessionToken = await createAdminSessionToken(admin.id, sessionId, admin.role);
  const tokenHash = hashToken(sessionToken);

  const expiresAt = new Date(Date.now() + APP_CONFIG.security.adminSessionDurationHours * 3600 * 1000);

  await query(
    `INSERT INTO administrator_sessions (
      id, admin_id, session_token_hash, ip_address, user_agent, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [sessionId, admin.id, tokenHash, ipAddress, userAgent.slice(0, 500), expiresAt]
  );

  await query(
    `UPDATE administrators SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [admin.id]
  );

  await logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'ADMIN_LOGIN_SUCCESS',
    targetType: 'administrator',
    targetId: admin.id,
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    details: { role: admin.role, sessionId }
  });

  return {
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role as AdminRole,
      isActive: admin.is_active,
      mfaEnabled: admin.mfa_enabled,
      sessionId
    },
    sessionToken
  };
}

/**
 * Verify currently authenticated administrator from Request or Cookies
 */
export async function getAuthenticatedAdmin(req?: Request): Promise<AdminUser | null> {
  let token: string | undefined;

  // 1. Check Authorization header
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  // 2. Check Next.js cookies
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // In standalone API handlers without cookies() context
    }
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'kaisen-admin-auth',
      audience: 'kaisen-admin-panel'
    });

    const adminId = payload.sub as string;
    const sessionId = payload.sid as string;

    if (!adminId || !sessionId) return null;

    // Verify session in DB for instant server-side revocation capability
    const sessRes = await query(
      `SELECT * FROM administrator_sessions 
       WHERE id = $1 AND admin_id = $2 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP 
       LIMIT 1`,
      [sessionId, adminId]
    );

    if (sessRes.rows.length === 0) return null;

    // Verify administrator is active
    const adminRes = await query(
      `SELECT id, username, email, role, is_active, mfa_enabled FROM administrators WHERE id = $1 LIMIT 1`,
      [adminId]
    );

    if (adminRes.rows.length === 0 || !adminRes.rows[0].is_active) {
      return null;
    }

    const admin = adminRes.rows[0];
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role as AdminRole,
      isActive: admin.is_active,
      mfaEnabled: admin.mfa_enabled,
      sessionId
    };
  } catch (err) {
    return null;
  }
}

/**
 * Role-Based Access Control assertion
 */
export function requireRole(admin: AdminUser, allowedRoles: AdminRole[]): boolean {
  return allowedRoles.includes(admin.role);
}

/**
 * Revoke an admin session (Logout)
 */
export async function revokeAdminSession(sessionId: string, adminId: string): Promise<void> {
  await query(
    `UPDATE administrator_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND admin_id = $2`,
    [sessionId, adminId]
  );
}

export { COOKIE_NAME };
