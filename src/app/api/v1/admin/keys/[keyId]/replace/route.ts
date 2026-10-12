/**
 * Replace API Key Endpoint
 * POST /api/v1/admin/keys/[keyId]/replace
 * Atomically revokes old key and issues replacement key
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { generateApiKey } from '@/lib/client-auth/keys';
import { query, transaction } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ keyId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden', 403, 'ERR_FORBIDDEN');
  }

  const { keyId } = await context.params;

  try {
    const oldKeyRes = await query(`SELECT * FROM api_keys WHERE id = $1 LIMIT 1`, [keyId]);
    if (oldKeyRes.rows.length === 0) return errorResponse('Key not found', 404, 'ERR_NOT_FOUND');

    const oldKey = oldKeyRes.rows[0];

    // Generate new key
    const newKeyData = generateApiKey('ksk_live_');
    const newExpiresAt = new Date(Date.now() + 90 * 86400 * 1000); // 90 days default

    await transaction(async (tx) => {
      // 1. Revoke old key
      await tx.query(
        `UPDATE api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'Replaced by administrator' WHERE id = $1`,
        [keyId]
      );
      // Invalidate sessions
      await tx.query(`UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE key_id = $1`, [keyId]);

      // 2. Insert new replacement key
      await tx.query(
        `INSERT INTO api_keys (
          id, user_id, key_prefix, masked_key, key_hmac, status, device_limit,
          device_binding_enabled, scan_quota_daily, rate_limit_per_minute,
          expires_at, created_at, internal_note
        ) VALUES ($1, $2, 'ksk_live_', $3, $4, 'active', $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)`,
        [
          newKeyData.keyId,
          oldKey.user_id,
          newKeyData.maskedKey,
          newKeyData.keyHmac,
          oldKey.device_limit,
          oldKey.device_binding_enabled,
          oldKey.scan_quota_daily,
          oldKey.rate_limit_per_minute,
          newExpiresAt,
          `Replacement for ${oldKey.masked_key}`
        ]
      );
    });

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'API_KEY_REPLACED',
      targetType: 'api_key',
      targetId: newKeyData.keyId,
      outcome: 'SUCCESS',
      details: {
        oldKeyId: keyId,
        oldMaskedKey: oldKey.masked_key,
        newKeyId: newKeyData.keyId,
        newMaskedKey: newKeyData.maskedKey
      }
    });

    return jsonResponse({
      keyId: newKeyData.keyId,
      maskedKey: newKeyData.maskedKey,
      rawKey: newKeyData.rawKey,
      expiresAt: newExpiresAt.toISOString(),
      message: 'Old key permanently revoked. Store the new key securely now.'
    });
  } catch (err: any) {
    return errorResponse('Failed to issue replacement key', 500, 'ERR_INTERNAL_SERVER');
  }
}
