/**
 * PostgreSQL Database Layer for Kaisen SECURE ADMIN
 * Supports external PostgreSQL via DATABASE_URL or embedded persistent PostgreSQL (PGlite)
 */

import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { APP_CONFIG } from '../config/env';

// Global singleton instances to persist across Next.js HMR reloads
declare global {
  // eslint-disable-next-line no-var
  var __kaisen_pg_pool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __kaisen_pglite: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __kaisen_db_initialized: Promise<void> | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = APP_CONFIG.database.url;

let pool: Pool | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDbClient() {
  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    if (!global.__kaisen_pg_pool) {
      global.__kaisen_pg_pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
    pool = global.__kaisen_pg_pool;
    return { type: 'pool' as const, client: pool };
  } else {
    if (!global.__kaisen_pglite) {
      const dataDir = path.join(process.cwd(), 'data', 'postgres');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      global.__kaisen_pglite = new PGlite(dataDir);
    }
    pgliteInstance = global.__kaisen_pglite;
    return { type: 'pglite' as const, client: pgliteInstance };
  }
}

/**
 * Execute a parameterized PostgreSQL query
 */
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  await ensureInitialized();
  const db = await getDbClient();

  try {
    if (db.type === 'pool') {
      const res = await db.client.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount || 0 };
    } else {
      const res = await db.client.query(sql, params);
      return { rows: (res.rows || []) as T[], rowCount: res.rows?.length || 0 };
    }
  } catch (error) {
    console.error('Database query error:', error, { sql: sql.slice(0, 100), params });
    throw error;
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (executor: { query: <R = any>(sql: string, params?: any[]) => Promise<{ rows: R[]; rowCount: number }> }) => Promise<T>
): Promise<T> {
  await ensureInitialized();
  const db = await getDbClient();

  if (db.type === 'pool') {
    const client = await db.client.connect();
    try {
      await client.query('BEGIN');
      const res = await callback({
        query: async <R = any>(sql: string, params: any[] = []) => {
          const r = await client.query(sql, params);
          return { rows: r.rows as R[], rowCount: r.rowCount || 0 };
        }
      });
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // PGlite transaction
    return await db.client.transaction(async (tx) => {
      return await callback({
        query: async <R = any>(sql: string, params: any[] = []) => {
          const r = await tx.query(sql, params);
          return { rows: (r.rows || []) as R[], rowCount: r.rows?.length || 0 };
        }
      });
    });
  }
}

/**
 * Run migrations and seed baseline records
 */
export async function runMigrations() {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  const db = await getDbClient();

  // Execute schema definitions
  if (db.type === 'pool') {
    await db.client.query(schemaSql);
  } else {
    await db.client.exec(schemaSql);
  }

  // Seed default policy if not exists
  const policyRes = await (db.type === 'pool' 
    ? db.client.query("SELECT id FROM security_policies WHERE id = 'policy_default'")
    : db.client.query("SELECT id FROM security_policies WHERE id = 'policy_default'"));

  if (policyRes.rows.length === 0) {
    const defaultPolicySql = `
      INSERT INTO security_policies (
        id, max_devices_per_key, session_lifetime_minutes, key_expiry_default_days,
        rate_limit_per_minute, integrity_policy, min_supported_app_version,
        suspicious_request_threshold, scan_quota_daily, maintenance_mode, distribution_channel, updated_by
      ) VALUES (
        'policy_default', 3, 15, 90, 60, 'STRICT', '1.0.0', 50, 100, false, 'ANY', 'SYSTEM_PROVISION'
      );
    `;
    if (db.type === 'pool') {
      await db.client.query(defaultPolicySql);
    } else {
      await db.client.query(defaultPolicySql);
    }
  }

  // Seed notification settings if not exists
  const notifRes = await (db.type === 'pool'
    ? db.client.query("SELECT id FROM notification_settings WHERE id = 'default'")
    : db.client.query("SELECT id FROM notification_settings WHERE id = 'default'"));

  if (notifRes.rows.length === 0) {
    const notifSql = `
      INSERT INTO notification_settings (
        id, notify_failed_logins, failed_login_threshold, notify_high_risk_integrity,
        notify_new_device, notify_key_expiry, key_expiry_warning_days, notify_key_revocation,
        notify_scan_anomalies, email_alerts_enabled, alert_email
      ) VALUES (
        'default', true, 5, true, true, true, 7, true, true, false, 'security@kaisensecurity.com'
      );
    `;
    if (db.type === 'pool') {
      await db.client.query(notifSql);
    } else {
      await db.client.query(notifSql);
    }
  }

  // Seed threat intel default configurations
  const threatConfigs = [
    { id: 'virustotal', name: 'VirusTotal Intelligence', quota: 4, timeout: 5000 },
    { id: 'alienvault', name: 'AlienVault OTX', quota: 10, timeout: 6000 },
    { id: 'abuseipdb', name: 'AbuseIPDB Threat Feed', quota: 20, timeout: 4000 },
    { id: 'kaisen_feed', name: 'Kaisen Proprietary Threat Feed', quota: 100, timeout: 3000 }
  ];

  for (const cfg of threatConfigs) {
    const checkSql = `SELECT id FROM threat_intel_configs WHERE id = $1`;
    const res = await (db.type === 'pool' ? db.client.query(checkSql, [cfg.id]) : db.client.query(checkSql, [cfg.id]));
    if (res.rows.length === 0) {
      const insertSql = `
        INSERT INTO threat_intel_configs (
          id, name, api_key_masked, is_enabled, quota_per_minute, timeout_ms, status
        ) VALUES ($1, $2, 'Not Configured', false, $3, $4, 'UNCONFIGURED');
      `;
      await (db.type === 'pool' ? db.client.query(insertSql, [cfg.id, cfg.name, cfg.quota, cfg.timeout]) : db.client.query(insertSql, [cfg.id, cfg.name, cfg.quota, cfg.timeout]));
    }
  }
}

/**
 * Helper to ensure migrations run once at start
 */
export async function ensureInitialized() {
  if (!global.__kaisen_db_initialized) {
    global.__kaisen_db_initialized = runMigrations().catch((err) => {
      console.error('Failed to initialize database:', err);
      global.__kaisen_db_initialized = undefined;
      throw err;
    });
  }
  return global.__kaisen_db_initialized;
}
