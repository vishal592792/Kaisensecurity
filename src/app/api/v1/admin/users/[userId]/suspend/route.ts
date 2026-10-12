/**
 * Suspend User Endpoint
 * POST /api/v1/admin/users/[userId]/suspend
 * Immediately revokes active sessions for all user devices/keys
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query, transaction } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden', 403, 'ERR_FORBIDDEN');
  }

  const { userId } = await context.params;

  const userRes = await query(`SELECT id, name FROM users WHERE id = $1 LIMIT 1`, [userId]);
  if (userRes.rows.length === 0) return errorResponse('User not found', 404, 'ERR_NOT_FOUND');

  await transaction(async (tx) => {
    // 1. Mark user suspended
    await tx.query(`UPDATE users SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);

    // 2. Immediately revoke all active sessions for this user
    await tx.query(`UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId]);

    // 3. Invalidate refresh tokens
    await tx.query(
      `UPDATE refresh_tokens rt SET is_revoked = true
       FROM client_sessions cs
       WHERE rt.session_id = cs.id AND cs.user_id = $1`,
      [userId]
    );
  });

  await logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'USER_SUSPENDED',
    targetType: 'user',
    targetId: userId,
    outcome: 'SUCCESS',
    details: { name: userRes.rows[0].name }
  });

  return jsonResponse({ message: 'User suspended and all active sessions terminated immediately.' });
}
