'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Key,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface AuthLogItem {
  id: string;
  timestamp: string;
  event_type: string;
  key_id?: string;
  user_id?: string;
  user_name?: string;
  masked_key?: string;
  device_id?: string;
  ip_address?: string;
  user_agent?: string;
  failure_reason?: string;
}

export default function AuthLogsView() {
  const [logs, setLogs] = useState<AuthLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        search,
        type: typeFilter
      });
      const res = await fetch(`/api/v1/admin/auth-logs?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.data.logs || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch logs.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
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
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <input
                type="text"
                placeholder="Search by Key ID, IP, or User..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-control"
                style={{ paddingLeft: '38px', height: '38px', fontSize: '0.82rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input-control"
              style={{ width: 'auto', height: '38px', padding: '0 12px', fontSize: '0.82rem' }}
            >
              <option value="">All Event Types</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="KEY_INVALID">KEY_INVALID</option>
              <option value="KEY_REVOKED">KEY_REVOKED</option>
              <option value="KEY_EXPIRED">KEY_EXPIRED</option>
              <option value="KEY_SUSPENDED">KEY_SUSPENDED</option>
              <option value="USER_SUSPENDED">USER_SUSPENDED</option>
              <option value="DEVICE_REVOKED">DEVICE_REVOKED</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          <button onClick={fetchLogs} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 12px' }}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Auth Logs Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Client Authentication Trials Log</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Showing {logs.length} of {totalCount} chronological authentication records
            </p>
          </div>
          <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
            Zero-Trust Monitored
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading authentication events...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <History size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No authentication trials found</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIMESTAMP (UTC)</th>
                  <th>VERDICT / OUTCOME</th>
                  <th>ASSOCIATED KEY</th>
                  <th>USER / TENANT</th>
                  <th>SOURCE IP</th>
                  <th>CLIENT USER AGENT</th>
                  <th>SECURITY DETAIL / FAILURE REASON</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const isSuccess = l.event_type.includes('SUCCESS');
                  return (
                    <tr key={l.id}>
                      <td>
                        <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {formatDate(l.timestamp)}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${isSuccess ? 'badge-success' : 'badge-danger'}`}>
                          {isSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {l.event_type}
                        </span>
                      </td>

                      <td>
                        <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--cyan-primary)' }}>
                          {l.masked_key || l.key_id || 'N/A'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                          {l.user_name || 'Unbound / Unknown'}
                        </span>
                      </td>

                      <td>
                        <span className="font-mono" style={{ fontSize: '0.8rem' }}>
                          {l.ip_address || '127.0.0.1'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: '180px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.user_agent || 'Android Client'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.75rem', color: isSuccess ? 'var(--emerald-success)' : 'var(--rose-danger)' }}>
                          {l.failure_reason || (isSuccess ? 'Cryptographic HMAC verified & Session issued' : 'Rejected')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
