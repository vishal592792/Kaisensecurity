'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  Info,
  X,
  FileCode,
  CheckSquare
} from 'lucide-react';

interface IntegrityEventItem {
  id: string;
  timestamp: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  key_id?: string;
  user_id?: string;
  device_id?: string;
  app_version?: string;
  details: any;
  safe_ip?: string;
  resolution_status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  reviewed_by?: string;
  reviewed_at?: string;
}

export default function IntegrityEventsView() {
  const [events, setEvents] = useState<IntegrityEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inspector modal
  const [selectedEvent, setSelectedEvent] = useState<IntegrityEventItem | null>(null);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('INVESTIGATING');
  const [updating, setUpdating] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        severity: severityFilter,
        status: statusFilter
      });
      const res = await fetch(`/api/v1/admin/events?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEvents(data.data.events || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch integrity events.');
      }
    } catch {
      setError('Communication error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, severityFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const handleUpdateEventStatus = async () => {
    if (!selectedEvent) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/admin/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionStatus: updateStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowInspectModal(false);
        setSelectedEvent(null);
        fetchEvents();
      } else {
        alert(data.error || 'Failed to update event.');
      }
    } catch {
      alert('Network failure.');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <input
                type="text"
                placeholder="Search Category, Event ID, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-control"
                style={{ paddingLeft: '38px', height: '38px', fontSize: '0.82rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="input-control"
              style={{ width: 'auto', height: '38px', padding: '0 12px', fontSize: '0.82rem' }}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

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
              <option value="NEW">New</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE_POSITIVE">False Positive</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          <button onClick={fetchEvents} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 12px' }}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Integrity & Anti-Tampering Incidents</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Total {totalCount} hardware verdicts, version deprecations, and tamper signals
            </p>
          </div>
          <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
            Zero-Trust Anomaly Guard
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading security events...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShieldAlert size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No integrity incidents found</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIMESTAMP (UTC)</th>
                  <th>SEVERITY</th>
                  <th>INCIDENT CATEGORY</th>
                  <th>APP VERSION</th>
                  <th>SOURCE IP</th>
                  <th>RESOLUTION STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id}>
                    <td>
                      <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatDate(evt.timestamp)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          evt.severity === 'CRITICAL'
                            ? 'badge-critical'
                            : evt.severity === 'HIGH'
                            ? 'badge-warning'
                            : evt.severity === 'MEDIUM'
                            ? 'badge-cyan'
                            : 'badge-muted'
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt.category}</span>
                        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          ID: {evt.id}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.8rem' }}>v{evt.app_version || '1.0.0'}</span>
                    </td>

                    <td>
                      <span className="font-mono" style={{ fontSize: '0.8rem' }}>{evt.safe_ip || '127.0.0.1'}</span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          evt.resolution_status === 'RESOLVED'
                            ? 'badge-success'
                            : evt.resolution_status === 'INVESTIGATING'
                            ? 'badge-warning'
                            : evt.resolution_status === 'FALSE_POSITIVE'
                            ? 'badge-muted'
                            : 'badge-critical'
                        }`}
                      >
                        {evt.resolution_status}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedEvent(evt);
                          setUpdateStatus(evt.resolution_status);
                          setShowInspectModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        title="Inspect Incident & Update Status"
                      >
                        <Eye size={14} /> Inspect
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

      {/* Inspect Incident Modal */}
      {showInspectModal && selectedEvent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={22} style={{ color: selectedEvent.severity === 'CRITICAL' ? 'var(--rose-danger)' : 'var(--amber-warning)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Inspect Security Incident</h3>
              </div>
              <button onClick={() => setShowInspectModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.82rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><strong>Category:</strong> {selectedEvent.category}</div>
                <div><strong>Severity:</strong> <span className="badge badge-critical">{selectedEvent.severity}</span></div>
                <div><strong>Event ID:</strong> <span className="font-mono">{selectedEvent.id}</span></div>
                <div><strong>Time:</strong> {formatDate(selectedEvent.timestamp)}</div>
                <div><strong>Bound Key:</strong> <span className="font-mono">{selectedEvent.key_id || 'N/A'}</span></div>
                <div><strong>Device Record:</strong> <span className="font-mono">{selectedEvent.device_id || 'N/A'}</span></div>
              </div>

              {/* Technical Details JSON Payload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  TECHNICAL TELEMETRY & VERDICT DETAILS
                </label>
                <pre
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.74rem',
                    color: 'var(--cyan-primary)',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}
                >
                  {typeof selectedEvent.details === 'object'
                    ? JSON.stringify(selectedEvent.details, null, 2)
                    : selectedEvent.details || 'No extended payload'}
                </pre>
              </div>

              {/* Update Status form */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  SET RESOLUTION STATUS
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="input-control"
                >
                  <option value="NEW">NEW</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setShowInspectModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleUpdateEventStatus} disabled={updating} className="btn btn-primary">
                  {updating ? <div className="spinner" /> : 'Update Incident Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
