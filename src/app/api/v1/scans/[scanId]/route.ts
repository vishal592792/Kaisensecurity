/**
 * Scan Report Details Endpoint
 * GET /api/v1/scans/[scanId]
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { verifyClientAccessToken } from '@/lib/client-auth/session';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await context.params;

  // Accessible either by client token or admin session
  const admin = await getAuthenticatedAdmin(req);
  let clientId: string | undefined;

  if (!admin) {
    const clientAuth = await verifyClientAccessToken(req);
    if (!clientAuth.valid) {
      return errorResponse('Authentication required to access scan reports', 401, 'ERR_UNAUTHORIZED');
    }
    clientId = clientAuth.userId;
  }

  const scanRes = await query(
    `SELECT s.*, u.name as user_name, d.app_installation_id, d.app_version, k.masked_key
     FROM scan_reports s
     JOIN users u ON s.user_id = u.id
     JOIN devices d ON s.device_id = d.id
     JOIN api_keys k ON s.key_id = k.id
     WHERE s.id = $1 LIMIT 1`,
    [scanId]
  );

  if (scanRes.rows.length === 0) {
    return errorResponse('Scan report not found', 404, 'ERR_NOT_FOUND');
  }

  const scan = scanRes.rows[0];

  // If accessed by client, verify user ownership
  if (clientId && scan.user_id !== clientId) {
    return errorResponse('Access denied to this report', 403, 'ERR_FORBIDDEN');
  }

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
     END ASC, created_at DESC`,
    [scanId]
  );

  return jsonResponse({
    report: scan,
    findings: findingsRes.rows
  });
}
