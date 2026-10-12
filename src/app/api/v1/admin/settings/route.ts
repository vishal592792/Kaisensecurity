/**
 * Administrator Settings & System Info
 * GET /api/v1/admin/settings
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { APP_CONFIG } from '@/lib/config/env';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  // Active admin sessions
  const sessionsRes = await query(
    `SELECT id, ip_address, user_agent, expires_at, created_at
     FROM administrator_sessions
     WHERE admin_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     ORDER BY created_at DESC`,
    [admin.id]
  );

  return jsonResponse({
    profile: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      mfaEnabled: admin.mfaEnabled,
    },
    system: {
      ownerName: APP_CONFIG.owner.name,
      ownerContact: APP_CONFIG.owner.contact,
      productName: APP_CONFIG.productName,
      platformName: APP_CONFIG.name,
      version: APP_CONFIG.version,
      databaseType: APP_CONFIG.database.isLocalEmbedded ? 'PostgreSQL (Embedded persistent engine)' : 'PostgreSQL (External Server)'
    },
    sessions: sessionsRes.rows.map(s => ({
      ...s,
      isCurrent: s.id === admin.sessionId
    }))
  });
}
