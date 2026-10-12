'use client';

import React from 'react';
import {
  Activity,
  Key,
  Users,
  Smartphone,
  History,
  ShieldAlert,
  FileText,
  Globe,
  Sliders,
  Bell,
  Database,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  X
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'keys'
  | 'users'
  | 'devices'
  | 'auth-logs'
  | 'integrity'
  | 'scans'
  | 'threat-intel'
  | 'policies'
  | 'notifications'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  adminUser?: {
    username: string;
    role: string;
    email: string;
  } | null;
  onLogout: () => void;
  unreadNotifsCount?: number;
  integrityEventsCount?: number;
}

export const NAV_ITEMS = [
  { id: 'overview' as NavTab, label: 'Overview', icon: Activity, badge: null },
  { id: 'keys' as NavTab, label: 'API Keys', icon: Key, badge: null },
  { id: 'users' as NavTab, label: 'Users', icon: Users, badge: null },
  { id: 'devices' as NavTab, label: 'Registered Devices', icon: Smartphone, badge: null },
  { id: 'auth-logs' as NavTab, label: 'Auth Logs', icon: History, badge: null },
  { id: 'integrity' as NavTab, label: 'Integrity Events', icon: ShieldAlert, badge: 'integrity' },
  { id: 'scans' as NavTab, label: 'Scan Reports', icon: FileText, badge: null },
  { id: 'threat-intel' as NavTab, label: 'Threat Intel', icon: Globe, badge: null },
  { id: 'policies' as NavTab, label: 'Security Policies', icon: Sliders, badge: null },
  { id: 'notifications' as NavTab, label: 'Notifications', icon: Bell, badge: 'notifs' },
  { id: 'audit' as NavTab, label: 'Audit Trail', icon: Database, badge: null },
  { id: 'settings' as NavTab, label: 'Settings', icon: Settings, badge: null },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
  adminUser,
  onLogout,
  unreadNotifsCount = 0,
  integrityEventsCount = 0
}: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={() => setIsOpenMobile(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 40,
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      <aside
        style={{
          width: '260px',
          height: '100vh',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpenMobile ? 'translateX(0)' : undefined
        }}
        className={`sidebar-nav ${isOpenMobile ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '20px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(59,130,246,0.3) 100%)',
                border: '1px solid var(--cyan-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cyan-primary)',
                boxShadow: '0 0 15px rgba(0,240,255,0.25)'
              }}
            >
              <Shield size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                KAISEN <span style={{ color: 'var(--cyan-primary)' }}>SECURE</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                VISHAL SECURESCAN
              </div>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setIsOpenMobile(false)}
            className="mobile-close-btn"
            style={{
              padding: '6px',
              color: 'var(--text-muted)',
              display: 'none'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Operational Status Pill */}
        <div style={{ padding: '12px 18px 4px' }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--emerald-success)' }}>
              <span className="pulse-dot" /> SYSTEM ACTIVE
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>v2.4.0</span>
          </div>
        </div>

        {/* Navigation List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            let badgeValue: number | null = null;
            if (item.badge === 'notifs' && unreadNotifsCount > 0) badgeValue = unreadNotifsCount;
            if (item.badge === 'integrity' && integrityEventsCount > 0) badgeValue = integrityEventsCount;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpenMobile(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} style={{ color: isActive ? 'var(--cyan-primary)' : 'var(--text-muted)' }} />
                  <span>{item.label}</span>
                </div>

                {badgeValue ? (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: item.badge === 'integrity' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(0, 240, 255, 0.2)',
                      color: item.badge === 'integrity' ? 'var(--rose-danger)' : 'var(--cyan-primary)',
                      border: `1px solid ${item.badge === 'integrity' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(0, 240, 255, 0.4)'}`
                    }}
                  >
                    {badgeValue}
                  </span>
                ) : isActive ? (
                  <ChevronRight size={14} style={{ color: 'var(--cyan-primary)', opacity: 0.8 }} />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Administrator Profile / Logout Footer */}
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {adminUser && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {adminUser.username}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--purple-accent)', fontWeight: 600 }}>
                  {adminUser.role}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Secure Sign Out"
                style={{
                  padding: '7px',
                  borderRadius: '8px',
                  color: 'var(--rose-danger)',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  backgroundColor: 'rgba(244, 63, 94, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.08)'; }}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

          <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
            Owner: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Vishal Chaudhary</span>
          </div>
        </div>
      </aside>
    </>
  );
}
