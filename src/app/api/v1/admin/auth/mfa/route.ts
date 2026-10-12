/**
 * Administrator MFA Verification Endpoint (Phase 2)
 * POST /api/v1/admin/auth/mfa
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { authenticateAdminMfa, COOKIE_NAME } from '@/lib/auth/admin-auth';

const MfaSchema = z.object({
  tempMfaToken: z.string().min(10),
  code: z.string().min(6).max(32),
  isRecoveryCode: z.boolean().optional().default(false)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MfaSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Invalid MFA code format', 400, 'ERR_INVALID_SCHEMA');
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const ua = req.headers.get('user-agent') || 'Browser';

    const result = await authenticateAdminMfa(
      parsed.data.tempMfaToken,
      parsed.data.code,
      parsed.data.isRecoveryCode,
      ip,
      ua
    );

    if (!result.success || !result.admin || !result.sessionToken) {
      return errorResponse(result.error || 'MFA verification failed', 401, 'ERR_MFA_FAILED');
    }

    const response = jsonResponse({
      admin: result.admin,
      sessionToken: result.sessionToken
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: result.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 3600
    });

    return response;
  } catch (err: any) {
    return errorResponse('MFA verification internal error', 500, 'ERR_INTERNAL_SERVER');
  }
}
