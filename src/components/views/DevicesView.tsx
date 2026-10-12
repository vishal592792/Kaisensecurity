'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  AlertTriangle,
  Info,
  X,
  Clock,
  Activity
} from 'lucide-react';

interface DeviceItem {
  id: string;
  user_id: string;
  user_name: string;
  user_label: string;
  key_id: string;
  masked_key: string;
  app_installation_id: string;
  app_version: string;
  android_version?: string;
  status: 'registered' | 'revoked' | 'pending';
  integrity_status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
  first_seen_at: string;
  last_seen_at: string;
  last_ip?: string;
  revoked_at?: string;
}

export default function DevicesView() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [integrityFilter, setIntegrityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Revoke device modal
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter,
        integrity: integrityFilter
      });
      const res = await fetch(`/api/v1/admin/devices?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDevices(data.data.devices || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch devices.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [page, statusFilter, integrityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDevices();
  };

  const handleRevokeDevice = async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`/api/v1/admin/devices/${selectedDevice.id}/revoke`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowRevokeModal(false);
        setSelectedDevice(null);
        fetchDevices();
      } else {
        alert(data.error || 'Failed to revoke device.');
      }
    } catch {
      alert('Network error.');
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
      {/* Top Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <input
                type="text"
                placeholder="Search Device ID, App Installation ID, User..."
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
              <option value="">All Registration</option>
              <option value="registered">Registered</option>
              <option value="revoked">Revoked</option>
            </select>

            <select
              value={integrityFilter}
              onChange={(e) => {
                setIntegrityFilter(e.target.value);
                setPage(1);
              }}
              className="input-control"
              style={{ width: 'auto', height: '38px', padding: '0 12px', fontSize: '0.82rem' }}
            >
              <option value="">All Integrity</option>
              <option value="VERIFIED">Verified</option>
              <option value="FAILED">Failed</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          <button onClick={fetchDevices} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 12px' }}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Devices Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Bound Device Registry</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Total {totalCount} registered app installations bound to active API credentials
            </p>
          </div>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
            Hardware Scoped
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading bound devices...
          </div>
        ) : devices.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Smartphone size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No devices matching filter</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>DEVICE RECORD ID</th>
                  <th>APP INSTALLATION ID</th>
                  <th>TENANT & BOUND KEY</th>
                  <th>VERSIONS</th>
                  <th>INTEGRITY VERDICT</th>
                  <th>STATUS</th>
                  <th>LAST SEEN</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--cyan-primary)', fontSize: '0.84rem' }}>
                        {d.id}
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {d.app_installation_id}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{d.user_name}</span>
                        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {d.masked_key}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.78rem' }}>
                        <div>App: v{d.app_version}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Android: {d.android_version || 'N/A'}</div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          d.integrity_status === 'VERIFIED'
                            ? 'badge-success'
                            : d.integrity_status === 'FAILED'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {d.integrity_status === 'VERIFIED' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        {d.integrity_status}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${d.status === 'registered' ? 'badge-active' : 'badge-revoked'}`}>
                        {d.status}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.78rem' }}>
                        <div>{formatDate(d.last_seen_at)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>IP: {d.last_ip || '127.0.0.1'}</div>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setSelectedDevice(d);
                            setShowDetailsModal(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          title="Inspect Device Telemetry"
                        >
                          <Info size={14} />
                        </button>

                        {d.status === 'registered' && (
                          <button
                            onClick={() => {
                              setSelectedDevice(d);
                              setShowRevokeModal(true);
                            }}
                            className="btn btn-danger btn-sm"
                            title="Revoke Device Installation"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn btn-secondary btn-sm">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn btn-secondary btn-sm">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && selectedDevice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={22} style={{ color: 'var(--rose-danger)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--rose-danger)' }}>
                Revoke Device Access
              </h3>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                Are you sure you want to revoke device installation{' '}
                <strong className="font-mono">{selectedDevice.app_installation_id}</strong> (ID: {selectedDevice.id})?
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--rose-danger)' }}>
                Subsequent protected requests and refresh token rotations from this device will be immediately rejected on the server.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowRevokeModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleRevokeDevice} className="btn btn-danger">
                  Revoke Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDevice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Device Record Details</h3>
              <button onClick={() => setShowDetailsModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
              <div><strong>Device ID:</strong> <span className="font-mono">{selectedDevice.id}</span></div>
              <div><strong>App Installation ID:</strong> <span className="font-mono">{selectedDevice.app_installation_id}</span></div>
              <div><strong>Bound User:</strong> {selectedDevice.user_name} ({selectedDevice.user_label})</div>
              <div><strong>Bound API Key:</strong> <span className="font-mono">{selectedDevice.masked_key}</span> ({selectedDevice.key_id})</div>
              <div><strong>App Version:</strong> {selectedDevice.app_version}</div>
              <div><strong>Android Version:</strong> {selectedDevice.android_version || 'Unknown'}</div>
              <div><strong>Integrity Verdict:</strong> <span className="badge badge-success">{selectedDevice.integrity_status}</span></div>
              <div><strong>Registration Status:</strong> <span className="badge badge-active">{selectedDevice.status}</span></div>
              <div><strong>First Seen:</strong> {formatDate(selectedDevice.first_seen_at)}</div>
              <div><strong>Last Seen:</strong> {formatDate(selectedDevice.last_seen_at)}</div>
              <div><strong>Last IP Address:</strong> {selectedDevice.last_ip || 'N/A'}</div>

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
