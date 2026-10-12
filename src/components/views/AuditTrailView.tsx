'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  User,
  Shield
} from 'lucide-react';

interface AuditEventItem {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  outcome: 'SUCCESS' | 'FAILURE';
  request_id?: string;
  ip_address?: string;
  user_agent?: string;
  details: any;
  created_at: string;
}

export default function AuditTrailView() {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inspector modal
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchAuditEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        search,
        action: actionFilter,
        outcome: outcomeFilter
      });
      const res = await fetch(`/api/v1/admin/audit?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEvents(data.data.events || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch audit log.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [page, actionFilter, outcomeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuditEvents();
  };

  const handleExportCSV = () => {
    if (events.length === 0) return;
    const headers = ['Event ID', 'Timestamp', 'Actor Email', 'Action', 'Target Type', 'Target ID', 'Outcome', 'IP Address'];
    const rows = events.map((e) => [
      e.id,
      e.created_at,
      e.actor_email,
      e.action,
      e.target_type,
      e.target_id,
      e.outcome,
      e.ip_address || 'N/A'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((f) => `"${f}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
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
                placeholder="Search Actor Email, Action, Target ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-control"
                style={{ paddingLeft: '38px', height: '38px', fontSize: '0.82rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="input-control"
              style={{ width: 'auto', height: '38px', padding: '0 12px', fontSize: '0.82rem' }}
            >
              <option value="">All Actions</option>
              <option value="API_KEY_CREATED">API_KEY_CREATED</option>
              <option value="API_KEY_REVOKED">API_KEY_REVOKED</option>
              <option value="API_KEY_SUSPENDED">API_KEY_SUSPENDED</option>
              <option value="API_KEY_REPLACED">API_KEY_REPLACED</option>
              <option value="USER_CREATED">USER_CREATED</option>
              <option value="USER_SUSPENDED">USER_SUSPENDED</option>
              <option value="DEVICE_REVOKED">DEVICE_REVOKED</option>
              <option value="SECURITY_POLICY_UPDATED">SECURITY_POLICY_UPDATED</option>
              <option value="ADMIN_LOGIN_SUCCESS">ADMIN_LOGIN_SUCCESS</option>
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="input-control"
              style={{ width: 'auto', height: '38px', padding: '0 12px', fontSize: '0.82rem' }}
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary btn-sm"
              style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Export filtered records to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
            <button onClick={fetchAuditEvents} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 12px' }}>
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Append-Only Administrative Audit Ledger</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Showing {events.length} of {totalCount} tamper-evident operational ledger records
            </p>
          </div>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
            Immutable Audit Trail
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Verifying and fetching audit events...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Database size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No audit records match query</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIMESTAMP (UTC)</th>
                  <th>ACTION</th>
                  <th>ADMINISTRATOR ACTOR</th>
                  <th>TARGET TYPE & IDENTIFIER</th>
                  <th>OUTCOME</th>
                  <th>IP ADDRESS</th>
                  <th style={{ textAlign: 'right' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatDate(e.created_at)}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--cyan-primary)' }}>
                        {e.action}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{e.actor_email}</span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{e.target_type}</span>
                        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {e.target_id.slice(0, 20)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${e.outcome === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                        {e.outcome === 'SUCCESS' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {e.outcome}
                      </span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ fontSize: '0.78rem' }}>{e.ip_address || '127.0.0.1'}</span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedEvent(e);
                          setShowDetailsModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        title="View Redacted Audit Context"
                      >
                        <Eye size={14} /> Context
                      </button>
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

      {/* Audit Context Modal */}
      {showDetailsModal && selectedEvent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Database size={22} style={{ color: 'var(--purple-accent)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Audit Event Context</h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem' }}>
              <div><strong>Event Ledger ID:</strong> <span className="font-mono">{selectedEvent.id}</span></div>
              <div><strong>Action:</strong> <span style={{ color: 'var(--cyan-primary)', fontWeight: 700 }}>{selectedEvent.action}</span></div>
              <div><strong>Actor:</strong> {selectedEvent.actor_email} ({selectedEvent.actor_id})</div>
              <div><strong>Target:</strong> {selectedEvent.target_type} • ID: <span className="font-mono">{selectedEvent.target_id}</span></div>
              <div><strong>Recorded At:</strong> {formatDate(selectedEvent.created_at)}</div>
              <div><strong>Outcome:</strong> <span className={`badge ${selectedEvent.outcome === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>{selectedEvent.outcome}</span></div>
              <div><strong>Source IP & UA:</strong> {selectedEvent.ip_address || '127.0.0.1'} • {selectedEvent.user_agent || 'Browser'}</div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  REDACTED AUDIT RECORD DETAILS
                </label>
                <pre
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.74rem',
                    color: 'var(--cyan-primary)',
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}
                >
                  {typeof selectedEvent.details === 'object'
                    ? JSON.stringify(selectedEvent.details, null, 2)
                    : selectedEvent.details || 'No extended parameters'}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
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
