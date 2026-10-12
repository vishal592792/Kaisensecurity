/**
 * Security Audit Trail Logger
 * Append-oriented, immutable logging for administrator actions & security events
 */

import { query } from '../db';
import crypto from 'crypto';

export interface AuditEventParams {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export async function logAuditEvent(params: AuditEventParams): Promise<string> {
  const eventId = `aud_${crypto.randomBytes(12).toString('hex')}`;
  
  // Sanitize details: strictly strip any secrets, keys, or passwords
  const sanitizedDetails = sanitizeAuditPayload(params.details || {});

  try {
    await query(
      `INSERT INTO audit_events (
        id, actor_id, actor_email, action, target_type, target_id, outcome,
        request_id, ip_address, user_agent, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
      [
        eventId,
        params.actorId,
        params.actorEmail,
        params.action,
        params.targetType,
        params.targetId,
        params.outcome || 'SUCCESS',
        params.requestId || null,
        params.ipAddress || null,
        params.userAgent ? params.userAgent.slice(0, 500) : null,
        JSON.stringify(sanitizedDetails)
      ]
    );
  } catch (err) {
    console.error('CRITICAL: Failed to write audit event:', err);
  }

  return eventId;
}

/**
 * Strips raw secrets, tokens, passwords from audit logs
 */
function sanitizeAuditPayload(payload: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const forbiddenKeywords = ['password', 'secret', 'key', 'token', 'raw', 'credential', 'cookie', 'authorization'];

  for (const [k, v] of Object.entries(payload)) {
    const lowerKey = k.toLowerCase();
    if (forbiddenKeywords.some(kw => lowerKey.includes(kw) && !lowerKey.includes('id') && !lowerKey.includes('prefix') && !lowerKey.includes('masked'))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeAuditPayload(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}
