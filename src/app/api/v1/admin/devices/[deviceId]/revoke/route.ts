/**
 * Revoke Device Access
 * POST /api/v1/admin/devices/[deviceId]/revoke
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query, transaction } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden', 403, 'ERR_FORBIDDEN');
  }

  const { deviceId } = await context.params;

  const devRes = await query(`SELECT id, app_installation_id, key_id, user_id FROM devices WHERE id = $1 LIMIT 1`, [deviceId]);
  if (devRes.rows.length === 0) return errorResponse('Device not found', 404, 'ERR_NOT_FOUND');

  const dev = devRes.rows[0];

  await transaction(async (tx) => {
    await tx.query(`UPDATE devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [deviceId]);
    await tx.query(`UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE device_id = $1`, [deviceId]);
    await tx.query(
      `UPDATE refresh_tokens rt SET is_revoked = true
       FROM client_sessions cs
       WHERE rt.session_id = cs.id AND cs.device_id = $1`,
      [deviceId]
    );
  });

  await logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'DEVICE_REVOKED',
    targetType: 'device',
    targetId: deviceId,
    outcome: 'SUCCESS',
    details: { installationId: dev.app_installation_id, keyId: dev.key_id }
  });

  return jsonResponse({ message: 'Device access revoked and sessions terminated.' });
}
