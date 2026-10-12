/**
 * Client Scan Submission Endpoint
 * POST /api/v1/scans
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { verifyClientAccessToken } from '@/lib/client-auth/session';
import { query } from '@/lib/db';

const CreateScanSchema = z.object({
  scanType: z.enum(['FULL', 'QUICK', 'VULNERABILITY', 'INTEGRITY']).default('FULL'),
  appsAssessedCount: z.number().int().min(0).max(5000).default(0),
  inaccessibleAppsCount: z.number().int().min(0).max(500).default(0),
  coveragePercent: z.number().min(0).max(100).default(100.0),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional()
});

export async function POST(req: NextRequest) {
  const auth = await verifyClientAccessToken(req);
  if (!auth.valid) {
    return errorResponse(auth.error || 'Unauthorized', 401, 'ERR_UNAUTHORIZED');
  }

  try {
    const body = await req.json();
    const parsed = CreateScanSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Invalid scan metadata schema', 400, 'ERR_INVALID_SCHEMA');
    }

    const { scanType, appsAssessedCount, inaccessibleAppsCount, coveragePercent, startedAt, finishedAt } = parsed.data;
    const scanId = `scan_${crypto.randomBytes(10).toString('hex')}`;

    await query(
      `INSERT INTO scan_reports (
        id, user_id, device_id, key_id, scan_type, apps_assessed_count,
        inaccessible_apps_count, coverage_percent, status, started_at, finished_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, CURRENT_TIMESTAMP)`,
      [
        scanId,
        auth.userId,
        auth.deviceId,
        auth.keyId,
        scanType,
        appsAssessedCount,
        inaccessibleAppsCount,
        coveragePercent,
        startedAt ? new Date(startedAt) : new Date(),
        finishedAt ? new Date(finishedAt) : new Date()
      ]
    );

    return jsonResponse({
      scanId,
      message: 'Scan report initialized. Submit findings to /api/v1/scans/' + scanId + '/findings'
    }, 201);
  } catch (err: any) {
    return errorResponse('Failed to create scan report', 500, 'ERR_INTERNAL_SERVER');
  }
}
