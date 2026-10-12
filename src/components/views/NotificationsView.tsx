'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Settings,
  Sliders,
  Check,
  X
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsView() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'settings'>('alerts');
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [notifyFailedLogins, setNotifyFailedLogins] = useState(true);
  const [failedLoginThreshold, setFailedLoginThreshold] = useState(5);
  const [notifyHighRiskIntegrity, setNotifyHighRiskIntegrity] = useState(true);
  const [notifyNewDevice, setNotifyNewDevice] = useState(true);
  const [notifyKeyExpiry, setNotifyKeyExpiry] = useState(true);
  const [keyExpiryWarningDays, setKeyExpiryWarningDays] = useState(7);
  const [notifyKeyRevocation, setNotifyKeyRevocation] = useState(true);
  const [notifyScanAnomalies, setNotifyScanAnomalies] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/notifications');
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifs(data.data.notifications || []);
      } else {
        setError(data.error || 'Failed to fetch notifications.');
      }
    } catch {
      setError('Communication error.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/v1/admin/notifications/settings');
      const data = await res.json();
      if (res.ok && data.success) {
        const s = data.data.settings;
        setNotifyFailedLogins(s.notify_failed_logins);
        setFailedLoginThreshold(s.failed_login_threshold);
        setNotifyHighRiskIntegrity(s.notify_high_risk_integrity);
        setNotifyNewDevice(s.notify_new_device);
        setNotifyKeyExpiry(s.notify_key_expiry);
        setKeyExpiryWarningDays(s.key_expiry_warning_days);
        setNotifyKeyRevocation(s.notify_key_revocation);
        setNotifyScanAnomalies(s.notify_scan_anomalies);
        setEmailAlertsEnabled(s.email_alerts_enabled);
        setAlertEmail(s.alert_email || '');
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchNotifs();
    fetchSettings();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/v1/admin/notifications/${id}/read`, { method: 'POST' });
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // Non-blocking
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/v1/admin/notifications/mark-all-read', { method: 'POST' });
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Non-blocking
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/v1/admin/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyFailedLogins,
          failedLoginThreshold: Number(failedLoginThreshold),
          notifyHighRiskIntegrity,
          notifyNewDevice,
          notifyKeyExpiry,
          keyExpiryWarningDays: Number(keyExpiryWarningDays),
          notifyKeyRevocation,
          notifyScanAnomalies,
          emailAlertsEnabled,
          alertEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Notification settings updated successfully.');
      } else {
        alert(data.error || 'Failed to update settings.');
      }
    } catch {
      alert('Network failure.');
    } finally {
      setSettingsSaving(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab Switcher & Top Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('alerts')}
              className={activeTab === 'alerts' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              <Bell size={14} /> Security Alerts Feed
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={activeTab === 'settings' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              <Sliders size={14} /> Alert Thresholds & Routing
            </button>
          </div>

          {activeTab === 'alerts' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleMarkAllRead} className="btn btn-secondary btn-sm">
                Mark All as Read
              </button>
              <button onClick={fetchNotifs} className="btn btn-secondary btn-sm">
                <RefreshCw size={14} className={loading ? 'spinner' : ''} />
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'alerts' ? (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Security Notifications</h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {notifs.filter((n) => !n.is_read).length} Unread Alerts
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              Loading notifications...
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
              <div>No notifications at this time.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifs.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: n.is_read ? 'var(--bg-surface)' : 'rgba(0, 240, 255, 0.05)',
                    border: `1px solid ${n.is_read ? 'var(--border-subtle)' : 'rgba(0, 240, 255, 0.3)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor:
                          n.severity === 'CRITICAL'
                            ? 'rgba(244, 63, 94, 0.15)'
                            : n.severity === 'WARNING'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(0, 240, 255, 0.15)',
                        color:
                          n.severity === 'CRITICAL'
                            ? 'var(--rose-danger)'
                            : n.severity === 'WARNING'
                            ? 'var(--amber-warning)'
                            : 'var(--cyan-primary)',
                        flexShrink: 0
                      }}
                    >
                      {n.severity === 'CRITICAL' ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{n.title}</span>
                        <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>
                          {n.category}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                        {n.message}
                      </p>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        {formatDate(n.created_at)}
                      </div>
                    </div>
                  </div>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="btn btn-secondary btn-sm"
                      title="Mark as read"
                    >
                      <Check size={14} /> Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Alert Settings Tab */
        <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Alert Thresholds & Routing</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Configure deduplication limits and dispatching rules to prevent alert fatigue
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyFailedLogins}
                  onChange={(e) => setNotifyFailedLogins(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
                />
                Trigger alert upon repeated failed authentication attempts
              </label>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Threshold count:</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={failedLoginThreshold}
                  onChange={(e) => setFailedLoginThreshold(Number(e.target.value))}
                  className="input-control"
                  style={{ width: '80px', padding: '4px 8px' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>failures within 15 minutes</span>
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyHighRiskIntegrity}
                  onChange={(e) => setNotifyHighRiskIntegrity(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
                />
                Immediate alert on High/Critical Play Integrity and tampering violations
              </label>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyNewDevice}
                  onChange={(e) => setNotifyNewDevice(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
                />
                Notify on new Android client device registration
              </label>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyKeyExpiry}
                  onChange={(e) => setNotifyKeyExpiry(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
                />
                Notify when API key is approaching expiration
              </label>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Warning window:</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={keyExpiryWarningDays}
                  onChange={(e) => setKeyExpiryWarningDays(Number(e.target.value))}
                  className="input-control"
                  style={{ width: '80px', padding: '4px 8px' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>days prior to expiry</span>
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emailAlertsEnabled}
                  onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
                />
                Dispatch email notifications for critical incidents
              </label>
              {emailAlertsEnabled && (
                <div style={{ marginTop: '10px' }}>
                  <input
                    type="email"
                    placeholder="security@kaisensecurity.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    className="input-control"
                    style={{ maxWidth: '360px' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" disabled={settingsSaving} className="btn btn-primary">
                {settingsSaving ? <div className="spinner" /> : 'Save Notification Preferences'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
