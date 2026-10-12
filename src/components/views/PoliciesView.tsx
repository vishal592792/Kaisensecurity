'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  RefreshCw,
  Save,
  History,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Cpu
} from 'lucide-react';

interface SecurityPolicy {
  id: string;
  max_devices_per_key: number;
  session_lifetime_minutes: number;
  key_expiry_default_days: number;
  rate_limit_per_minute: number;
  integrity_policy: 'STRICT' | 'PERMISSIVE' | 'MONITOR_ONLY';
  min_supported_app_version: string;
  suspicious_request_threshold: number;
  scan_quota_daily: number;
  maintenance_mode: boolean;
  distribution_channel: string;
  updated_at: string;
  updated_by?: string;
}

interface PolicyVersion {
  id: string;
  version_number: number;
  changed_by: string;
  change_reason?: string;
  created_at: string;
  policy_snapshot: any;
}

export default function PoliciesView() {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [history, setHistory] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [maxDevices, setMaxDevices] = useState(3);
  const [sessionLifetime, setSessionLifetime] = useState(15);
  const [keyExpiryDays, setKeyExpiryDays] = useState(90);
  const [rateLimit, setRateLimit] = useState(60);
  const [integrityMode, setIntegrityMode] = useState<'STRICT' | 'PERMISSIVE' | 'MONITOR_ONLY'>('STRICT');
  const [minAppVer, setMinAppVer] = useState('1.0.0');
  const [suspiciousThreshold, setSuspiciousThreshold] = useState(50);
  const [scanQuota, setScanQuota] = useState(100);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [distributionChannel, setDistributionChannel] = useState('ANY');
  const [changeReason, setChangeReason] = useState('');

  const fetchPolicyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/policies');
      const data = await res.json();
      if (res.ok && data.success) {
        const p = data.data.policy;
        setPolicy(p);
        setMaxDevices(p.max_devices_per_key);
        setSessionLifetime(p.session_lifetime_minutes);
        setKeyExpiryDays(p.key_expiry_default_days);
        setRateLimit(p.rate_limit_per_minute);
        setIntegrityMode(p.integrity_policy);
        setMinAppVer(p.min_supported_app_version);
        setSuspiciousThreshold(p.suspicious_request_threshold);
        setScanQuota(p.scan_quota_daily);
        setMaintenanceMode(p.maintenance_mode);
        setDistributionChannel(p.distribution_channel);
        setHistory(data.data.versions || []);
      } else {
        setError(data.error || 'Failed to load policy configuration.');
      }
    } catch {
      setError('Communication error with policy engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    if (!changeReason.trim()) {
      alert('A change reason is mandatory for auditing zero-trust policy modifications.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDevicesPerKey: Number(maxDevices),
          sessionLifetimeMinutes: Number(sessionLifetime),
          keyExpiryDefaultDays: Number(keyExpiryDays),
          rateLimitPerMinute: Number(rateLimit),
          integrityPolicy: integrityMode,
          minSupportedAppVersion: minAppVer,
          suspiciousRequestThreshold: Number(suspiciousThreshold),
          scanQuotaDaily: Number(scanQuota),
          maintenanceMode,
          distributionChannel,
          changeReason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Security policy updated and archived to version history successfully.');
        setChangeReason('');
        fetchPolicyData();
      } else {
        setError(data.error || 'Failed to save policy.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Global Security Policies</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Enforced server-side across all client API authentication gates & scan submissions
            </p>
          </div>
          <button onClick={fetchPolicyData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Reload Active Policy</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--rose-danger)', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--emerald-success)', fontSize: '0.82rem' }}>
          {successMsg}
        </div>
      )}

      {/* Policy Editor Form */}
      <form onSubmit={handleSavePolicy} className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
            Active Enforcement Parameters
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Modifications will be staged and archived to immutable version snapshots
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Integrity Policy Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PLAY INTEGRITY ENFORCEMENT MODE
            </label>
            <select
              value={integrityMode}
              onChange={(e) => setIntegrityMode(e.target.value as any)}
              className="input-control"
            >
              <option value="STRICT">STRICT (Requires Hardware Verdict & Token)</option>
              <option value="PERMISSIVE">PERMISSIVE (Basic Device Integrity Allowed)</option>
              <option value="MONITOR_ONLY">MONITOR_ONLY (Telemetry Staged, No Rejection)</option>
            </select>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Allows gradual rollout without locking out legitimate legacy users
            </span>
          </div>

          {/* Min Supported App Version */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              MINIMUM SUPPORTED APP VERSION
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1.0.0"
              value={minAppVer}
              onChange={(e) => setMinAppVer(e.target.value)}
              className="input-control font-mono"
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Apps below this semver version will receive NO_INTEGRITY verdict
            </span>
          </div>

          {/* Max Devices */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DEFAULT MAX REGISTERED DEVICES PER KEY
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxDevices}
              onChange={(e) => setMaxDevices(Number(e.target.value))}
              className="input-control"
            />
          </div>

          {/* Session Lifetime */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CLIENT ACCESS TOKEN LIFETIME (MINUTES)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={sessionLifetime}
              onChange={(e) => setSessionLifetime(Number(e.target.value))}
              className="input-control"
            />
          </div>

          {/* Key Expiry Default */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DEFAULT KEY EXPIRATION (DAYS)
            </label>
            <input
              type="number"
              min={7}
              max={730}
              value={keyExpiryDays}
              onChange={(e) => setKeyExpiryDays(Number(e.target.value))}
              className="input-control"
            />
          </div>

          {/* Rate Limits */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              MAX REQUEST RATE LIMIT (REQ / MIN)
            </label>
            <input
              type="number"
              min={10}
              max={1000}
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
              className="input-control"
            />
          </div>

          {/* Suspicious Threshold */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SUSPICIOUS REQUEST THRESHOLD
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={suspiciousThreshold}
              onChange={(e) => setSuspiciousThreshold(Number(e.target.value))}
              className="input-control"
            />
          </div>

          {/* Daily Scan Quota */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DEFAULT DAILY SCAN QUOTA
            </label>
            <input
              type="number"
              min={10}
              max={10000}
              value={scanQuota}
              onChange={(e) => setScanQuota(Number(e.target.value))}
              className="input-control"
            />
          </div>

          {/* Distribution Channel */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DISTRIBUTION CHANNEL MANDATE
            </label>
            <select
              value={distributionChannel}
              onChange={(e) => setDistributionChannel(e.target.value)}
              className="input-control"
            >
              <option value="ANY">ANY (Unrestricted)</option>
              <option value="GOOGLE_PLAY">GOOGLE_PLAY (Play Store Verified Only)</option>
              <option value="ENTERPRISE_MDM">ENTERPRISE_MDM (Managed Mobile Profile)</option>
            </select>
          </div>

          {/* Maintenance Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
            <input
              type="checkbox"
              id="maint-mode"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--rose-danger)' }}
            />
            <label htmlFor="maint-mode" style={{ fontSize: '0.84rem', fontWeight: 600, color: maintenanceMode ? 'var(--rose-danger)' : 'var(--text-primary)', cursor: 'pointer' }}>
              Platform Maintenance Mode (Blocks all client scan submissions)
            </label>
          </div>
        </div>

        {/* Change Reason & Submit */}
        <div style={{ marginTop: '26px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--amber-warning)', marginBottom: '6px' }}>
            AUDIT CHANGE REASON (MANDATORY FOR AUDIT INTEGRITY) *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Stricter integrity rollout: Raised min app version to 1.0.0 and enabled STRICT policy"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            className="input-control"
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              {saving ? 'Archiving & Applying Policy...' : 'Save & Rollout Policy Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Policy Version History */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Versioned Policy Changelog</h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {history.length} archived snapshots
          </span>
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No previous version snapshots found.
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>VERSION</th>
                  <th>TIMESTAMP (UTC)</th>
                  <th>CHANGED BY</th>
                  <th>CHANGE REASON & AUDIT JUSTIFICATION</th>
                  <th>INTEGRITY MODE</th>
                  <th>MIN APP VER</th>
                </tr>
              </thead>
              <tbody>
                {history.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span className="badge badge-purple">v{v.version_number}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatDate(v.created_at)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{v.changed_by}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        {v.change_reason || 'Initial provisioning snapshot'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-cyan">{v.policy_snapshot?.integrity_policy || 'STRICT'}</span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: '0.78rem' }}>
                        {v.policy_snapshot?.min_supported_app_version || '1.0.0'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
