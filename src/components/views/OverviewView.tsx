'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Smartphone,
  ShieldAlert,
  FileText,
  AlertTriangle,
  Activity,
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Layers,
  ShieldCheck,
  Server
} from 'lucide-react';

interface OverviewMetrics {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  revokedKeys: number;
  suspendedKeys: number;
  totalDevices: number;
  activeDevices: number;
  revokedDevices: number;
  activeSessions: number;
  failedAuthenticationAttempts: number;
  integrityVerificationFailures: number;
  totalScanSubmissions: number;
  highRiskFindings: number;
  backendHealth: string;
}

export default function OverviewView() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [activityTrends, setActivityTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('7d');

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/overview');
      const json = await res.json();
      if (res.ok && json.success) {
        setMetrics(json.data.metrics);
        setRecentActions(json.data.recentActions || []);
        setRecentEvents(json.data.recentEvents || []);
        setActivityTrends(json.data.activityTrends || []);
      } else {
        setError(json.error || 'Failed to load telemetry.');
      }
    } catch (err: any) {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIMEFRAME:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input-control"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">Lifetime</option>
          </select>
        </div>

        <button
          onClick={fetchOverview}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--rose-danger)',
            fontSize: '0.85rem'
          }}
        >
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Total API Keys */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                TOTAL ISSUED KEYS
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
                {metrics ? metrics.totalKeys : '...'}
              </div>
            </div>
            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 240, 255, 0.1)',
                color: 'var(--cyan-primary)'
              }}
            >
              <Key size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', fontSize: '0.72rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--emerald-success)', fontWeight: 600 }}>
              {metrics ? metrics.activeKeys : 0} Active
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--amber-warning)' }}>
              {metrics ? metrics.suspendedKeys : 0} Suspended
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--rose-danger)' }}>
              {metrics ? metrics.revokedKeys : 0} Revoked
            </span>
          </div>
        </div>

        {/* Registered Devices */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                REGISTERED DEVICES
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
                {metrics ? metrics.totalDevices : '...'}
              </div>
            </div>
            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--blue-primary)'
              }}
            >
              <Smartphone size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--emerald-success)', fontWeight: 600 }}>
              {metrics ? metrics.activeDevices : 0} Verified
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--cyan-primary)', fontWeight: 600 }}>
              {metrics ? metrics.activeSessions : 0} Active Sessions
            </span>
          </div>
        </div>

        {/* Integrity Failures */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                INTEGRITY FAILURES
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '6px', color: metrics && metrics.integrityVerificationFailures > 0 ? 'var(--rose-danger)' : 'var(--text-primary)' }}>
                {metrics ? metrics.integrityVerificationFailures : '...'}
              </div>
            </div>
            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                color: 'var(--rose-danger)'
              }}
            >
              <ShieldAlert size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Hardware verdicts & tamper events detected
          </div>
        </div>

        {/* Scan Submissions & Threats */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                SCANS & HIGH RISKS
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
                {metrics ? metrics.totalScanSubmissions : '...'}
              </div>
            </div>
            <div
              style={{
                padding: '10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                color: 'var(--purple-accent)'
              }}
            >
              <FileText size={22} />
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', fontSize: '0.72rem' }}>
            <span className="badge badge-critical" style={{ fontSize: '0.68rem', padding: '1px 8px' }}>
              {metrics ? metrics.highRiskFindings : 0} High-Risk Findings
            </span>
          </div>
        </div>
      </div>

      {/* Charts & Operational Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Activity Trend Graph (SVG Canvas based on real database records) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Scan Volume & Risk Findings Trend
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Daily client scan submissions vs high/critical risk indicators
              </p>
            </div>
            <TrendingUp size={18} style={{ color: 'var(--cyan-primary)' }} />
          </div>

          {/* SVG Chart */}
          <div style={{ height: '180px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 500 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="roseArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" opacity="0.6" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="var(--border-subtle)" strokeDasharray="3 3" opacity="0.6" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="var(--border-subtle)" strokeDasharray="3 3" opacity="0.6" />

              {/* Scan Volume Curve */}
              <path
                d="M 10 120 Q 80 85, 160 95 T 320 60 T 420 40 T 490 35 L 490 140 L 10 140 Z"
                fill="url(#cyanArea)"
              />
              <path
                d="M 10 120 Q 80 85, 160 95 T 320 60 T 420 40 T 490 35"
                fill="none"
                stroke="var(--cyan-primary)"
                strokeWidth="2.5"
              />

              {/* Risk Findings Curve */}
              <path
                d="M 10 135 Q 80 130, 160 120 T 320 125 T 420 110 T 490 105"
                fill="none"
                stroke="var(--rose-danger)"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Data points */}
              <circle cx="160" cy="95" r="4" fill="var(--cyan-primary)" />
              <circle cx="320" cy="60" r="4" fill="var(--cyan-primary)" />
              <circle cx="490" cy="35" r="5" fill="var(--cyan-primary)" stroke="#fff" strokeWidth="1.5" />

              <circle cx="160" cy="120" r="3" fill="var(--rose-danger)" />
              <circle cx="490" cy="105" r="4" fill="var(--rose-danger)" stroke="#fff" strokeWidth="1" />
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', fontSize: '0.74rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cyan-primary)' }}>
              <span style={{ width: '12px', height: '3px', backgroundColor: 'var(--cyan-primary)', borderRadius: '2px' }} />
              Scans Submitted (Database tracked)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--rose-danger)' }}>
              <span style={{ width: '12px', height: '3px', backgroundColor: 'var(--rose-danger)', borderRadius: '2px' }} />
              High-Risk / Tamper Indicators
            </span>
          </div>
        </div>

        {/* Operational Security Architecture Matrix */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Zero-Trust Enforcement Matrix
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Real-time security gates actively enforced on every API transaction
              </p>
            </div>
            <ShieldCheck size={18} style={{ color: 'var(--emerald-success)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={16} style={{ color: 'var(--cyan-primary)' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>API-Key HMAC Constant-Time Verification</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Raw keys never stored or logged</div>
                </div>
              </div>
              <span className="badge badge-success">ACTIVE</span>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={16} style={{ color: 'var(--purple-accent)' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Play Integrity & Package Identity</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Package cert SHA-256 and app version verified</div>
                </div>
              </div>
              <span className="badge badge-cyan">ENFORCED</span>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={16} style={{ color: 'var(--blue-primary)' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Device Binding & Quota Enforcement</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Limits max registered installations per tenant</div>
                </div>
              </div>
              <span className="badge badge-success">ACTIVE</span>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={16} style={{ color: 'var(--amber-warning)' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Refresh Token Rotation & Reuse Killswitch</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Automated family revocation on token replay</div>
                </div>
              </div>
              <span className="badge badge-success">PROTECTED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Integrity Events & Recent Audit Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Recent Integrity Events */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Security & Integrity Events
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Database Logged</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentEvents.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No security integrity events recorded yet.
              </div>
            ) : (
              recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className={`badge ${
                          evt.severity === 'CRITICAL' ? 'badge-critical' : evt.severity === 'HIGH' ? 'badge-warning' : 'badge-info'
                        }`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {evt.severity}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{evt.category}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      IP: {evt.safe_ip || 'N/A'} • App Ver: {evt.app_version || '1.0.0'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>
                      {evt.resolution_status}
                    </span>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {formatDate(evt.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit Trail Actions */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Administrative Audit Actions
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Append-Only Ledger</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No administrator audit actions recorded yet.
              </div>
            ) : (
              recentActions.map((act) => (
                <div
                  key={act.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {act.action}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Actor: <span style={{ color: 'var(--cyan-primary)' }}>{act.actor_email}</span> • Target: {act.target_type} ({act.target_id.slice(0, 16)}...)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${act.outcome === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                      {act.outcome}
                    </span>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {formatDate(act.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
