-- Kaisen SECURE ADMIN - PostgreSQL Schema
-- Migration 001_initial_schema.sql

CREATE TABLE IF NOT EXISTS administrators (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'SECURITY_ADMIN', -- SUPER_ADMIN, SECURITY_ADMIN, READ_ONLY_ANALYST
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS administrator_mfa (
  admin_id VARCHAR(64) PRIMARY KEY REFERENCES administrators(id) ON DELETE CASCADE,
  totp_secret TEXT NOT NULL,
  recovery_codes_hash TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS administrator_sessions (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS administrator_password_resets (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  label VARCHAR(128) NOT NULL,
  email VARCHAR(255) NULL,
  contact_info TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, suspended
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(64) PRIMARY KEY, -- e.g. ksk_id_...
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_prefix VARCHAR(32) NOT NULL DEFAULT 'ksk_live_',
  masked_key VARCHAR(64) NOT NULL,
  key_hmac VARCHAR(128) UNIQUE NOT NULL, -- Stored verifier only, never raw key
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, suspended, revoked, expired, pending
  device_limit INTEGER NOT NULL DEFAULT 3,
  device_binding_enabled BOOLEAN NOT NULL DEFAULT true,
  scan_quota_daily INTEGER NOT NULL DEFAULT 100,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL,
  last_authenticated_at TIMESTAMPTZ NULL,
  failed_auth_count INTEGER NOT NULL DEFAULT 0,
  internal_note TEXT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(64) PRIMARY KEY, -- Server generated dev_...
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id VARCHAR(64) NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  app_installation_id VARCHAR(128) NOT NULL,
  app_version VARCHAR(32) NOT NULL,
  android_version VARCHAR(32) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'registered', -- registered, revoked, pending
  integrity_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED', -- VERIFIED, UNVERIFIED, FAILED
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_ip VARCHAR(45) NULL,
  revoked_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_device_install UNIQUE (key_id, app_installation_id)
);

CREATE TABLE IF NOT EXISTS client_sessions (
  id VARCHAR(64) PRIMARY KEY,
  key_id VARCHAR(64) NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_jti VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, revoked, expired
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES client_sessions(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  family_id VARCHAR(64) NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authentication_events (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type VARCHAR(64) NOT NULL,
  key_id VARCHAR(64) NULL,
  user_id VARCHAR(64) NULL,
  device_id VARCHAR(64) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  failure_reason TEXT NULL,
  metadata JSONB NULL
);

CREATE TABLE IF NOT EXISTS integrity_events (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
  key_id VARCHAR(64) NULL,
  user_id VARCHAR(64) NULL,
  device_id VARCHAR(64) NULL,
  app_version VARCHAR(32) NULL,
  details JSONB NULL,
  safe_ip VARCHAR(45) NULL,
  resolution_status VARCHAR(32) NOT NULL DEFAULT 'NEW', -- NEW, INVESTIGATING, RESOLVED, FALSE_POSITIVE
  reviewed_by VARCHAR(64) NULL,
  reviewed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS scan_reports (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  key_id VARCHAR(64) NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  scan_type VARCHAR(32) NOT NULL DEFAULT 'FULL', -- FULL, QUICK, VULNERABILITY, INTEGRITY
  apps_assessed_count INTEGER NOT NULL DEFAULT 0,
  inaccessible_apps_count INTEGER NOT NULL DEFAULT 0,
  critical_findings_count INTEGER NOT NULL DEFAULT 0,
  high_findings_count INTEGER NOT NULL DEFAULT 0,
  medium_findings_count INTEGER NOT NULL DEFAULT 0,
  low_findings_count INTEGER NOT NULL DEFAULT 0,
  info_findings_count INTEGER NOT NULL DEFAULT 0,
  coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 100.0,
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED', -- PENDING, COMPLETED, FAILED
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_findings (
  id VARCHAR(64) PRIMARY KEY,
  scan_id VARCHAR(64) NOT NULL REFERENCES scan_reports(id) ON DELETE CASCADE,
  package_name VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) NOT NULL,
  finding_type VARCHAR(128) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- CRITICAL, HIGH, MEDIUM, LOW, INFO
  detection_engine VARCHAR(64) NOT NULL DEFAULT 'CLIENT_ANALYZER',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.95,
  description TEXT NOT NULL,
  remediation TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_policies (
  id VARCHAR(64) PRIMARY KEY,
  max_devices_per_key INTEGER NOT NULL DEFAULT 3,
  session_lifetime_minutes INTEGER NOT NULL DEFAULT 15,
  key_expiry_default_days INTEGER NOT NULL DEFAULT 90,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  integrity_policy VARCHAR(32) NOT NULL DEFAULT 'STRICT', -- STRICT, PERMISSIVE, MONITOR_ONLY
  min_supported_app_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  suspicious_request_threshold INTEGER NOT NULL DEFAULT 50,
  scan_quota_daily INTEGER NOT NULL DEFAULT 100,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  distribution_channel VARCHAR(64) NOT NULL DEFAULT 'ANY',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(64) NULL
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id VARCHAR(64) PRIMARY KEY,
  policy_id VARCHAR(64) NOT NULL,
  version_number INTEGER NOT NULL,
  policy_snapshot JSONB NOT NULL,
  changed_by VARCHAR(64) NOT NULL,
  change_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS threat_intel_configs (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  api_key_masked VARCHAR(64) NOT NULL DEFAULT 'Not Configured',
  api_key_encrypted TEXT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  quota_per_minute INTEGER NOT NULL DEFAULT 4,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  status VARCHAR(32) NOT NULL DEFAULT 'UNCONFIGURED', -- HEALTHY, DEGRADED, UNCONFIGURED, ERROR
  last_check_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id VARCHAR(64) PRIMARY KEY,
  notify_failed_logins BOOLEAN NOT NULL DEFAULT true,
  failed_login_threshold INTEGER NOT NULL DEFAULT 5,
  notify_high_risk_integrity BOOLEAN NOT NULL DEFAULT true,
  notify_new_device BOOLEAN NOT NULL DEFAULT true,
  notify_key_expiry BOOLEAN NOT NULL DEFAULT true,
  key_expiry_warning_days INTEGER NOT NULL DEFAULT 7,
  notify_key_revocation BOOLEAN NOT NULL DEFAULT true,
  notify_scan_anomalies BOOLEAN NOT NULL DEFAULT true,
  email_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
  alert_email VARCHAR(255) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
  category VARCHAR(64) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL,
  actor_email VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  outcome VARCHAR(16) NOT NULL DEFAULT 'SUCCESS', -- SUCCESS, FAILURE
  request_id VARCHAR(64) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Essential Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_hmac ON api_keys(key_hmac);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_devices_key ON devices(key_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_time ON authentication_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_events_time ON integrity_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_reports_user ON scan_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_reports_key ON scan_reports(key_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read, created_at DESC);
