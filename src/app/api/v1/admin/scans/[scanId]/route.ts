/**
 * Admin Scan Report Details & Redacted Export
 * GET /api/v1/admin/scans/[scanId]
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ scanId: string }> }
) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { scanId } = await context.params;
  const { searchParams } = new URL(req.url);
  const isExport = searchParams.get('export') === 'true';

  const scanRes = await query(
    `SELECT s.*, u.name as user_name, u.label as user_label, d.app_installation_id, d.app_version, k.masked_key
     FROM scan_reports s
     JOIN users u ON s.user_id = u.id
     JOIN devices d ON s.device_id = d.id
     JOIN api_keys k ON s.key_id = k.id
     WHERE s.id = $1 LIMIT 1`,
    [scanId]
  );

  if (scanRes.rows.length === 0) return errorResponse('Scan report not found', 404, 'ERR_NOT_FOUND');
  const scan = scanRes.rows[0];

  const findingsRes = await query(
    `SELECT id, package_name, app_name, finding_type, severity, detection_engine,
            confidence, description, remediation, created_at
     FROM scan_findings
     WHERE scan_id = $1
     ORDER BY CASE severity
       WHEN 'CRITICAL' THEN 1
       WHEN 'HIGH' THEN 2
       WHEN 'MEDIUM' THEN 3
       WHEN 'LOW' THEN 4
       ELSE 5
     END ASC`,
    [scanId]
  );

  if (isExport) {
    // Redacted export summary
    const redactedSummary = {
      scanId: scan.id,
      exportTimestamp: new Date().toISOString(),
      classification: 'CONFIDENTIAL // REDACTED SECURITY AUDIT',
      assessedOrganization: scan.user_label,
      clientAppVersion: scan.app_version,
      scanType: scan.scan_type,
      totalApplicationsEvaluated: scan.apps_assessed_count,
      coveragePercent: scan.coverage_percent,
      findingsSummary: {
        critical: scan.critical_findings_count,
        high: scan.high_findings_count,
        medium: scan.medium_findings_count,
        low: scan.low_findings_count,
        info: scan.info_findings_count,
      },
      findings: findingsRes.rows.map((f: any) => ({
        type: f.finding_type,
        severity: f.severity,
        engine: f.detection_engine,
        summary: f.description,
        remediation: f.remediation,
      }))
    };

    return jsonResponse(redactedSummary);
  }

  return jsonResponse({
    report: scan,
    findings: findingsRes.rows
  });
}
