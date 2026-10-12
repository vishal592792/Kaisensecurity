/**
 * Admin API Key Details & Metadata Updates
 * GET /api/v1/admin/keys/[keyId]
 * PATCH /api/v1/admin/keys/[keyId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateKeySchema = z.object({
  internalNote: z.string().max(1000).optional(),
  deviceLimit: z.number().int().min(1).max(50).optional(),
  deviceBindingEnabled: z.boolean().optional(),
  scanQuotaDaily: z.number().int().min(1).max(10000).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().optional()
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ keyId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { keyId } = await context.params;

  const keyRes = await query(
    `SELECT k.*, u.name as user_name, u.label as user_label, u.email as user_email
     FROM api_keys k
     JOIN users u ON k.user_id = u.id
     WHERE k.id = $1 LIMIT 1`,
    [keyId]
  );

  if (keyRes.rows.length === 0) {
    return errorResponse('API key not found', 404, 'ERR_NOT_FOUND');
  }

  // Associated devices
  const devicesRes = await query(
    `SELECT id, app_installation_id, app_version, android_version, status, integrity_status, first_seen_at, last_seen_at, last_ip
     FROM devices
     WHERE key_id = $1
     ORDER BY last_seen_at DESC`,
    [keyId]
  );

  // Associated recent auth logs
  const authLogsRes = await query(
    `SELECT id, event_type, ip_address, user_agent, failure_reason, timestamp
     FROM authentication_events
     WHERE key_id = $1
     ORDER BY timestamp DESC
     LIMIT 10`,
    [keyId]
  );

  return jsonResponse({
    key: keyRes.rows[0],
    devices: devicesRes.rows,
    authLogs: authLogsRes.rows
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ keyId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Read-only analyst cannot edit key metadata', 403, 'ERR_FORBIDDEN');
  }

  const { keyId } = await context.params;

  try {
    const body = await req.json();
    const parsed = UpdateKeySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid update parameters', 400, 'ERR_INVALID_SCHEMA');
    }

    const updates = parsed.data;
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.internalNote !== undefined) {
      params.push(updates.internalNote);
      setClauses.push(`internal_note = $${params.length}`);
    }
    if (updates.deviceLimit !== undefined) {
      params.push(updates.deviceLimit);
      setClauses.push(`device_limit = $${params.length}`);
    }
    if (updates.deviceBindingEnabled !== undefined) {
      params.push(updates.deviceBindingEnabled);
      setClauses.push(`device_binding_enabled = $${params.length}`);
    }
    if (updates.scanQuotaDaily !== undefined) {
      params.push(updates.scanQuotaDaily);
      setClauses.push(`scan_quota_daily = $${params.length}`);
    }
    if (updates.rateLimitPerMinute !== undefined) {
      params.push(updates.rateLimitPerMinute);
      setClauses.push(`rate_limit_per_minute = $${params.length}`);
    }
    if (updates.expiresAt !== undefined) {
      params.push(new Date(updates.expiresAt));
      setClauses.push(`expires_at = $${params.length}`);
    }

    if (setClauses.length === 0) {
      return errorResponse('No update fields provided', 400, 'ERR_NO_UPDATES');
    }

    params.push(keyId);
    await query(
      `UPDATE api_keys SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'API_KEY_METADATA_UPDATED',
      targetType: 'api_key',
      targetId: keyId,
      outcome: 'SUCCESS',
      details: updates
    });

    return jsonResponse({ message: 'Key metadata updated successfully.' });
  } catch (err: any) {
    return errorResponse('Failed to update key metadata', 500, 'ERR_INTERNAL_SERVER');
  }
}
