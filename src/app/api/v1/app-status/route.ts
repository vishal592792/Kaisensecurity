/**
 * Backend Operational Health & App Status Endpoint
 * GET /api/v1/app-status
 */

import { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { APP_CONFIG } from '@/lib/config/env';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  let dbStatus = 'HEALTHY';
  let latencyMs = 0;

  try {
    const start = Date.now();
    await query('SELECT 1');
    latencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = 'DEGRADED';
  }

  return jsonResponse({
    status: dbStatus === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED',
    platform: APP_CONFIG.name,
    version: APP_CONFIG.version,
    database: {
      status: dbStatus,
      latencyMs
    },
    owner: {
      name: APP_CONFIG.owner.name,
      contact: APP_CONFIG.owner.contact
    },
    timestamp: new Date().toISOString()
  });
}
