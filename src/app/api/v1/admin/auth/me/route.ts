/**
 * Current Administrator Profile Endpoint
 * GET /api/v1/admin/auth/me
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);

  if (!admin) {
    return errorResponse('Not authenticated', 401, 'ERR_UNAUTHORIZED');
  }

  return jsonResponse({
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      mfaEnabled: admin.mfaEnabled
    }
  });
}
