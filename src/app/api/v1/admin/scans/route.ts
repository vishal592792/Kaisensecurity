/**
 * Admin Scan Reports Management
 * GET /api/v1/admin/scans
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
  const scanType = searchParams.get('type') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(s.id) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length} OR LOWER(d.app_installation_id) LIKE $${params.length})`);
  }

  if (scanType && ['FULL', 'QUICK', 'VULNERABILITY', 'INTEGRITY'].includes(scanType)) {
    params.push(scanType);
    conditions.push(`s.scan_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) as total
    FROM scan_reports s
    JOIN users u ON s.user_id = u.id
    JOIN devices d ON s.device_id = d.id
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  params.push(limit, offset);
  const sql = `
    SELECT 
      s.id, s.user_id, s.device_id, s.key_id, s.scan_type,
      s.apps_assessed_count, s.inaccessible_apps_count,
      s.critical_findings_count, s.high_findings_count,
      s.medium_findings_count, s.low_findings_count, s.info_findings_count,
      s.coverage_percent, s.status, s.started_at, s.finished_at, s.created_at,
      u.name as user_name, u.label as user_label,
      d.app_installation_id, d.app_version,
      k.masked_key
    FROM scan_reports s
    JOIN users u ON s.user_id = u.id
    JOIN devices d ON s.device_id = d.id
    JOIN api_keys k ON s.key_id = k.id
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await query(sql, params);

  return jsonResponse({
    scans: rows.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
