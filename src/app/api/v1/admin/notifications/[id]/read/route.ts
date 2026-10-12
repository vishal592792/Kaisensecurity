/**
 * Mark Single Notification Read
 * POST /api/v1/admin/notifications/[id]/read
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { id } = await context.params;

  await query(`UPDATE notifications SET is_read = true WHERE id = $1`, [id]);
  return jsonResponse({ message: 'Notification marked as read.' });
}
