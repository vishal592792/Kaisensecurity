/**
 * Suspend API Key Endpoint (Temporary)
 * POST /api/v1/admin/keys/[keyId]/suspend
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
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

  const keyRes = await query(`SELECT id, status, masked_key FROM api_keys WHERE id = $1 LIMIT 1`, [keyId]);
  if (keyRes.rows.length === 0) return errorResponse('Key not found', 404, 'ERR_NOT_FOUND');

  const key = keyRes.rows[0];
  if (key.status === 'revoked') {
    return errorResponse('Revoked keys cannot be suspended or modified', 400, 'ERR_KEY_REVOKED');
  }

  await transaction(async (tx) => {
    await tx.query(`UPDATE api_keys SET status = 'suspended' WHERE id = $1`, [keyId]);
    await tx.query(`UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE key_id = $1`, [keyId]);
  });

  await logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'API_KEY_SUSPENDED',
    targetType: 'api_key',
    targetId: keyId,
    outcome: 'SUCCESS',
    details: { maskedKey: key.masked_key }
  });

  return jsonResponse({ message: 'API key suspended and active sessions terminated.' });
}
