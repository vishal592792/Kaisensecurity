/**
 * Admin Device Management
 * GET /api/v1/admin/devices
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(d.id) LIKE $${params.length} OR LOWER(d.app_installation_id) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length} OR LOWER(k.masked_key) LIKE $${params.length})`);
  }

  if (status && ['registered', 'revoked', 'pending'].includes(status)) {
    params.push(status);
    conditions.push(`d.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) as total
    FROM devices d
    JOIN users u ON d.user_id = u.id
    JOIN api_keys k ON d.key_id = k.id
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  params.push(limit, offset);
  const sql = `
    SELECT 
      d.id, d.user_id, d.key_id, d.app_installation_id, d.app_version,
      d.android_version, d.status, d.integrity_status, d.first_seen_at,
      d.last_seen_at, d.last_ip, d.revoked_at,
      u.name as user_name, u.label as user_label,
      k.masked_key,
      (SELECT COUNT(*) FROM authentication_events ae WHERE ae.device_id = d.id AND ae.event_type LIKE '%FAIL%') as failed_auth_count,
      (SELECT COUNT(*) FROM client_sessions cs WHERE cs.device_id = d.id AND cs.status = 'active') as active_session_count
    FROM devices d
    JOIN users u ON d.user_id = u.id
    JOIN api_keys k ON d.key_id = k.id
    ${whereClause}
    ORDER BY d.last_seen_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await query(sql, params);

  return jsonResponse({
    devices: rows.rows.map(r => ({
      ...r,
      failed_auth_count: parseInt(r.failed_auth_count || '0', 10),
      active_session_count: parseInt(r.active_session_count || '0', 10)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
