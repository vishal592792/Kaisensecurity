/**
 * Update Threat Intelligence Provider Settings
 * PATCH /api/v1/admin/threat-intel/[providerId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateProviderSchema = z.object({
  apiKey: z.string().max(256).optional(),
  isEnabled: z.boolean().optional(),
  quotaPerMinute: z.number().int().min(1).max(1000).optional(),
  timeoutMs: z.number().int().min(500).max(30000).optional()
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ providerId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden: Read-only analyst cannot edit integrations', 403, 'ERR_FORBIDDEN');
  }

  const { providerId } = await context.params;

  try {
    const body = await req.json();
    const parsed = UpdateProviderSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid parameters', 400, 'ERR_INVALID_SCHEMA');

    const data = parsed.data;
    const setClauses: string[] = [];
    const params: any[] = [];

    if (data.apiKey !== undefined && data.apiKey.trim().length > 0) {
      const masked = `${data.apiKey.slice(0, 3)}••••••••${data.apiKey.slice(-4)}`;
      params.push(masked);
      setClauses.push(`api_key_masked = $${params.length}`);

      // In real deployment, encrypt before storing in api_key_encrypted
      params.push(data.apiKey.trim());
      setClauses.push(`api_key_encrypted = $${params.length}`);
    }

    if (data.isEnabled !== undefined) {
      params.push(data.isEnabled);
      setClauses.push(`is_enabled = $${params.length}`);
    }

    if (data.quotaPerMinute !== undefined) {
      params.push(data.quotaPerMinute);
      setClauses.push(`quota_per_minute = $${params.length}`);
    }

    if (data.timeoutMs !== undefined) {
      params.push(data.timeoutMs);
      setClauses.push(`timeout_ms = $${params.length}`);
    }

    if (setClauses.length === 0) return errorResponse('No fields provided', 400, 'ERR_NO_FIELDS');

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(providerId);

    await query(
      `UPDATE threat_intel_configs SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'THREAT_INTEL_UPDATED',
      targetType: 'threat_intel_provider',
      targetId: providerId,
      outcome: 'SUCCESS',
      details: {
        isEnabled: data.isEnabled,
        quotaPerMinute: data.quotaPerMinute,
        timeoutMs: data.timeoutMs
      }
    });

    return jsonResponse({ message: 'Threat intelligence provider settings saved.' });
  } catch (err: any) {
    return errorResponse('Failed to update threat intel provider', 500, 'ERR_INTERNAL_SERVER');
  }
}
