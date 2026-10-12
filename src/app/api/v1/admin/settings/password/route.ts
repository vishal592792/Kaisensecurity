/**
 * Change Administrator Password
 * PATCH /api/v1/admin/settings/password
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(128)
});

export async function PATCH(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  try {
    const body = await req.json();
    const parsed = PasswordChangeSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Password must be at least 8 characters', 400, 'ERR_INVALID_SCHEMA');

    const adminRow = await query(`SELECT password_hash FROM administrators WHERE id = $1 LIMIT 1`, [admin.id]);
    const isCurrentValid = await verifyPassword(adminRow.rows[0].password_hash, parsed.data.currentPassword);

    if (!isCurrentValid) {
      return errorResponse('Current password is incorrect.', 400, 'ERR_INVALID_PASSWORD');
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await query(`UPDATE administrators SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newHash, admin.id]);

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'ADMIN_PASSWORD_CHANGED',
      targetType: 'administrator',
      targetId: admin.id,
      outcome: 'SUCCESS'
    });

    return jsonResponse({ message: 'Password updated successfully with Argon2id.' });
  } catch (err: any) {
    return errorResponse('Failed to update password', 500, 'ERR_INTERNAL_SERVER');
  }
}
