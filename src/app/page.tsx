'use client';

import React, { useState, useEffect } from 'react';
import Sidebar, { NavTab } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LoginView from '@/components/auth/LoginView';

// Views
import OverviewView from '@/components/views/OverviewView';
import ApiKeysView from '@/components/views/ApiKeysView';
import UsersView from '@/components/views/UsersView';
import DevicesView from '@/components/views/DevicesView';
import AuthLogsView from '@/components/views/AuthLogsView';
import IntegrityEventsView from '@/components/views/IntegrityEventsView';
import ScanReportsView from '@/components/views/ScanReportsView';
import ThreatIntelView from '@/components/views/ThreatIntelView';
import PoliciesView from '@/components/views/PoliciesView';
import NotificationsView from '@/components/views/NotificationsView';
import AuditTrailView from '@/components/views/AuditTrailView';
import SettingsView from '@/components/views/SettingsView';

export default function AdminDashboardPage() {
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [unreadNotifs, setUnreadNotifs] = useState(3);
  const [integrityAlerts, setIntegrityAlerts] = useState(1);

  // Check current session
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/v1/admin/auth/me');
      const data = await res.json();
      if (res.ok && data.success && data.data?.admin) {
        setAdminUser(data.data.admin);
      } else {
        setAdminUser(null);
      }
    } catch {
      setAdminUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/admin/auth/logout', { method: 'POST' });
    } catch {
      // Non-blocking
    }
    setAdminUser(null);
  };

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-muted)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Attesting Zero-Trust Security Gateway...</div>
        </div>
      </div>
    );
  }

  // If unauthenticated, render the 2-Stage Administrator Login
  if (!adminUser) {
    return <LoginView onLoginSuccess={(admin) => setAdminUser(admin)} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileOpen}
        setIsOpenMobile={setIsMobileOpen}
        adminUser={adminUser}
        onLogout={handleLogout}
        unreadNotifsCount={unreadNotifs}
        integrityEventsCount={integrityAlerts}
      />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          marginLeft: '260px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh'
        }}
        className="main-viewport"
      >
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onOpenMobile={() => setIsMobileOpen(true)}
          theme={theme}
          setTheme={setTheme}
          adminUser={adminUser}
          onLogout={handleLogout}
          unreadCount={unreadNotifs}
          onOpenNotifications={() => setActiveTab('notifications')}
        />

        {/* View Body */}
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
          {activeTab === 'overview' && <OverviewView />}
          {activeTab === 'keys' && <ApiKeysView />}
          {activeTab === 'users' && <UsersView />}
          {activeTab === 'devices' && <DevicesView />}
          {activeTab === 'auth-logs' && <AuthLogsView />}
          {activeTab === 'integrity' && <IntegrityEventsView />}
          {activeTab === 'scans' && <ScanReportsView />}
          {activeTab === 'threat-intel' && <ThreatIntelView />}
          {activeTab === 'policies' && <PoliciesView />}
          {activeTab === 'notifications' && <NotificationsView />}
          {activeTab === 'audit' && <AuditTrailView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Platform Footer */}
        <footer
          style={{
            padding: '18px 32px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-secondary)' }}>Kaisen SECURE ADMIN</strong> • Vishal SecureScan Administration Platform
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span>
              Platform Owner: <strong style={{ color: 'var(--text-primary)' }}>Vishal Chaudhary</strong>
            </span>
            <span>•</span>
            <span>
              Contact: <strong style={{ color: 'var(--cyan-primary)' }}>+1 (800) 555-KSEN</strong>
            </span>
            <span>•</span>
            <span style={{ color: 'var(--emerald-success)', fontWeight: 600 }}>Zero-Trust Integrity Verified</span>
          </div>
        </footer>
      </div>

      {/* Responsive CSS helper */}
      <style jsx global>{`
        @media (max-width: 900px) {
          .sidebar-nav {
            transform: translateX(-100%);
          }
          .sidebar-nav.mobile-open {
            transform: translateX(0);
          }
          .main-viewport {
            margin-left: 0 !important;
          }
          .mobile-menu-btn {
            display: inline-flex !important;
          }
          .mobile-close-btn {
            display: inline-flex !important;
          }
          .desktop-only {
            display: none !important;
          }
        }
        @media (min-width: 901px) {
          .mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
