/**
 * App Integrity Verification Endpoint
 * POST /api/v1/integrity/verify
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { evaluateAppIntegrity } from '@/lib/client-auth/integrity';
import { query } from '@/lib/db';

const VerifySchema = z.object({
  appVersion: z.string().min(1).max(32),
  integrityToken: z.string().max(4096).optional(),
  packageName: z.string().max(255).optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Invalid verification request format', 400, 'ERR_INVALID_SCHEMA');
    }

    const policyRes = await query(`SELECT * FROM security_policies WHERE id = 'policy_default' LIMIT 1`);
    const policy = policyRes.rows[0] || {
      integrity_policy: 'STRICT',
      min_supported_app_version: '1.0.0'
    };

    const result = await evaluateAppIntegrity({
      appVersion: parsed.data.appVersion,
      minSupportedVersion: policy.min_supported_app_version,
      integrityPolicy: policy.integrity_policy as any,
      integrityToken: parsed.data.integrityToken,
      expectedPackageName: parsed.data.packageName
    });

    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse('Failed to evaluate integrity', 500, 'ERR_INTERNAL_SERVER');
  }
}
