'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
  Key,
  Clock,
  Activity,
  Zap,
  Lock,
  X
} from 'lucide-react';

interface ThreatConfig {
  id: string;
  name: string;
  api_key_masked: string;
  is_enabled: boolean;
  quota_per_minute: number;
  timeout_ms: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNCONFIGURED' | 'ERROR';
  last_check_at?: string;
  error_message?: string;
}

export default function ThreatIntelView() {
  const [configs, setConfigs] = useState<ThreatConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configure modal
  const [selectedCfg, setSelectedCfg] = useState<ThreatConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [quota, setQuota] = useState(4);
  const [timeout, setTimeoutVal] = useState(5000);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/threat-intel');
      const data = await res.json();
      if (res.ok && data.success) {
        setConfigs(data.data.providers || []);
      } else {
        setError(data.error || 'Failed to fetch threat intelligence providers.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const openConfigModal = (cfg: ThreatConfig) => {
    setSelectedCfg(cfg);
    setApiKeyInput('');
    setIsEnabled(cfg.is_enabled);
    setQuota(cfg.quota_per_minute);
    setTimeoutVal(cfg.timeout_ms);
    setTestResult(null);
    setShowConfigModal(true);
  };

  const handleTestConnection = async () => {
    if (!selectedCfg) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/admin/threat-intel/${selectedCfg.id}/test`, {
        method: 'POST'
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Connection test failed to execute.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCfg) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/threat-intel/${selectedCfg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput || undefined,
          isEnabled,
          quotaPerMinute: Number(quota),
          timeoutMs: Number(timeout)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowConfigModal(false);
        fetchConfigs();
      } else {
        alert(data.error || 'Failed to update configuration.');
      }
    } catch {
      alert('Network failure.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'Never tested';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Threat Intelligence Providers</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Multi-engine reputation feeds and external IOC enrichment endpoints
            </p>
          </div>
          <button onClick={fetchConfigs} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Refresh Providers</span>
          </button>
        </div>
      </div>

      {/* Providers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {configs.map((cfg) => {
          const isHealthy = cfg.status === 'HEALTHY';
          const isUnconfigured = cfg.status === 'UNCONFIGURED';

          return (
            <div
              key={cfg.id}
              className="glass-panel"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${
                  isHealthy ? 'var(--emerald-success)' : isUnconfigured ? 'var(--text-muted)' : 'var(--amber-warning)'
                }`
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700 }}>{cfg.name}</h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {cfg.id}</span>
                  </div>

                  <span
                    className={`badge ${
                      isHealthy
                        ? 'badge-success'
                        : isUnconfigured
                        ? 'badge-muted'
                        : 'badge-warning'
                    }`}
                  >
                    {cfg.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>API Key Status:</span>
                    <span className="font-mono" style={{ fontWeight: 600 }}>{cfg.api_key_masked}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Integration Enabled:</span>
                    <span style={{ fontWeight: 600, color: cfg.is_enabled ? 'var(--emerald-success)' : 'var(--text-muted)' }}>
                      {cfg.is_enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Query Quota:</span>
                    <span>{cfg.quota_per_minute} lookups / min</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Timeout Threshold:</span>
                    <span>{cfg.timeout_ms} ms</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Health Check:</span>
                    <span>{formatDate(cfg.last_check_at)}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '22px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button
                  onClick={() => openConfigModal(cfg)}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                >
                  Configure & Test Connection
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configure Provider Modal */}
      {showConfigModal && selectedCfg && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={22} style={{ color: 'var(--cyan-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedCfg.name}</h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Provider Settings & Verification</div>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--cyan-primary)' }}
                  />
                  Enable Live Threat Intelligence Provider
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  SET NEW PROVIDER API SECRET (STORED SERVER-SIDE ONLY)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    placeholder="Leave blank to preserve existing stored credential"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="input-control"
                    style={{ paddingLeft: '38px' }}
                  />
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Current Verifier: <span className="font-mono">{selectedCfg.api_key_masked}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    QUOTA (LOOKUPS / MIN)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={quota}
                    onChange={(e) => setQuota(Number(e.target.value))}
                    className="input-control"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    TIMEOUT (MILLISECONDS)
                  </label>
                  <input
                    type="number"
                    min={500}
                    max={30000}
                    value={timeout}
                    onChange={(e) => setTimeoutVal(Number(e.target.value))}
                    className="input-control"
                  />
                </div>
              </div>

              {/* Test Connection Button */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Connection Test</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ping remote API endpoints to verify status</div>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Zap size={14} className={testing ? 'spinner' : ''} />
                  {testing ? 'Testing...' : 'Run Test Ping'}
                </button>
              </div>

              {testResult && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                    color: testResult.success ? 'var(--emerald-success)' : 'var(--rose-danger)'
                  }}
                >
                  <strong>Test Result:</strong> {testResult.message || (testResult.success ? 'Gateway connection healthy' : 'Connection failed')}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowConfigModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <div className="spinner" /> : 'Save Provider Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
