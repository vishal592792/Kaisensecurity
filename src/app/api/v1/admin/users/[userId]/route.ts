/**
 * Admin User Details & Updates
 * GET /api/v1/admin/users/[userId]
 * PATCH /api/v1/admin/users/[userId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(128).optional(),
  label: z.string().min(2).max(128).optional(),
  email: z.string().email().optional().or(z.literal('')),
  contactInfo: z.string().max(500).optional(),
  notes: z.string().max(2000).optional()
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { userId } = await context.params;

  const userRes = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
  if (userRes.rows.length === 0) return errorResponse('User not found', 404, 'ERR_NOT_FOUND');

  const keysRes = await query(
    `SELECT id, masked_key, status, device_limit, expires_at, created_at, last_authenticated_at
     FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  const devicesRes = await query(
    `SELECT id, key_id, app_installation_id, app_version, status, integrity_status, last_seen_at
     FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC`,
    [userId]
  );

  const scansRes = await query(
    `SELECT id, scan_type, apps_assessed_count, critical_findings_count, high_findings_count, status, created_at
     FROM scan_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [userId]
  );

  return jsonResponse({
    user: userRes.rows[0],
    keys: keysRes.rows,
    devices: devicesRes.rows,
    scans: scansRes.rows
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden', 403, 'ERR_FORBIDDEN');
  }

  const { userId } = await context.params;

  try {
    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid parameters', 400, 'ERR_INVALID_SCHEMA');

    const updates = parsed.data;
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      params.push(updates.name);
      setClauses.push(`name = $${params.length}`);
    }
    if (updates.label !== undefined) {
      params.push(updates.label);
      setClauses.push(`label = $${params.length}`);
    }
    if (updates.email !== undefined) {
      params.push(updates.email || null);
      setClauses.push(`email = $${params.length}`);
    }
    if (updates.contactInfo !== undefined) {
      params.push(updates.contactInfo || null);
      setClauses.push(`contact_info = $${params.length}`);
    }
    if (updates.notes !== undefined) {
      params.push(updates.notes || null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return errorResponse('No fields provided', 400, 'ERR_NO_FIELDS');

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'USER_UPDATED',
      targetType: 'user',
      targetId: userId,
      outcome: 'SUCCESS',
      details: updates
    });

    return jsonResponse({ message: 'User updated successfully.' });
  } catch (err: any) {
    return errorResponse('Failed to update user', 500, 'ERR_INTERNAL_SERVER');
  }
}
