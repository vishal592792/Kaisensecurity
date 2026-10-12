/**
 * Authentication Events Log Endpoint
 * GET /api/v1/admin/auth-logs
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
  const type = searchParams.get('type') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(ae.id) LIKE $${params.length} OR LOWER(COALESCE(ae.key_id, '')) LIKE $${params.length} OR LOWER(COALESCE(ae.ip_address, '')) LIKE $${params.length} OR LOWER(COALESCE(u.name, '')) LIKE $${params.length})`);
  }

  if (type) {
    params.push(type);
    conditions.push(`ae.event_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) as total
    FROM authentication_events ae
    LEFT JOIN users u ON ae.user_id = u.id
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  params.push(limit, offset);
  const sql = `
    SELECT 
      ae.id, ae.timestamp, ae.event_type, ae.key_id, ae.user_id,
      ae.device_id, ae.ip_address, ae.user_agent, ae.failure_reason,
      u.name as user_name, k.masked_key
    FROM authentication_events ae
    LEFT JOIN users u ON ae.user_id = u.id
    LEFT JOIN api_keys k ON ae.key_id = k.id
    ${whereClause}
    ORDER BY ae.timestamp DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await query(sql, params);

  return jsonResponse({
    logs: rows.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
