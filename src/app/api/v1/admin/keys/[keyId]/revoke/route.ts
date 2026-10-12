/**
 * Revoke API Key Endpoint (Irreversible)
 * POST /api/v1/admin/keys/[keyId]/revoke
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query, transaction } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const RevokeSchema = z.object({
  reason: z.string().max(500).default('Revoked by administrator')
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ keyId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Read-only analyst cannot revoke API keys', 403, 'ERR_FORBIDDEN');
  }

  const { keyId } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RevokeSchema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason : 'Revoked by administrator';

    const keyRes = await query(`SELECT id, status, masked_key, user_id FROM api_keys WHERE id = $1 LIMIT 1`, [keyId]);
    if (keyRes.rows.length === 0) {
      return errorResponse('API key not found', 404, 'ERR_NOT_FOUND');
    }

    const key = keyRes.rows[0];
    if (key.status === 'revoked') {
      return errorResponse('Key is already revoked', 400, 'ERR_ALREADY_REVOKED');
    }

    await transaction(async (tx) => {
      // 1. Mark key revoked permanently
      await tx.query(
        `UPDATE api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revoked_reason = $1 WHERE id = $2`,
        [reason, keyId]
      );

      // 2. Revoke all active sessions linked to this key
      await tx.query(
        `UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE key_id = $1`,
        [keyId]
      );

      // 3. Invalidate refresh tokens linked to those sessions
      await tx.query(
        `UPDATE refresh_tokens rt SET is_revoked = true
         FROM client_sessions cs
         WHERE rt.session_id = cs.id AND cs.key_id = $1`,
        [keyId]
      );
    });

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'API_KEY_REVOKED',
      targetType: 'api_key',
      targetId: keyId,
      outcome: 'SUCCESS',
      details: { maskedKey: key.masked_key, reason }
    });

    return jsonResponse({
      message: 'API key and all active sessions have been permanently revoked.'
    });
  } catch (err: any) {
    return errorResponse('Failed to revoke key', 500, 'ERR_INTERNAL_SERVER');
  }
}
