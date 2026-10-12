/**
 * Threat Intelligence Configurations
 * GET /api/v1/admin/threat-intel
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const rows = await query(`
    SELECT id, name, api_key_masked, is_enabled, quota_per_minute, timeout_ms, status, last_check_at, error_message, updated_at
    FROM threat_intel_configs
    ORDER BY id ASC
  `);

  return jsonResponse({
    providers: rows.rows
  });
}
