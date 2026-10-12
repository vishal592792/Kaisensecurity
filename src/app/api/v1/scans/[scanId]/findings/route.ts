/**
 * Client Scan Findings Ingestion Endpoint
 * POST /api/v1/scans/[scanId]/findings
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { verifyClientAccessToken } from '@/lib/client-auth/session';
import { query, transaction } from '@/lib/db';

const FindingItemSchema = z.object({
  packageName: z.string().min(1).max(255),
  appName: z.string().min(1).max(255),
  findingType: z.string().min(1).max(128),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  detectionEngine: z.string().max(64).default('CLIENT_ANALYZER'),
  confidence: z.number().min(0).max(1).default(0.95),
  description: z.string().min(1).max(2000),
  remediation: z.string().max(2000).optional()
});

const FindingsBatchSchema = z.object({
  findings: z.array(FindingItemSchema).max(500)
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ scanId: string }> }
) {
  const auth = await verifyClientAccessToken(req);
  if (!auth.valid) {
    return errorResponse(auth.error || 'Unauthorized', 401, 'ERR_UNAUTHORIZED');
  }

  const { scanId } = await context.params;

  try {
    // Verify scan ownership
    const scanRes = await query(
      `SELECT id, user_id, device_id FROM scan_reports WHERE id = $1 LIMIT 1`,
      [scanId]
    );

    if (scanRes.rows.length === 0) {
      return errorResponse('Scan report not found', 404, 'ERR_SCAN_NOT_FOUND');
    }

    if (scanRes.rows[0].device_id !== auth.deviceId) {
      return errorResponse('Device not authorized for this scan record', 403, 'ERR_FORBIDDEN');
    }

    const body = await req.json();
    const parsed = FindingsBatchSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Invalid findings payload schema', 400, 'ERR_INVALID_SCHEMA');
    }

    const { findings } = parsed.data;

    let critCount = 0;
    let highCount = 0;
    let medCount = 0;
    let lowCount = 0;
    let infoCount = 0;

    await transaction(async (tx) => {
      for (const f of findings) {
        if (f.severity === 'CRITICAL') critCount++;
        else if (f.severity === 'HIGH') highCount++;
        else if (f.severity === 'MEDIUM') medCount++;
        else if (f.severity === 'LOW') lowCount++;
        else infoCount++;

        const findingId = `find_${crypto.randomBytes(10).toString('hex')}`;
        await tx.query(
          `INSERT INTO scan_findings (
            id, scan_id, package_name, app_name, finding_type, severity,
            detection_engine, confidence, description, remediation, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            findingId,
            scanId,
            f.packageName,
            f.appName,
            f.findingType,
            f.severity,
            f.detectionEngine,
            f.confidence,
            f.description,
            f.remediation || null
          ]
        );
      }

      await tx.query(
        `UPDATE scan_reports SET
          critical_findings_count = critical_findings_count + $1,
          high_findings_count = high_findings_count + $2,
          medium_findings_count = medium_findings_count + $3,
          low_findings_count = low_findings_count + $4,
          info_findings_count = info_findings_count + $5,
          status = 'COMPLETED',
          finished_at = CURRENT_TIMESTAMP
        WHERE id = $6`,
        [critCount, highCount, medCount, lowCount, infoCount, scanId]
      );
    });

    return jsonResponse({
      scanId,
      acceptedFindingsCount: findings.length,
      severityCounts: {
        critical: critCount,
        high: highCount,
        medium: medCount,
        low: lowCount,
        info: infoCount
      }
    });
  } catch (err: any) {
    return errorResponse('Failed to ingest findings', 500, 'ERR_INTERNAL_SERVER');
  }
}
