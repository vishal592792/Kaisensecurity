/**
 * Update Security Policy & Create Version Snapshot
 * PATCH /api/v1/admin/policies/[policyId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query, transaction } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdatePolicySchema = z.object({
  maxDevicesPerKey: z.number().int().min(1).max(50).optional(),
  sessionLifetimeMinutes: z.number().int().min(5).max(1440).optional(),
  keyExpiryDefaultDays: z.number().int().min(1).max(365).optional(),
  rateLimitPerMinute: z.number().int().min(10).max(1000).optional(),
  integrityPolicy: z.enum(['STRICT', 'PERMISSIVE', 'MONITOR_ONLY']).optional(),
  minSupportedAppVersion: z.string().min(1).max(32).optional(),
  suspiciousRequestThreshold: z.number().int().min(5).max(500).optional(),
  scanQuotaDaily: z.number().int().min(10).max(10000).optional(),
  maintenanceMode: z.boolean().optional(),
  distributionChannel: z.string().max(64).optional(),
  changeReason: z.string().max(500).optional()
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ policyId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden: Read-only analyst cannot update security policies', 403, 'ERR_FORBIDDEN');
  }

  const { policyId } = await context.params;

  try {
    const body = await req.json();
    const parsed = UpdatePolicySchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid policy configuration payload', 400, 'ERR_INVALID_SCHEMA');

    const data = parsed.data;
    const currentRes = await query(`SELECT * FROM security_policies WHERE id = $1 LIMIT 1`, [policyId]);
    if (currentRes.rows.length === 0) return errorResponse('Policy not found', 404, 'ERR_NOT_FOUND');

    const current = currentRes.rows[0];

    const updated = {
      max_devices_per_key: data.maxDevicesPerKey ?? current.max_devices_per_key,
      session_lifetime_minutes: data.sessionLifetimeMinutes ?? current.session_lifetime_minutes,
      key_expiry_default_days: data.keyExpiryDefaultDays ?? current.key_expiry_default_days,
      rate_limit_per_minute: data.rateLimitPerMinute ?? current.rate_limit_per_minute,
      integrity_policy: data.integrityPolicy ?? current.integrity_policy,
      min_supported_app_version: data.minSupportedAppVersion ?? current.min_supported_app_version,
      suspicious_request_threshold: data.suspiciousRequestThreshold ?? current.suspicious_request_threshold,
      scan_quota_daily: data.scanQuotaDaily ?? current.scan_quota_daily,
      maintenance_mode: data.maintenanceMode ?? current.maintenance_mode,
      distribution_channel: data.distributionChannel ?? current.distribution_channel,
    };

    await transaction(async (tx) => {
      // 1. Update policy
      await tx.query(
        `UPDATE security_policies SET
          max_devices_per_key = $1, session_lifetime_minutes = $2, key_expiry_default_days = $3,
          rate_limit_per_minute = $4, integrity_policy = $5, min_supported_app_version = $6,
          suspicious_request_threshold = $7, scan_quota_daily = $8, maintenance_mode = $9,
          distribution_channel = $10, updated_at = CURRENT_TIMESTAMP, updated_by = $11
        WHERE id = $12`,
        [
          updated.max_devices_per_key, updated.session_lifetime_minutes, updated.key_expiry_default_days,
          updated.rate_limit_per_minute, updated.integrity_policy, updated.min_supported_app_version,
          updated.suspicious_request_threshold, updated.scan_quota_daily, updated.maintenance_mode,
          updated.distribution_channel, admin.username, policyId
        ]
      );

      // 2. Count existing versions
      const vCount = await tx.query(`SELECT COUNT(*) as count FROM policy_versions WHERE policy_id = $1`, [policyId]);
      const nextVersion = parseInt(vCount.rows[0].count, 10) + 1;

      // 3. Insert version snapshot
      const verId = `pver_${crypto.randomBytes(8).toString('hex')}`;
      await tx.query(
        `INSERT INTO policy_versions (
          id, policy_id, version_number, policy_snapshot, changed_by, change_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          verId,
          policyId,
          nextVersion,
          JSON.stringify(updated),
          admin.username,
          data.changeReason || 'Security policy configuration update'
        ]
      );
    });

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'SECURITY_POLICY_UPDATED',
      targetType: 'security_policy',
      targetId: policyId,
      outcome: 'SUCCESS',
      details: { updatedFields: data }
    });

    return jsonResponse({ message: 'Security policy updated and version snapshot recorded.' });
  } catch (err: any) {
    return errorResponse('Failed to update security policy', 500, 'ERR_INTERNAL_SERVER');
  }
}
