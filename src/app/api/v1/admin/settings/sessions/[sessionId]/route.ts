/**
 * Terminate Specific Admin Session
 * DELETE /api/v1/admin/settings/sessions/[sessionId]
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { sessionId } = await context.params;

  await query(
    `UPDATE administrator_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND admin_id = $2`,
    [sessionId, admin.id]
  );

  await logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'ADMIN_SESSION_TERMINATED',
    targetType: 'administrator_session',
    targetId: sessionId,
    outcome: 'SUCCESS'
  });

  return jsonResponse({ message: 'Session revoked.' });
}
