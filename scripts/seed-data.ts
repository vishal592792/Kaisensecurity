/**
 * Database Seeder for Kaisen SECURE ADMIN
 * Populates realistic initial users, API keys, devices, scan reports, integrity events, and notifications
 */

import crypto from 'crypto';
import { query, runMigrations } from '../src/lib/db';
import { generateApiKey } from '../src/lib/client-auth/keys';

async function seed() {
  console.log('[+] Seeding initial data for Kaisen SECURE ADMIN...');
  await runMigrations();

  // 1. Seed Users
  const users = [
    { id: 'usr_enterprise_fin', name: 'Apex Financial Services', label: 'FinTech Production', email: 'secops@apexfin.com', status: 'active', notes: 'Tier 1 enterprise banking partner' },
    { id: 'usr_health_guard', name: 'CareNet Health Systems', label: 'Healthcare Medical Apps', email: 'compliance@carenet.org', status: 'active', notes: 'HIPAA sensitive medical scanner deployment' },
    { id: 'usr_logistics_corp', name: 'Global Haul Logistics', label: 'Fleet Handheld Units', email: 'telematics@globalhaul.com', status: 'active', notes: 'Warehouse and ruggedized Android scanners' },
    { id: 'usr_suspicious_org', name: 'Vanguard Cyber Testbed', label: 'QA Lab Cluster', email: 'lab@vanguard-qa.internal', status: 'suspended', notes: 'Temporarily suspended due to anomalous scan payload volume' },
  ];

  for (const u of users) {
    const existing = await query(`SELECT id FROM users WHERE id = $1`, [u.id]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO users (id, name, label, email, status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [u.id, u.name, u.label, u.email, u.status, u.notes]
      );
    }
  }

  // 2. Seed API Keys
  const keyConfigs = [
    { id: 'ksk_id_fin_live_01', userId: 'usr_enterprise_fin', status: 'active', deviceLimit: 5, prefix: 'ksk_live_', sampleSuffix: '8f92', expDays: 180, note: 'Production API Key for Banking App' },
    { id: 'ksk_id_health_01', userId: 'usr_health_guard', status: 'active', deviceLimit: 10, prefix: 'ksk_live_', sampleSuffix: '3c11', expDays: 90, note: 'CareNet tablet fleet key' },
    { id: 'ksk_id_logistics_01', userId: 'usr_logistics_corp', status: 'active', deviceLimit: 25, prefix: 'ksk_live_', sampleSuffix: '7a4b', expDays: 365, note: 'Fleet Android Handheld key' },
    { id: 'ksk_id_suspended_01', userId: 'usr_suspicious_org', status: 'suspended', deviceLimit: 2, prefix: 'ksk_live_', sampleSuffix: '009e', expDays: 30, note: 'Suspended QA key' },
    { id: 'ksk_id_revoked_demo', userId: 'usr_enterprise_fin', status: 'revoked', deviceLimit: 3, prefix: 'ksk_live_', sampleSuffix: 'dead', expDays: -10, note: 'Old rotated credential' },
  ];

  for (const kc of keyConfigs) {
    const existing = await query(`SELECT id FROM api_keys WHERE id = $1`, [kc.id]);
    if (existing.rows.length === 0) {
      const { rawKey, keyHmac } = generateApiKey(kc.prefix);
      const maskedKey = `${kc.prefix}••••••••••••${kc.sampleSuffix}`;
      const expiresAt = new Date(Date.now() + kc.expDays * 86400 * 1000);

      await query(
        `INSERT INTO api_keys (
          id, user_id, key_prefix, masked_key, key_hmac, status, device_limit,
          device_binding_enabled, scan_quota_daily, rate_limit_per_minute,
          expires_at, created_at, internal_note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 100, 60, $8, CURRENT_TIMESTAMP, $9)`,
        [kc.id, kc.userId, kc.prefix, maskedKey, keyHmac, kc.status, kc.deviceLimit, expiresAt, kc.note]
      );
    }
  }

  // 3. Seed Registered Devices
  const devices = [
    { id: 'dev_pixel8_pro_01', userId: 'usr_enterprise_fin', keyId: 'ksk_id_fin_live_01', installId: 'app_inst_4a88bc91f', appVer: '1.2.0', androidVer: '14.0', status: 'registered', integrity: 'VERIFIED', ip: '198.51.100.24' },
    { id: 'dev_galaxy_s24_01', userId: 'usr_health_guard', keyId: 'ksk_id_health_01', installId: 'app_inst_99e120bc7', appVer: '1.2.0', androidVer: '14.0', status: 'registered', integrity: 'VERIFIED', ip: '203.0.113.88' },
    { id: 'dev_zebra_tc57_01', userId: 'usr_logistics_corp', keyId: 'ksk_id_logistics_01', installId: 'app_inst_11d4e339a', appVer: '1.1.8', androidVer: '13.0', status: 'registered', integrity: 'VERIFIED', ip: '192.0.2.145' },
    { id: 'dev_compromised_emu', userId: 'usr_suspicious_org', keyId: 'ksk_id_suspended_01', installId: 'app_inst_emu_root_001', appVer: '1.0.0', androidVer: '11.0', status: 'revoked', integrity: 'FAILED', ip: '185.220.101.5' },
  ];

  for (const d of devices) {
    const existing = await query(`SELECT id FROM devices WHERE id = $1`, [d.id]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO devices (
          id, user_id, key_id, app_installation_id, app_version, android_version,
          status, integrity_status, first_seen_at, last_seen_at, last_ip
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9)`,
        [d.id, d.userId, d.keyId, d.installId, d.appVer, d.androidVer, d.status, d.integrity, d.ip]
      );
    }
  }

  // 4. Seed Scan Reports & Findings
  const scans = [
    {
      id: 'scan_report_9981a',
      userId: 'usr_enterprise_fin',
      deviceId: 'dev_pixel8_pro_01',
      keyId: 'ksk_id_fin_live_01',
      scanType: 'FULL',
      assessed: 142,
      inaccessible: 3,
      crit: 0, high: 1, med: 3, low: 8, info: 12,
      findings: [
        { pkg: 'com.thirdparty.keyboard.free', app: 'SwiftKey Theme Mod', type: 'KEYLOGGER_POTENTIAL', sev: 'HIGH', desc: 'Application requests ACCESS_FINE_LOCATION and android.permission.BIND_ACCESSIBILITY_SERVICE without justification.', rem: 'Recommend user uninstall or revoke accessibility permissions immediately.' },
        { pkg: 'com.tools.batteryboost', app: 'Battery Ultra Saver', type: 'OVER_PRIVILEGED_APP', sev: 'MEDIUM', desc: 'Contains embedded ad-network SDK with dynamic code execution (DexClassLoader).', rem: 'Audit APK signature and enforce device enterprise profile.' }
      ]
    },
    {
      id: 'scan_report_8820c',
      userId: 'usr_health_guard',
      deviceId: 'dev_galaxy_s24_01',
      keyId: 'ksk_id_health_01',
      scanType: 'INTEGRITY',
      assessed: 88,
      inaccessible: 0,
      crit: 0, high: 0, med: 1, low: 4, info: 9,
      findings: [
        { pkg: 'com.carenet.patientchart', app: 'CareNet Charting', type: 'BACKUP_ALLOWED', sev: 'MEDIUM', desc: 'android:allowBackup is enabled in AndroidManifest.xml. Medical cache could be extracted via ADB backup.', rem: 'Set android:allowBackup="false" in release build configuration.' }
      ]
    },
    {
      id: 'scan_report_emu_threat',
      userId: 'usr_suspicious_org',
      deviceId: 'dev_compromised_emu',
      keyId: 'ksk_id_suspended_01',
      scanType: 'FULL',
      assessed: 45,
      inaccessible: 12,
      crit: 2, high: 3, med: 2, low: 1, info: 0,
      findings: [
        { pkg: 'eu.chainfire.supersu', app: 'SuperSU Root Daemon', type: 'ROOT_MANAGEMENT_APP', sev: 'CRITICAL', desc: 'Root management daemon binary detected in /system/xbin/su. SELinux set to Permissive.', rem: 'Device fails enterprise zero-trust policy. Immediate access revocation.' },
        { pkg: 'de.robv.android.xposed.installer', app: 'Xposed Framework Installer', type: 'HOOKING_FRAMEWORK', sev: 'CRITICAL', desc: 'Runtime method hooking framework active. Memory tampering detected.', rem: 'Block access to protected APIs until rooted environment is remediated.' }
      ]
    }
  ];

  for (const s of scans) {
    const existing = await query(`SELECT id FROM scan_reports WHERE id = $1`, [s.id]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO scan_reports (
          id, user_id, device_id, key_id, scan_type, apps_assessed_count, inaccessible_apps_count,
          critical_findings_count, high_findings_count, medium_findings_count, low_findings_count,
          info_findings_count, coverage_percent, status, started_at, finished_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 98.5, 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [s.id, s.userId, s.deviceId, s.keyId, s.scanType, s.assessed, s.inaccessible, s.crit, s.high, s.med, s.low, s.info]
      );

      for (const f of s.findings) {
        const findId = `find_${crypto.randomBytes(8).toString('hex')}`;
        await query(
          `INSERT INTO scan_findings (
            id, scan_id, package_name, app_name, finding_type, severity, detection_engine,
            confidence, description, remediation, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'CLIENT_ANALYZER', 0.95, $7, $8, CURRENT_TIMESTAMP)`,
          [findId, s.id, f.pkg, f.app, f.type, f.sev, f.desc, f.rem]
        );
      }
    }
  }

  // 5. Seed Integrity Events
  const events = [
    { id: 'evt_integrity_root_01', cat: 'FAILED_INTEGRITY_VERIFICATION', sev: 'CRITICAL', keyId: 'ksk_id_suspended_01', userId: 'usr_suspicious_org', devId: 'dev_compromised_emu', appVer: '1.0.0', ip: '185.220.101.5', status: 'INVESTIGATING', desc: 'Play Integrity Hardware backed verdict NO_INTEGRITY. Magisk / Zygisk detection triggered.' },
    { id: 'evt_dev_limit_02', cat: 'DEVICE_LIMIT_VIOLATION', sev: 'HIGH', keyId: 'ksk_id_fin_live_01', userId: 'usr_enterprise_fin', devId: null, appVer: '1.2.0', ip: '198.51.100.99', status: 'RESOLVED', desc: 'Attempted to bind 6th device when maximum limit is 5. Request rejected.' },
    { id: 'evt_version_depr_03', cat: 'UNRECOGNIZED_APP_VERSION', sev: 'MEDIUM', keyId: 'ksk_id_logistics_01', userId: 'usr_logistics_corp', devId: 'dev_zebra_tc57_01', appVer: '0.9.8', ip: '192.0.2.145', status: 'NEW', desc: 'App version 0.9.8 is below minimum policy version 1.0.0.' },
    { id: 'evt_invalid_key_04', cat: 'INVALID_API_KEY', sev: 'LOW', keyId: null, userId: null, devId: null, appVer: '1.2.0', ip: '45.33.32.156', status: 'NEW', desc: 'Authentication attempt with non-existent HMAC verifier prefix ksk_live_... rejected.' }
  ];

  for (const e of events) {
    const existing = await query(`SELECT id FROM integrity_events WHERE id = $1`, [e.id]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO integrity_events (
          id, category, severity, key_id, user_id, device_id, app_version,
          details, safe_ip, resolution_status, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [e.id, e.cat, e.sev, e.keyId, e.userId, e.devId, e.appVer, JSON.stringify({ reason: e.desc }), e.ip, e.status]
      );
    }
  }

  // 6. Seed Notifications
  const notifs = [
    { id: 'notif_001', title: 'Critical Integrity Breach Detected', msg: 'Device dev_compromised_emu failed hardware integrity checks. Access suspended.', sev: 'CRITICAL', cat: 'SECURITY' },
    { id: 'notif_002', title: 'Device Limit Exceeded', msg: 'Key ksk_live_••••8f92 reached maximum device registration threshold (5/5).', sev: 'WARNING', cat: 'DEVICE' },
    { id: 'notif_003', title: 'API Key Expiry Notice', msg: 'Key ksk_live_••••3c11 expires in 90 days. Planned rotation recommended.', sev: 'INFO', cat: 'LIFECYCLE' }
  ];

  for (const n of notifs) {
    const existing = await query(`SELECT id FROM notifications WHERE id = $1`, [n.id]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO notifications (id, title, message, severity, category, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
        [n.id, n.title, n.msg, n.sev, n.cat]
      );
    }
  }

  console.log('[✔] Database populated with realistic operational records!');
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error('[X] Seed failed:', err);
  process.exit(1);
});
