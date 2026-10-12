/**
 * Client Session Verification Endpoint
 * GET /api/v1/auth/session
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { verifyClientAccessToken } from '@/lib/client-auth/session';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await verifyClientAccessToken(req);

  if (!auth.valid) {
    return errorResponse(auth.error || 'Unauthorized session', 401, 'ERR_UNAUTHORIZED');
  }

  const devRes = await query(
    `SELECT d.id, d.app_version, d.android_version, d.status, d.integrity_status, d.last_seen_at,
            u.name as user_name, k.masked_key
     FROM devices d
     JOIN users u ON d.user_id = u.id
     JOIN api_keys k ON d.key_id = k.id
     WHERE d.id = $1 LIMIT 1`,
    [auth.deviceId]
  );

  return jsonResponse({
    valid: true,
    sessionId: auth.sessionId,
    keyId: auth.keyId,
    device: devRes.rows[0] || null
  });
}
