/**
 * Security Policies Management
 * GET /api/v1/admin/policies
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const policyRes = await query(`SELECT * FROM security_policies WHERE id = 'policy_default' LIMIT 1`);
  const versionsRes = await query(`
    SELECT * FROM policy_versions
    WHERE policy_id = 'policy_default'
    ORDER BY version_number DESC
    LIMIT 10
  `);

  return jsonResponse({
    policy: policyRes.rows[0],
    versions: versionsRes.rows
  });
}
