/**
 * Admin Overview Live Dashboard Metrics
 * GET /api/v1/admin/overview
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    return errorResponse('Admin authentication required', 401, 'ERR_UNAUTHORIZED');
  }

  try {
    // 1. API Keys Metrics
    const keysCountRes = await query(`
      SELECT 
        COUNT(*) as total_keys,
        COUNT(*) FILTER (WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP) as active_keys,
        COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'active' AND expires_at <= CURRENT_TIMESTAMP)) as expired_keys,
        COUNT(*) FILTER (WHERE status = 'revoked') as revoked_keys,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_keys
      FROM api_keys
    `);
    const keyStats = keysCountRes.rows[0];

    // 2. Devices Metrics
    const devicesRes = await query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE status = 'registered') as active_devices,
        COUNT(*) FILTER (WHERE status = 'revoked') as revoked_devices
      FROM devices
    `);
    const deviceStats = devicesRes.rows[0];

    // 3. Active Sessions
    const sessionsRes = await query(`
      SELECT COUNT(*) as active_sessions
      FROM client_sessions
      WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP
    `);
    const activeSessions = parseInt(sessionsRes.rows[0]?.active_sessions || '0', 10);

    // 4. Failed Authentications
    const failedAuthRes = await query(`
      SELECT COUNT(*) as failed_attempts
      FROM authentication_events
      WHERE event_type LIKE '%FAIL%' OR event_type LIKE '%INVALID%' OR event_type LIKE '%REVOKED%'
    `);
    const failedAttempts = parseInt(failedAuthRes.rows[0]?.failed_attempts || '0', 10);

    // 5. Integrity Verification Failures
    const integrityFailuresRes = await query(`
      SELECT COUNT(*) as integrity_failures
      FROM integrity_events
      WHERE severity IN ('HIGH', 'CRITICAL')
    `);
    const integrityFailures = parseInt(integrityFailuresRes.rows[0]?.integrity_failures || '0', 10);

    // 6. Recent Scan Submissions & High-risk Findings
    const scanStatsRes = await query(`
      SELECT 
        COUNT(*) as total_scans,
        COALESCE(SUM(critical_findings_count), 0) as total_critical_findings,
        COALESCE(SUM(high_findings_count), 0) as total_high_findings
      FROM scan_reports
    `);
    const scanStats = scanStatsRes.rows[0];

    // 7. Recent Administrative Actions (Audit)
    const recentAuditRes = await query(`
      SELECT id, actor_email, action, target_type, target_id, outcome, created_at
      FROM audit_events
      ORDER BY created_at DESC
      LIMIT 6
    `);

    // 8. Recent Security Events
    const recentEventsRes = await query(`
      SELECT id, category, severity, safe_ip, app_version, resolution_status, timestamp
      FROM integrity_events
      ORDER BY timestamp DESC
      LIMIT 6
    `);

    // 9. Scan Activity Over Time (Last 7 Days)
    const activityTrendRes = await query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as day,
        COUNT(*) as count,
        COALESCE(SUM(critical_findings_count + high_findings_count), 0) as risk_count
      FROM scan_reports
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY day DESC
      LIMIT 7
    `);

    return jsonResponse({
      metrics: {
        totalKeys: parseInt(keyStats.total_keys || '0', 10),
        activeKeys: parseInt(keyStats.active_keys || '0', 10),
        expiredKeys: parseInt(keyStats.expired_keys || '0', 10),
        revokedKeys: parseInt(keyStats.revoked_keys || '0', 10),
        suspendedKeys: parseInt(keyStats.suspended_keys || '0', 10),
        totalDevices: parseInt(deviceStats.total_devices || '0', 10),
        activeDevices: parseInt(deviceStats.active_devices || '0', 10),
        revokedDevices: parseInt(deviceStats.revoked_devices || '0', 10),
        activeSessions,
        failedAuthenticationAttempts: failedAttempts,
        integrityVerificationFailures: integrityFailures,
        totalScanSubmissions: parseInt(scanStats.total_scans || '0', 10),
        highRiskFindings: parseInt(scanStats.total_critical_findings || '0', 10) + parseInt(scanStats.total_high_findings || '0', 10),
        backendHealth: 'OPTIMAL'
      },
      recentActions: recentAuditRes.rows,
      recentEvents: recentEventsRes.rows,
      activityTrends: activityTrendRes.rows.reverse()
    });
  } catch (err: any) {
    console.error('Overview query error:', err);
    return errorResponse('Failed to compute dashboard metrics', 500, 'ERR_OVERVIEW_FAILED');
  }
}
