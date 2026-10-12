'use client';

import React, { useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  HelpCircle,
  Terminal
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (admin: any) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  // Phase 1: 'password', Phase 2: 'mfa'
  const [stage, setStage] = useState<'password' | 'mfa'>('password');
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Stage 2 state
  const [tempMfaToken, setTempMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Stage 1: Authenticate Password
  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication rejected. Verify credentials.');
        setLoading(false);
        return;
      }

      if (data.data?.requiresMfa) {
        setTempMfaToken(data.data.tempMfaToken);
        setStage('mfa');
        setInfoMessage(data.data.message || 'Mandatory MFA: Enter your 6-digit authenticator code or backup recovery code.');
      } else if (data.data?.admin) {
        onLoginSuccess(data.data.admin);
      }
    } catch (err: any) {
      setError('Connection failure: Unable to reach Kaisen authentication gateway.');
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Verify MFA TOTP or Recovery Code
  const handleSubmitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempMfaToken,
          code: mfaCode.trim(),
          isRecoveryCode: useRecoveryCode
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'MFA validation failed. Check code and try again.');
        setLoading(false);
        return;
      }

      if (data.data?.admin) {
        onLoginSuccess(data.data.admin);
      }
    } catch (err: any) {
      setError('MFA gateway communication error.');
    } finally {
      setLoading(false);
    }
  };

  // Helper for fast testing
  const fillCredentials = () => {
    setUsername('superadmin');
    setPassword('KaisenAdmin@2026!');
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '20px',
        position: 'relative'
      }}
    >
      {/* Background Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.08) 0%, rgba(59, 130, 246, 0.03) 50%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px 32px',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(59,130,246,0.3) 100%)',
              border: '1px solid var(--cyan-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-primary)',
              margin: '0 auto 16px',
              boxShadow: '0 0 25px rgba(0,240,255,0.3)'
            }}
          >
            <Shield size={28} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            KAISEN <span style={{ color: 'var(--cyan-primary)' }}>SECURE ADMIN</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Vishal SecureScan • Privileged Administration Portal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              color: 'var(--rose-danger)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '20px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Info Alert */}
        {infoMessage && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              color: 'var(--cyan-primary)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '20px'
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* STAGE 1: Username & Password */}
        {stage === 'password' && (
          <form onSubmit={handleSubmitPassword} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                ADMINISTRATOR USERNAME OR EMAIL
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or email@domain.com"
                  className="input-control"
                  style={{ paddingLeft: '38px' }}
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  PASSWORD (ARGON2ID)
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="input-control"
                  style={{ paddingLeft: '38px', paddingRight: '38px' }}
                />
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '11px',
                    color: 'var(--text-muted)',
                    padding: '2px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '6px', height: '44px' }}
            >
              {loading ? (
                <>
                  <div className="spinner" /> Authenticating...
                </>
              ) : (
                <>
                  Continue to MFA Verification <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STAGE 2: Multi-Factor Authentication */}
        {stage === 'mfa' && (
          <form onSubmit={handleSubmitMfa} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid var(--cyan-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cyan-primary)',
                  margin: '0 auto 10px'
                }}
              >
                <Key size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Two-Factor Challenge</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {useRecoveryCode
                  ? 'Enter an unused 10-character backup recovery code'
                  : 'Enter the 6-digit verification code from your authenticator app'}
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {useRecoveryCode ? 'BACKUP RECOVERY CODE (e.g. XXXXX-XXXXX)' : '6-DIGIT TOTP AUTHENTICATOR CODE'}
              </label>
              <input
                type="text"
                required
                autoFocus
                maxLength={useRecoveryCode ? 16 : 6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder={useRecoveryCode ? 'A1B2C-D3E4F' : '123456'}
                className="input-control font-mono"
                style={{
                  textAlign: 'center',
                  fontSize: useRecoveryCode ? '1.1rem' : '1.5rem',
                  letterSpacing: useRecoveryCode ? '0.1em' : '0.25em',
                  fontWeight: 700
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setMfaCode('');
                  setError(null);
                }}
                style={{ fontSize: '0.75rem', color: 'var(--cyan-primary)', textDecoration: 'underline' }}
              >
                {useRecoveryCode ? 'Use 6-digit Authenticator app code' : 'Lost device? Use Recovery Code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage('password');
                  setPassword('');
                  setError(null);
                }}
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
              >
                Back
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !mfaCode.trim()}
              className="btn btn-primary"
              style={{ width: '100%', height: '44px' }}
            >
              {loading ? (
                <>
                  <div className="spinner" /> Verifying Challenge...
                </>
              ) : (
                <>
                  Confirm & Access Console <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Demo Credentials Drawer */}
        <div
          style={{
            marginTop: '28px',
            padding: '14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} style={{ color: 'var(--cyan-primary)' }} />
              Super Admin Provisioned Credentials
            </span>
            {stage === 'password' && (
              <button
                onClick={fillCredentials}
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--cyan-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline'
                }}
              >
                Auto-fill
              </button>
            )}
          </div>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
            <div>Username: <code className="font-mono" style={{ color: 'var(--text-primary)' }}>superadmin</code></div>
            <div>Password: <code className="font-mono" style={{ color: 'var(--text-primary)' }}>KaisenAdmin@2026!</code></div>
            <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--amber-warning)' }}>
              MFA: Provisioned via CLI. Use authenticator or backup code.
            </div>
          </div>
        </div>

        {/* Portal Footer */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Owner: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Vishal Chaudhary</span> • Zero-Trust Policy Enforced
        </div>
      </div>
    </div>
  );
}
