/**
 * Admin Security & Integrity Events
 * GET /api/v1/admin/events
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
  const severity = searchParams.get('severity') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(e.id) LIKE $${params.length} OR LOWER(e.category) LIKE $${params.length} OR LOWER(COALESCE(e.safe_ip, '')) LIKE $${params.length} OR LOWER(COALESCE(u.name, '')) LIKE $${params.length})`);
  }

  if (severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
    params.push(severity);
    conditions.push(`e.severity = $${params.length}`);
  }

  if (status && ['NEW', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'].includes(status)) {
    params.push(status);
    conditions.push(`e.resolution_status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) as total
    FROM integrity_events e
    LEFT JOIN users u ON e.user_id = u.id
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  params.push(limit, offset);
  const sql = `
    SELECT 
      e.id, e.timestamp, e.category, e.severity, e.key_id, e.user_id,
      e.device_id, e.app_version, e.details, e.safe_ip, e.resolution_status,
      e.reviewed_by, e.reviewed_at,
      u.name as user_name
    FROM integrity_events e
    LEFT JOIN users u ON e.user_id = u.id
    ${whereClause}
    ORDER BY e.timestamp DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await query(sql, params);

  return jsonResponse({
    events: rows.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
