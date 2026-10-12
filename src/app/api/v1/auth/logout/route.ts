/**
 * Client Logout Endpoint
 * POST /api/v1/auth/logout
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { query } from '@/lib/db';
import { verifyClientAccessToken } from '@/lib/client-auth/session';
import { hashToken } from '@/lib/auth/password';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyClientAccessToken(req);

    if (auth.valid && auth.sessionId) {
      await query(
        `UPDATE client_sessions SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [auth.sessionId]
      );
      await query(
        `UPDATE refresh_tokens SET is_revoked = true WHERE session_id = $1`,
        [auth.sessionId]
      );
    }

    // Also check if body has refreshToken to invalidate
    try {
      const body = await req.json();
      if (body?.refreshToken) {
        const h = hashToken(body.refreshToken);
        await query(`UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1`, [h]);
      }
    } catch {
      // Body is optional on logout
    }

    return jsonResponse({ message: 'Successfully logged out and session revoked.' });
  } catch (err: any) {
    return errorResponse('Logout processing error', 500, 'ERR_INTERNAL_SERVER');
  }
}
