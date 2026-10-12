/**
 * Notifications Management
 * GET /api/v1/admin/notifications
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  const whereClause = unreadOnly ? 'WHERE is_read = false' : '';

  const rows = await query(`
    SELECT * FROM notifications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const unreadRes = await query(`SELECT COUNT(*) as count FROM notifications WHERE is_read = false`);
  const unreadCount = parseInt(unreadRes.rows[0]?.count || '0', 10);

  return jsonResponse({
    notifications: rows.rows,
    unreadCount
  });
}
