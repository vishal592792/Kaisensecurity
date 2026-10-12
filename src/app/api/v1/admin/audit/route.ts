/**
 * Administrator Audit Trail Endpoint (Immutable Append-Oriented)
 * GET /api/v1/admin/audit
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
  const action = searchParams.get('action') || '';
  const outcome = searchParams.get('outcome') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(id) LIKE $${params.length} OR LOWER(actor_email) LIKE $${params.length} OR LOWER(target_id) LIKE $${params.length} OR LOWER(action) LIKE $${params.length})`);
  }

  if (action) {
    params.push(action);
    conditions.push(`action = $${params.length}`);
  }

  if (outcome && ['SUCCESS', 'FAILURE'].includes(outcome)) {
    params.push(outcome);
    conditions.push(`outcome = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`
    SELECT COUNT(*) as total
    FROM audit_events
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  params.push(limit, offset);
  const sql = `
    SELECT 
      id, actor_id, actor_email, action, target_type, target_id,
      outcome, request_id, ip_address, user_agent, details, created_at
    FROM audit_events
    ${whereClause}
    ORDER BY created_at DESC
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
