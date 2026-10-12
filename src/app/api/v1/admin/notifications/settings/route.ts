/**
 * Notification Settings Endpoint
 * GET /api/v1/admin/notifications/settings
 * PATCH /api/v1/admin/notifications/settings
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateNotifSettingsSchema = z.object({
  notifyFailedLogins: z.boolean().optional(),
  failedLoginThreshold: z.number().int().min(1).max(20).optional(),
  notifyHighRiskIntegrity: z.boolean().optional(),
  notifyNewDevice: z.boolean().optional(),
  notifyKeyExpiry: z.boolean().optional(),
  keyExpiryWarningDays: z.number().int().min(1).max(30).optional(),
  notifyKeyRevocation: z.boolean().optional(),
  notifyScanAnomalies: z.boolean().optional(),
  emailAlertsEnabled: z.boolean().optional(),
  alertEmail: z.string().email().optional().or(z.literal(''))
});

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const rows = await query(`SELECT * FROM notification_settings WHERE id = 'default' LIMIT 1`);
  return jsonResponse({ settings: rows.rows[0] });
}

export async function PATCH(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Forbidden: Read-only analyst cannot edit notification settings', 403, 'ERR_FORBIDDEN');
  }

  try {
    const body = await req.json();
    const parsed = UpdateNotifSettingsSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid parameters', 400, 'ERR_INVALID_SCHEMA');

    const data = parsed.data;
    const currentRes = await query(`SELECT * FROM notification_settings WHERE id = 'default' LIMIT 1`);
    const cur = currentRes.rows[0];

    const updated = {
      notify_failed_logins: data.notifyFailedLogins ?? cur.notify_failed_logins,
      failed_login_threshold: data.failedLoginThreshold ?? cur.failed_login_threshold,
      notify_high_risk_integrity: data.notifyHighRiskIntegrity ?? cur.notify_high_risk_integrity,
      notify_new_device: data.notifyNewDevice ?? cur.notify_new_device,
      notify_key_expiry: data.notifyKeyExpiry ?? cur.notify_key_expiry,
      key_expiry_warning_days: data.keyExpiryWarningDays ?? cur.key_expiry_warning_days,
      notify_key_revocation: data.notifyKeyRevocation ?? cur.notify_key_revocation,
      notify_scan_anomalies: data.notifyScanAnomalies ?? cur.notify_scan_anomalies,
      email_alerts_enabled: data.emailAlertsEnabled ?? cur.email_alerts_enabled,
      alert_email: data.alertEmail !== undefined ? (data.alertEmail || null) : cur.alert_email
    };

    await query(
      `UPDATE notification_settings SET
        notify_failed_logins = $1, failed_login_threshold = $2, notify_high_risk_integrity = $3,
        notify_new_device = $4, notify_key_expiry = $5, key_expiry_warning_days = $6,
        notify_key_revocation = $7, notify_scan_anomalies = $8, email_alerts_enabled = $9,
        alert_email = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = 'default'`,
      [
        updated.notify_failed_logins, updated.failed_login_threshold, updated.notify_high_risk_integrity,
        updated.notify_new_device, updated.notify_key_expiry, updated.key_expiry_warning_days,
        updated.notify_key_revocation, updated.notify_scan_anomalies, updated.email_alerts_enabled,
        updated.alert_email
      ]
    );

    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'NOTIFICATION_SETTINGS_UPDATED',
      targetType: 'notification_settings',
      targetId: 'default',
      outcome: 'SUCCESS',
      details: data
    });

    return jsonResponse({ message: 'Notification settings updated successfully.' });
  } catch (err: any) {
    return errorResponse('Failed to update settings', 500, 'ERR_INTERNAL_SERVER');
  }
}
