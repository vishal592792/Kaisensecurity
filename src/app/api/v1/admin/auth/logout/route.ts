/**
 * Administrator Logout Endpoint
 * POST /api/v1/admin/auth/logout
 */

import { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin, revokeAdminSession, COOKIE_NAME } from '@/lib/auth/admin-auth';

export async function POST(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);

  if (admin && admin.sessionId) {
    await revokeAdminSession(admin.sessionId, admin.id);
  }

  const response = jsonResponse({ message: 'Administrator logged out successfully.' });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
