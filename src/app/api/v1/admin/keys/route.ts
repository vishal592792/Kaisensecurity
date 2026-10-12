/**
 * Admin API Keys Management
 * GET /api/v1/admin/keys - List keys with search, filter, pagination
 * POST /api/v1/admin/keys - Create new key (returns rawKey ONCE)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/api-response';
import { getAuthenticatedAdmin } from '@/lib/auth/admin-auth';
import { generateApiKey } from '@/lib/client-auth/keys';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateKeySchema = z.object({
  userId: z.string().min(1),
  internalNote: z.string().max(1000).optional(),
  expiryDays: z.number().int().min(1).max(730).default(90),
  deviceLimit: z.number().int().min(1).max(50).default(3),
  deviceBindingEnabled: z.boolean().default(true),
  scanQuotaDaily: z.number().int().min(1).max(10000).default(100),
  rateLimitPerMinute: z.number().int().min(1).max(1000).default(60)
});

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(k.id) LIKE $${params.length} OR LOWER(k.masked_key) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length} OR LOWER(u.label) LIKE $${params.length})`);
  }

  if (status && ['active', 'suspended', 'revoked', 'expired', 'pending'].includes(status)) {
    params.push(status);
    conditions.push(`k.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countRes = await query(`
    SELECT COUNT(*) as total
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    ${whereClause}
  `, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  // Fetch paginated
  params.push(limit, offset);
  const sql = `
    SELECT 
      k.id, k.user_id, k.masked_key, k.status, k.device_limit,
      k.device_binding_enabled, k.scan_quota_daily, k.rate_limit_per_minute,
      k.expires_at, k.created_at, k.last_authenticated_at, k.failed_auth_count,
      k.internal_note, k.revoked_at, k.revoked_reason,
      u.name as user_name, u.label as user_label,
      (SELECT COUNT(*) FROM devices d WHERE d.key_id = k.id AND d.status = 'registered') as registered_device_count
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    ${whereClause}
    ORDER BY k.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await query(sql, params);

  return jsonResponse({
    keys: rows.rows.map(r => ({
      ...r,
      registered_device_count: parseInt(r.registered_device_count || '0', 10)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

export async function POST(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) return errorResponse('Unauthorized', 401, 'ERR_UNAUTHORIZED');

  // Read-only analyst cannot create keys
  if (admin.role === 'READ_ONLY_ANALYST') {
    return errorResponse('Read-only analyst role cannot create API keys', 403, 'ERR_FORBIDDEN');
  }

  try {
    const body = await req.json();
    const parsed = CreateKeySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid key creation payload', 400, 'ERR_INVALID_SCHEMA');
    }

    const { userId, internalNote, expiryDays, deviceLimit, deviceBindingEnabled, scanQuotaDaily, rateLimitPerMinute } = parsed.data;

    // Check user exists
    const userRes = await query(`SELECT id, name, status FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (userRes.rows.length === 0) {
      return errorResponse('Target user not found', 404, 'ERR_USER_NOT_FOUND');
    }

    // Cryptographic key generation
    const keyData = generateApiKey('ksk_live_');
    const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000);

    await query(
      `INSERT INTO api_keys (
        id, user_id, key_prefix, masked_key, key_hmac, status, device_limit,
        device_binding_enabled, scan_quota_daily, rate_limit_per_minute,
        expires_at, created_at, internal_note
      ) VALUES ($1, $2, 'ksk_live_', $3, $4, 'active', $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)`,
      [
        keyData.keyId,
        userId,
        keyData.maskedKey,
        keyData.keyHmac,
        deviceLimit,
        deviceBindingEnabled,
        scanQuotaDaily,
        rateLimitPerMinute,
        expiresAt,
        internalNote || null
      ]
    );

    // Audit log
    await logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'API_KEY_CREATED',
      targetType: 'api_key',
      targetId: keyData.keyId,
      outcome: 'SUCCESS',
      details: {
        userId,
        maskedKey: keyData.maskedKey,
        deviceLimit,
        expiryDays
      }
    });

    // Return the raw key ONLY once
    return jsonResponse({
      keyId: keyData.keyId,
      maskedKey: keyData.maskedKey,
      rawKey: keyData.rawKey,
      expiresAt: expiresAt.toISOString(),
      deviceLimit,
      message: 'Store this key now. It will never be displayed again in plaintext.'
    }, 201);
  } catch (err: any) {
    return errorResponse('Failed to create API key', 500, 'ERR_INTERNAL_SERVER');
  }
}
