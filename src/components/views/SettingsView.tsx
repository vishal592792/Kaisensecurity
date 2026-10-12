'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Key,
  Lock,
  Smartphone,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Server,
  Layers
} from 'lucide-react';

interface SettingsData {
  profile: {
    id: string;
    username: string;
    email: string;
    role: string;
    mfaEnabled: boolean;
  };
  system: {
    ownerName: string;
    ownerContact: string;
    productName: string;
    platformName: string;
    version: string;
    databaseType: string;
  };
  sessions: Array<{
    id: string;
    ip_address: string;
    user_agent: string;
    expires_at: string;
    created_at: string;
    isCurrent: boolean;
  }>;
}

export default function SettingsView() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/settings');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to fetch settings.');
      }
    } catch {
      setError('Communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters long.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('/api/v1/admin/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPwSuccess('Password updated and re-hashed with Argon2id successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwError(json.error || 'Password update failed.');
      }
    } catch {
      setPwError('Network error during password update.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this active administrator session?')) return;
    try {
      const res = await fetch(`/api/v1/admin/settings/sessions/${sessionId}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchSettings();
      } else {
        alert(json.error || 'Failed to revoke session.');
      }
    } catch {
      alert('Communication error.');
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

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        Loading system configuration...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Administrator Profile & Platform Settings</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Identity attestation, cryptographic credentials, MFA enforcement & active sessions
            </p>
          </div>
          <button onClick={fetchSettings} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} />
            <span>Reload Configuration</span>
          </button>
        </div>
      </div>

      {/* Grid: Identity & Ownership on Left, Security Form on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Card 1: Platform & Owner Identity */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
              Platform Identity & Ownership
            </h4>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Core system provenance and administrator identity
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PLATFORM OWNER</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                {data.system.ownerName}
              </div>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OWNER CONTACT NUMBER (CONFIGURABLE)</span>
              <div className="font-mono" style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--cyan-primary)', marginTop: '2px' }}>
                {data.system.ownerContact}
              </div>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MANAGED SECURITY PRODUCT</span>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {data.system.productName} ({data.system.platformName})
              </div>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DATABASE PERSISTENCE ARCHITECTURE</span>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                {data.system.databaseType}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Administrator Profile & MFA Attestation */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--purple-accent)' }}>
              Administrator Authentication Profile
            </h4>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Argon2id password & RFC 6238 TOTP Multi-Factor Authentication
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Administrator ID:</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>{data.profile.id}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Username:</span>
              <span style={{ fontWeight: 700 }}>{data.profile.username}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Email:</span>
              <span style={{ fontWeight: 600 }}>{data.profile.email}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Role:</span>
              <span className="badge badge-purple">{data.profile.role}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>MFA Hardware Policy:</span>
              <span className="badge badge-success">MANDATORY (ENFORCED)</span>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(0, 240, 255, 0.06)', border: '1px solid rgba(0, 240, 255, 0.2)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <strong>Zero-Trust Notice:</strong> Public administrator self-registration is permanently disabled. Super Administrator accounts are provisioned via secure server CLI tools (<code>npm run admin:provision</code>) with Argon2id parameters (m=19MiB, t=2, p=1).
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '0.96rem', fontWeight: 700, marginBottom: '6px' }}>
          Change Administrator Password
        </h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Re-keys your administrator login credentials using Argon2id with memory-hard work factors
        </p>

        {pwError && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--rose-danger)', fontSize: '0.8rem', marginBottom: '16px' }}>
            {pwError}
          </div>
        )}

        {pwSuccess && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--emerald-success)', fontSize: '0.8rem', marginBottom: '16px' }}>
            {pwSuccess}
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CURRENT PASSWORD
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-control"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              NEW ARGON2ID PASSWORD
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-control"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CONFIRM NEW PASSWORD
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-control"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={pwLoading}
              className="btn btn-primary"
              style={{ width: '100%', height: '42px' }}
            >
              {pwLoading ? <div className="spinner" /> : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Active Administrator Sessions */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Active Administrator Sessions</h4>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Server-controlled HttpOnly session tokens with instant revocation
            </p>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
            HttpOnly & Secure
          </span>
        </div>

        <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>SESSION ID</th>
                <th>CLIENT IP ADDRESS</th>
                <th>USER AGENT</th>
                <th>ISSUED AT</th>
                <th>EXPIRES AT</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--cyan-primary)' }}>
                      {s.id.slice(0, 16)}...
                    </span>
                  </td>
                  <td>
                    <span className="font-mono" style={{ fontSize: '0.8rem' }}>{s.ip_address || '127.0.0.1'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: '240px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.user_agent || 'Browser'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem' }}>{formatDate(s.created_at)}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDate(s.expires_at)}</span>
                  </td>
                  <td>
                    {s.isCurrent ? (
                      <span className="badge badge-success">Current Session</span>
                    ) : (
                      <span className="badge badge-muted">Active Remote</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {!s.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(s.id)}
                        className="btn btn-danger btn-sm"
                        title="Revoke session"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
