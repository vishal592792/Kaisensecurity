/**
 * Update Integrity Event Status
 * PATCH /api/v1/admin/events/[eventId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateEventSchema = z.object({
  resolutionStatus: z.enum(['NEW', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'])
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { eventId } = await context.params;

  try {
    const body = await req.json();
    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid resolution status', 400, 'ERR_INVALID_STATUS');

    await query(
      `UPDATE integrity_events
       SET resolution_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [parsed.data.resolutionStatus, admin.username, eventId]
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'SECURITY_EVENT_UPDATED',
      targetType: 'integrity_event',
      targetId: eventId,
      outcome: 'SUCCESS',
      details: { status: parsed.data.resolutionStatus }
    });

    return jsonResponse({ message: 'Event status updated.' });
  } catch (err: any) {
    return errorResponse('Failed to update event', 500, 'ERR_INTERNAL_SERVER');
  }
}
