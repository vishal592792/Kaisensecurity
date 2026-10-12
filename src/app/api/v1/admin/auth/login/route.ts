/**
 * Administrator Login Endpoint (Phase 1)
 * POST /api/v1/admin/auth/login
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { authenticateAdminPassword, COOKIE_NAME } from '@/lib/auth/admin-auth';

const AdminLoginSchema = z.object({
  username: z.string().min(2).max(128),
  password: z.string().min(6).max(256)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AdminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Invalid username or password format', 400, 'ERR_INVALID_SCHEMA');
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const ua = req.headers.get('user-agent') || 'Browser';

    const result = await authenticateAdminPassword(
      parsed.data.username,
      parsed.data.password,
      ip,
      ua
    );

    if (!result.success) {
      return errorResponse(result.error || 'Authentication failed', 401, 'ERR_AUTH_FAILED');
    }

    if (result.requiresMfa) {
      return jsonResponse({
        requiresMfa: true,
        tempMfaToken: result.tempMfaToken,
        message: 'Enter your 6-digit authenticator code or backup recovery code.'
      });
    }

    const response = jsonResponse({
      requiresMfa: false,
      admin: result.admin,
      sessionToken: result.sessionToken
    });

    if (result.sessionToken) {
      response.cookies.set({
        name: COOKIE_NAME,
        value: result.sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 3600 // 8 hours
      });
    }

    return response;
  } catch (err: any) {
    console.error('Admin login handler error:', err);
    return errorResponse('Admin authentication service failure', 500, 'ERR_INTERNAL_SERVER');
  }
}
