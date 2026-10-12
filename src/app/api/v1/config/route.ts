/**
 * Client Public Configuration Endpoint
 * GET /api/v1/config
 */

import { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/api-response';
import { APP_CONFIG } from '@/lib/config/env';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const policyRes = await query(`SELECT min_supported_app_version, maintenance_mode, distribution_channel FROM security_policies WHERE id = 'policy_default' LIMIT 1`);
  const policy = policyRes.rows[0] || {
    min_supported_app_version: '1.0.0',
    maintenance_mode: false,
    distribution_channel: 'ANY'
  };

  return jsonResponse({
    productName: APP_CONFIG.productName,
    platform: APP_CONFIG.name,
    owner: {
      name: APP_CONFIG.owner.name,
      contact: APP_CONFIG.owner.contact
    },
    minSupportedAppVersion: policy.min_supported_app_version,
    maintenanceMode: policy.maintenance_mode,
    distributionChannel: policy.distribution_channel,
    serverTime: new Date().toISOString()
  });
}
