/**
 * Mark All Notifications Read
 * POST /api/v1/admin/notifications/mark-all-read
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  await query(`UPDATE notifications SET is_read = true WHERE is_read = false`);
  return jsonResponse({ message: 'All notifications marked as read.' });
}
