/**
 * Resume Suspended API Key Endpoint
 * POST /api/v1/admin/keys/[keyId]/resume
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
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

  const keyRes = await query(`SELECT id, status, masked_key, expires_at FROM api_keys WHERE id = $1 LIMIT 1`, [keyId]);
  if (keyRes.rows.length === 0) return errorResponse('Key not found', 404, 'ERR_NOT_FOUND');

  const key = keyRes.rows[0];
  if (key.status === 'revoked') {
    return errorResponse('Revoked keys cannot become valid again. Generate a replacement key instead.', 400, 'ERR_CANNOT_RESUME_REVOKED');
  }

  if (new Date(key.expires_at) < new Date()) {
    return errorResponse('Cannot resume an expired API key. Please update expiry first or issue a replacement.', 400, 'ERR_KEY_EXPIRED');
  }

  await query(`UPDATE api_keys SET status = 'active' WHERE id = $1`, [keyId]);

  await logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'API_KEY_RESUMED',
    targetType: 'api_key',
    targetId: keyId,
    outcome: 'SUCCESS',
    details: { maskedKey: key.masked_key }
  });

  return jsonResponse({ message: 'API key has been resumed to active status.' });
}
