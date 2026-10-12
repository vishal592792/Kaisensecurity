/**
 * Refresh Token Rotation Endpoint
 * POST /api/v1/auth/refresh
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { rotateRefreshToken } from '@/lib/client-auth/session';

const RefreshSchema = z.object({
  refreshToken: z.string().min(16).max(256)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RefreshSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Invalid refresh request body', 400, 'ERR_INVALID_SCHEMA');
    }

    const result = await rotateRefreshToken(parsed.data.refreshToken);

    if (!result.success || !result.session) {
      return errorResponse(result.error || 'Failed to rotate token', 401, 'ERR_REFRESH_FAILED');
    }

    return jsonResponse({
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresIn: result.session.expiresIn,
      tokenType: result.session.tokenType
    });
  } catch (err: any) {
    return errorResponse('Token refresh error', 500, 'ERR_INTERNAL_SERVER');
  }
}
