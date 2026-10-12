/**
 * Administrator MFA Reconfiguration
 * POST /api/v1/admin/settings/mfa
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { generateTotpSetup, verifyTotpToken } from '@/lib/auth/totp';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const ConfirmMfaSchema = z.object({
  action: z.enum(['GENERATE', 'CONFIRM']),
  secret: z.string().optional(),
  code: z.string().optional(),
  hashedRecoveryCodes: z.array(z.string()).optional()
});

export async function POST(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  try {
    const body = await req.json();
    const parsed = ConfirmMfaSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid parameters', 400, 'ERR_INVALID_SCHEMA');

    if (parsed.data.action === 'GENERATE') {
      const setup = await generateTotpSetup(admin.username);
      return jsonResponse({
        secret: setup.secret,
        qrCodeDataUrl: setup.qrCodeDataUrl,
        recoveryCodes: setup.recoveryCodes,
        hashedRecoveryCodes: setup.hashedRecoveryCodes
      });
    }

    if (parsed.data.action === 'CONFIRM') {
      const { secret, code, hashedRecoveryCodes } = parsed.data;
      if (!secret || !code || !hashedRecoveryCodes) {
        return errorResponse('Missing confirmation parameters', 400, 'ERR_MISSING_PARAMS');
      }

      const isValid = verifyTotpToken(secret, code);
      if (!isValid) {
        return errorResponse('Invalid 6-digit authenticator code. Check your device time and code.', 400, 'ERR_INVALID_CODE');
      }

      await query(
        `INSERT INTO administrator_mfa (admin_id, totp_secret, recovery_codes_hash, confirmed_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (admin_id) DO UPDATE SET
           totp_secret = EXCLUDED.totp_secret,
           recovery_codes_hash = EXCLUDED.recovery_codes_hash,
           confirmed_at = CURRENT_TIMESTAMP`,
        [admin.id, secret, JSON.stringify(hashedRecoveryCodes)]
      );

      await query(`UPDATE administrators SET mfa_enabled = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [admin.id]);

      await logAuditEvent({
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'ADMIN_MFA_CONFIGURED',
        targetType: 'administrator',
        targetId: admin.id,
        outcome: 'SUCCESS'
      });

      return jsonResponse({ message: 'MFA successfully activated for your administrator account.' });
    }

    return errorResponse('Invalid action', 400, 'ERR_INVALID_ACTION');
  } catch (err: any) {
    return errorResponse('MFA configuration error', 500, 'ERR_INTERNAL_SERVER');
  }
}
