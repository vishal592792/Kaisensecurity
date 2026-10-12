'use client';

import React, { useState } from 'react';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Search,
  Shield,
  Activity,
  CheckCircle2,
  ExternalLink,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  onOpenMobile: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  adminUser?: {
    username: string;
    role: string;
    email: string;
  } | null;
  onLogout: () => void;
  notifications?: any[];
  unreadCount?: number;
  onOpenNotifications: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  overview: { title: 'Overview Dashboard', subtitle: 'Live telemetry, device integrity metrics & threat analytics' },
  keys: { title: 'API-Key Management', subtitle: 'Cryptographic credentials lifecycle, device binding & quotas' },
  users: { title: 'User Management', subtitle: 'Enterprise tenants, authorization status & associated device fleets' },
  devices: { title: 'Registered Devices', subtitle: 'Hardware-verified Android installations & access enforcement' },
  'auth-logs': { title: 'Authentication Logs', subtitle: 'Cryptographic authentication trials, IP tracking & failure audits' },
  integrity: { title: 'Integrity & Security Events', subtitle: 'Anti-tampering detections, Play Integrity verdicts & remediation' },
  scans: { title: 'Scan Reports', subtitle: 'Application assessments, malicious APK findings & vulnerability disclosures' },
  'threat-intel': { title: 'Threat Intelligence', subtitle: 'Multi-engine integration settings, IOC lookups & provider health' },
  policies: { title: 'Security Policies', subtitle: 'Runtime thresholds, version controls & zero-trust integrity rules' },
  notifications: { title: 'Notification Center', subtitle: 'Real-time security alert dispatching, thresholds & email routing' },
  audit: { title: 'Immutable Audit Trail', subtitle: 'Cryptographically ordered administrative action ledger' },
  settings: { title: 'Platform Settings', subtitle: 'Super Administrator profile, Argon2id credentials & active sessions' }
};

export default function Header({
  activeTab,
  onOpenMobile,
  theme,
  setTheme,
  adminUser,
  onLogout,
  notifications = [],
  unreadCount = 0,
  onOpenNotifications
}: HeaderProps) {
  const currentTabInfo = TAB_TITLES[activeTab] || { title: 'Admin Console', subtitle: 'Kaisen SECURE Platform' };
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header
      style={{
        height: '70px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30
      }}
    >
      {/* Left: Mobile trigger & Titles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onOpenMobile}
          style={{
            padding: '8px',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)'
          }}
          className="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {currentTabInfo.title}
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {currentTabInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Controls & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* System Health Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--emerald-success)'
          }}
          className="desktop-only"
        >
          <span className="pulse-dot" />
          <span>HEALTH: OPTIMAL</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => {
            const nextTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(nextTheme);
            document.documentElement.setAttribute('data-theme', nextTheme);
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          title="Notification Center"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.15s ease'
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: 'var(--rose-danger)',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-sidebar)'
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Admin Profile Dropdown */}
        {adminUser && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)'
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--cyan-primary) 0%, var(--blue-primary) 100%)',
                  color: '#050811',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
              >
                {adminUser.username.slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }} className="desktop-only">
                {adminUser.username}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </button>

            {profileDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '220px',
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  zIndex: 60
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{adminUser.username}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {adminUser.email}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                      {adminUser.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    color: 'var(--rose-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginTop: '4px',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
