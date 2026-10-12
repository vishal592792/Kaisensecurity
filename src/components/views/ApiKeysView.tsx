'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Shield,
  Smartphone,
  History,
  MoreVertical,
  Trash2,
  PauseCircle,
  PlayCircle,
  RotateCw,
  X,
  ExternalLink,
  Info
} from 'lucide-react';

interface ApiKeyItem {
  id: string;
  user_id: string;
  user_name: string;
  user_label: string;
  masked_key: string;
  status: string;
  device_limit: number;
  device_binding_enabled: boolean;
  scan_quota_daily: number;
  rate_limit_per_minute: number;
  expires_at: string;
  created_at: string;
  last_authenticated_at?: string;
  failed_auth_count: number;
  internal_note?: string;
  registered_device_count: number;
  revoked_at?: string;
  revoked_reason?: string;
}

interface UserOption {
  id: string;
  name: string;
  label: string;
}

export default function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Users list for creation dropdown
  const [users, setUsers] = useState<UserOption[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatedSecretModal, setShowCreatedSecretModal] = useState(false);
  const [createdSecretData, setCreatedSecretData] = useState<{
    keyId: string;
    rawKey: string;
    maskedKey: string;
    expiresAt: string;
    deviceLimit: number;
  } | null>(null);
  const [revealedSecret, setRevealedSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Action modals
  const [actionKey, setActionKey] = useState<ApiKeyItem | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokeReason, setRevokeReason] = useState('Administrative zero-trust key rotation');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Create Form state
  const [createUserId, setCreateUserId] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [createExpiryDays, setCreateExpiryDays] = useState(90);
  const [createDeviceLimit, setCreateDeviceLimit] = useState(3);
  const [createDeviceBinding, setCreateDeviceBinding] = useState(true);
  const [createScanQuota, setCreateScanQuota] = useState(100);
  const [createRateLimit, setCreateRateLimit] = useState(60);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const res = await fetch(`/api/v1/admin/keys?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setKeys(data.data.keys || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch API keys.');
      }
    } catch {
      setError('Communication error with Kaisen API service.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users?limit=50');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.data.users || []);
        if (data.data.users?.length > 0 && !createUserId) {
          setCreateUserId(data.data.users[0].id);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [page, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchKeys();
  };

  // Create API Key Handler
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserId) return;
    setCreateLoading(true);

    try {
      const res = await fetch('/api/v1/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: createUserId,
          internalNote: createNote,
          expiryDays: Number(createExpiryDays),
          deviceLimit: Number(createDeviceLimit),
          deviceBindingEnabled: createDeviceBinding,
          scanQuotaDaily: Number(createScanQuota),
          rateLimitPerMinute: Number(createRateLimit)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCreateModal(false);
        setCreatedSecretData(data.data);
        setShowCreatedSecretModal(true);
        setRevealedSecret(false);
        setCopiedSecret(false);
        fetchKeys();
      } else {
        alert(data.error || 'Failed to create key.');
      }
    } catch {
      alert('Internal network error.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Revoke Key Handler
  const handleRevokeKey = async () => {
    if (!actionKey) return;
    try {
      const res = await fetch(`/api/v1/admin/keys/${actionKey.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowRevokeConfirm(false);
        setActionKey(null);
        fetchKeys();
      } else {
        alert(data.error || 'Failed to revoke key.');
      }
    } catch {
      alert('Network failure.');
    }
  };

  // Suspend / Resume Handler
  const handleToggleSuspend = async (key: ApiKeyItem) => {
    const isSuspended = key.status === 'suspended';
    const endpoint = isSuspended
      ? `/api/v1/admin/keys/${key.id}/resume`
      : `/api/v1/admin/keys/${key.id}/suspend`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchKeys();
      } else {
        alert(data.error || 'Action failed.');
      }
    } catch {
      alert('Network error.');
    }
  };

  // Replace Key Handler
  const handleReplaceKey = async () => {
    if (!actionKey) return;
    try {
      const res = await fetch(`/api/v1/admin/keys/${actionKey.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Administrator initiated immediate credential rotation' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowReplaceConfirm(false);
        setActionKey(null);
        setCreatedSecretData({
          keyId: data.data.newKeyId,
          rawKey: data.data.rawKey,
          maskedKey: data.data.maskedKey,
          expiresAt: data.data.expiresAt,
          deviceLimit: actionKey.device_limit
        });
        setShowCreatedSecretModal(true);
        setRevealedSecret(false);
        setCopiedSecret(false);
        fetchKeys();
      } else {
        alert(data.error || 'Failed to replace key.');
      }
    } catch {
      alert('Network error.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 3000);
  };

  const formatDate = (dStr: string) => {
    try {
      return new Date(dStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Action Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="Search by Key ID, User, or Masked Key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-control"
                style={{ paddingLeft: '38px', height: '38px', fontSize: '0.82rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-control"
              style={{ width: 'auto', height: '38px', padding: '0 12px', fontSize: '0.82rem' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          {/* Right Action: Create Key */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchKeys}
              className="btn btn-secondary btn-sm"
              style={{ height: '38px', padding: '0 12px' }}
              title="Refresh list"
            >
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{ height: '38px' }}
            >
              <Plus size={16} /> Issue New API Key
            </button>
          </div>
        </div>
      </div>

      {/* Keys Table Container */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Issued API Key Inventory</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Showing {keys.length} of {totalCount} cryptographically verifier-backed credentials
            </p>
          </div>
          <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
            HMAC-SHA256 Protected
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading cryptographic key records...
          </div>
        ) : keys.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Key size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No API keys matching query</div>
            <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Try adjusting filters or create a new key.</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>MASKED KEY / IDENTIFIER</th>
                  <th>TENANT / USER</th>
                  <th>STATUS</th>
                  <th>DEVICE USAGE</th>
                  <th>EXPIRY DATE</th>
                  <th>SCAN QUOTA</th>
                  <th>LAST AUTH</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          {k.masked_key}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          ID: {k.id}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{k.user_name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{k.user_label}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          k.status === 'active'
                            ? 'badge-active'
                            : k.status === 'suspended'
                            ? 'badge-suspended'
                            : k.status === 'revoked'
                            ? 'badge-revoked'
                            : 'badge-expired'
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Smartphone size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                          {k.registered_device_count} / {k.device_limit}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8rem' }}>{formatDate(k.expires_at)}</div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {k.scan_quota_daily}/day ({k.rate_limit_per_minute}/min)
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.75rem', color: k.last_authenticated_at ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {k.last_authenticated_at ? formatDate(k.last_authenticated_at) : 'Never'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* View metadata */}
                        <button
                          onClick={() => {
                            setActionKey(k);
                            setShowDetailsModal(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          title="View Metadata"
                        >
                          <Info size={14} />
                        </button>

                        {/* Suspend / Resume */}
                        {k.status !== 'revoked' && (
                          <button
                            onClick={() => handleToggleSuspend(k)}
                            className="btn btn-secondary btn-sm"
                            title={k.status === 'suspended' ? 'Resume Key' : 'Suspend Key'}
                            style={{ color: k.status === 'suspended' ? 'var(--emerald-success)' : 'var(--amber-warning)' }}
                          >
                            {k.status === 'suspended' ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                          </button>
                        )}

                        {/* Replace Key */}
                        {k.status !== 'revoked' && (
                          <button
                            onClick={() => {
                              setActionKey(k);
                              setShowReplaceConfirm(true);
                            }}
                            className="btn btn-secondary btn-sm"
                            title="Issue Replacement Key"
                          >
                            <RotateCw size={14} />
                          </button>
                        )}

                        {/* Revoke Key */}
                        {k.status !== 'revoked' ? (
                          <button
                            onClick={() => {
                              setActionKey(k);
                              setShowRevokeConfirm(true);
                            }}
                            className="btn btn-danger btn-sm"
                            title="Permanently Revoke Key"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--rose-danger)', fontWeight: 600, paddingRight: '6px' }}>
                            Revoked
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: Create API Key Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={20} style={{ color: 'var(--cyan-primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Issue Client API Key</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateKey} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  TARGET ENTERPRISE TENANT / USER *
                </label>
                <select
                  required
                  value={createUserId}
                  onChange={(e) => setCreateUserId(e.target.value)}
                  className="input-control"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.label})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    KEY EXPIRATION (DAYS)
                  </label>
                  <select
                    value={createExpiryDays}
                    onChange={(e) => setCreateExpiryDays(Number(e.target.value))}
                    className="input-control"
                  >
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days (Standard)</option>
                    <option value={180}>180 Days (Half-Year)</option>
                    <option value={365}>365 Days (1 Year)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    MAX REGISTERED DEVICES
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={createDeviceLimit}
                    onChange={(e) => setCreateDeviceLimit(Number(e.target.value))}
                    className="input-control"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    DAILY SCAN QUOTA
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={createScanQuota}
                    onChange={(e) => setCreateScanQuota(Number(e.target.value))}
                    className="input-control"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    RATE LIMIT (REQ / MIN)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={createRateLimit}
                    onChange={(e) => setCreateRateLimit(Number(e.target.value))}
                    className="input-control"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  INTERNAL AUDIT NOTE (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dedicated key for production Android fleet"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  className="input-control"
                />
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(0, 240, 255, 0.06)', border: '1px solid rgba(0, 240, 255, 0.2)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <strong>Cryptographic Notice:</strong> The raw API key will be displayed exactly once upon issuance. Only a salted HMAC verifier will be persisted on the server.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={createLoading} className="btn btn-primary">
                  {createLoading ? <div className="spinner" /> : 'Generate & Issue Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CRITICAL - Secret Key Display Once Flow */}
      {showCreatedSecretModal && createdSecretData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', border: '1px solid var(--cyan-primary)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={22} style={{ color: 'var(--cyan-primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--cyan-primary)' }}>
                  API Key Created Successfully
                </h3>
              </div>
              <button onClick={() => setShowCreatedSecretModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* High visibility alert */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: 'var(--amber-warning)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  gap: '10px'
                }}
              >
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>CRITICAL SECURITY DIRECTIVE:</strong> Store this raw API key immediately. In compliance with Zero-Trust architecture, the raw key is NEVER stored in plaintext in the database or server logs and CANNOT be retrieved again!
                </div>
              </div>

              {/* Raw Key Box */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  RAW API KEY SECRET
                </label>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-active)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--cyan-primary)',
                      wordBreak: 'break-all'
                    }}
                  >
                    {revealedSecret ? createdSecretData.rawKey : '•'.repeat(48)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => setRevealedSecret(!revealedSecret)}
                      className="btn btn-secondary btn-sm"
                      title={revealedSecret ? 'Hide Key' : 'Reveal Key'}
                    >
                      {revealedSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(createdSecretData.rawKey)}
                      className="btn btn-primary btn-sm"
                    >
                      {copiedSecret ? (
                        <>
                          <Check size={16} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} /> Copy Secret
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Key Metadata Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.78rem' }}>
                <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Key ID:</span>
                  <div className="font-mono" style={{ fontWeight: 600, marginTop: '2px' }}>{createdSecretData.keyId}</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expires At:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{formatDate(createdSecretData.expiresAt)}</div>
                </div>
              </div>

              <button
                onClick={() => setShowCreatedSecretModal(false)}
                className="btn btn-primary"
                style={{ width: '100%', height: '42px', marginTop: '10px' }}
              >
                I Have Safely Recorded This Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Revoke Confirmation Modal */}
      {showRevokeConfirm && actionKey && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={22} style={{ color: 'var(--rose-danger)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--rose-danger)' }}>
                Confirm Permanent Key Revocation
              </h3>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                Are you sure you want to permanently revoke key{' '}
                <strong className="font-mono">{actionKey.masked_key}</strong>?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--rose-danger)' }}>
                <strong>WARNING:</strong> This action is irrevocable. All connected client Android scanners using this key will immediately fail authentication on subsequent API requests.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
                  REVOCATION REASON (RECORDED IN AUDIT TRAIL)
                </label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="input-control"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button onClick={() => setShowRevokeConfirm(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleRevokeKey} className="btn btn-danger">
                  Revoke Key Immediately
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Replace Key Confirmation */}
      {showReplaceConfirm && actionKey && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RotateCw size={22} style={{ color: 'var(--cyan-primary)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Rotate & Issue Replacement Key</h3>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                Rotating key <strong className="font-mono">{actionKey.masked_key}</strong> will permanently revoke this key and immediately generate a fresh high-entropy key with identical device binding configurations.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowReplaceConfirm(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleReplaceKey} className="btn btn-primary">
                  Generate Replacement Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Key Metadata Details */}
      {showDetailsModal && actionKey && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Key Metadata & Telemetry</h3>
              <button onClick={() => setShowDetailsModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
              <div><strong>Key ID:</strong> <span className="font-mono">{actionKey.id}</span></div>
              <div><strong>Masked Representation:</strong> <span className="font-mono">{actionKey.masked_key}</span></div>
              <div><strong>Associated Tenant:</strong> {actionKey.user_name} ({actionKey.user_label})</div>
              <div><strong>Status:</strong> <span className="badge badge-active">{actionKey.status}</span></div>
              <div><strong>Device Limit:</strong> {actionKey.device_limit} (Active bound: {actionKey.registered_device_count})</div>
              <div><strong>Device Binding Enabled:</strong> {actionKey.device_binding_enabled ? 'Yes' : 'No'}</div>
              <div><strong>Created:</strong> {formatDate(actionKey.created_at)}</div>
              <div><strong>Expires:</strong> {formatDate(actionKey.expires_at)}</div>
              <div><strong>Daily Quota:</strong> {actionKey.scan_quota_daily} scans</div>
              <div><strong>Rate Limit:</strong> {actionKey.rate_limit_per_minute} req/min</div>
              <div><strong>Last Successful Auth:</strong> {actionKey.last_authenticated_at ? formatDate(actionKey.last_authenticated_at) : 'Never'}</div>
              <div><strong>Internal Note:</strong> {actionKey.internal_note || 'None'}</div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
