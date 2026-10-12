/**
 * Admin Device Details
 * GET /api/v1/admin/devices/[deviceId]
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { deviceId } = await context.params;

  const devRes = await query(
    `SELECT d.*, u.name as user_name, u.label as user_label, k.masked_key
     FROM devices d
     JOIN users u ON d.user_id = u.id
     JOIN api_keys k ON d.key_id = k.id
     WHERE d.id = $1 LIMIT 1`,
    [deviceId]
  );

  if (devRes.rows.length === 0) return errorResponse('Device not found', 404, 'ERR_NOT_FOUND');

  const eventsRes = await query(
    `SELECT id, category, severity, details, resolution_status, timestamp
     FROM integrity_events
     WHERE device_id = $1
     ORDER BY timestamp DESC LIMIT 20`,
    [deviceId]
  );

  const authRes = await query(
    `SELECT id, event_type, ip_address, user_agent, failure_reason, timestamp
     FROM authentication_events
     WHERE device_id = $1
     ORDER BY timestamp DESC LIMIT 20`,
    [deviceId]
  );

  return jsonResponse({
    device: devRes.rows[0],
    integrityEvents: eventsRes.rows,
    authLogs: authRes.rows
  });
}
