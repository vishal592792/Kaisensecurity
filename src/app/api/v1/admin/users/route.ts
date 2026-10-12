/**
 * Admin User Management
 * GET /api/v1/admin/users
 * POST /api/v1/admin/users
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateUserSchema = z.object({
  name: z.string().min(2).max(128),
  label: z.string().min(2).max(128),
  email: z.string().email().optional().or(z.literal('')),
  contactInfo: z.string().max(500).optional(),
  notes: z.string().max(2000).optional()
});

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(label) LIKE $${params.length} OR LOWER(COALESCE(email, '')) LIKE $${params.length})`);
  }

  if (status && ['active', 'suspended'].includes(status)) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      u.id, u.name, u.label, u.email, u.contact_info, u.status, u.notes, u.created_at, u.updated_at,
      (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = u.id) as key_count,
      (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id AND d.status = 'registered') as device_count,
      (SELECT MAX(created_at) FROM scan_reports s WHERE s.user_id = u.id) as last_scan_at
    FROM users u
    ${whereClause}
    ORDER BY u.created_at DESC
  `;

  const rows = await query(sql, params);

  return jsonResponse({
    users: rows.rows.map(r => ({
      ...r,
      key_count: parseInt(r.key_count || '0', 10),
      device_count: parseInt(r.device_count || '0', 10)
    }))
  });
}

export async function POST(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden', 403, 'ERR_FORBIDDEN');
  }

  try {
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid user payload format', 400, 'ERR_INVALID_SCHEMA');
    }

    const { name, label, email, contactInfo, notes } = parsed.data;
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;

    await query(
      `INSERT INTO users (
        id, name, label, email, contact_info, status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, name, label, email || null, contactInfo || null, notes || null]
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'USER_CREATED',
      targetType: 'user',
      targetId: userId,
      outcome: 'SUCCESS',
      details: { name, label, email }
    });

    return jsonResponse({ userId, message: 'User created successfully.' }, 201);
  } catch (err: any) {
    return errorResponse('Failed to create user record', 500, 'ERR_INTERNAL_SERVER');
  }
}
