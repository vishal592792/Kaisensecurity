'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Key,
  Smartphone,
  Shield,
  FileText,
  UserX,
  UserCheck,
  X,
  Mail,
  Info
} from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  label: string;
  email?: string;
  contact_info?: string;
  status: 'active' | 'suspended';
  notes?: string;
  created_at: string;
  key_count: number;
  device_count: number;
  scan_count: number;
}

export default function UsersView() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createLabel, setCreateLabel] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createContact, setCreateContact] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const res = await fetch(`/api/v1/admin/users?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.data.users || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch users.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          label: createLabel,
          email: createEmail || undefined,
          contactInfo: createContact || undefined,
          notes: createNotes || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowCreateModal(false);
        setCreateName('');
        setCreateLabel('');
        setCreateEmail('');
        setCreateContact('');
        setCreateNotes('');
        fetchUsers();
      } else {
        alert(data.error || 'Failed to create user.');
      }
    } catch {
      alert('Network failure.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Suspend / Reactivate User
  const handleToggleSuspendUser = async (u: UserItem) => {
    const isSuspended = u.status === 'suspended';
    const endpoint = isSuspended
      ? `/api/v1/admin/users/${u.id}/reactivate`
      : `/api/v1/admin/users/${u.id}/suspend`;

    if (
      !isSuspended &&
      !confirm(`Are you sure you want to suspend "${u.name}"? This will immediately reject all connected Android devices and API authentication requests.`)
    ) {
      return;
    }

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Action failed.');
      }
    } catch {
      alert('Communication error.');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="Search by User Name, Label, Email..."
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
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={fetchUsers} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 12px' }}>
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ height: '38px' }}>
              <Plus size={16} /> Register New Tenant / User
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Tenant & Client User Directory</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Total {totalCount} registered user entities with real-time access controls
            </p>
          </div>
          <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
            RBAC Governed
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading tenant users...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No users match filter criteria</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>USER / TENANT NAME</th>
                  <th>LABEL / CATEGORY</th>
                  <th>STATUS</th>
                  <th>ASSOCIATED KEYS</th>
                  <th>BOUND DEVICES</th>
                  <th>SUBMITTED SCANS</th>
                  <th>CREATED ON</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {u.id}</span>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-muted" style={{ textTransform: 'none' }}>
                        {u.label}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>
                        {u.status}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Key size={14} style={{ color: 'var(--cyan-primary)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{u.key_count}</span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Smartphone size={14} style={{ color: 'var(--blue-primary)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{u.device_count}</span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} style={{ color: 'var(--purple-accent)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{u.scan_count}</span>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatDate(u.created_at)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setShowDetailsModal(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          title="View Tenant Details"
                        >
                          <Info size={14} />
                        </button>

                        <button
                          onClick={() => handleToggleSuspendUser(u)}
                          className={u.status === 'active' ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm'}
                          style={{
                            color: u.status === 'active' ? undefined : 'var(--emerald-success)'
                          }}
                          title={u.status === 'active' ? 'Suspend Tenant Access' : 'Reactivate Tenant Access'}
                        >
                          {u.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={20} style={{ color: 'var(--cyan-primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Register Client / Tenant</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  TENANT / ORGANIZATION NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Financial Systems"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="input-control"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  LABEL OR ENVIRONMENT IDENTIFIER *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FinTech Production / Mobile Fleet"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  className="input-control"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  OFFICIAL CONTACT EMAIL (OPTIONAL)
                </label>
                <input
                  type="email"
                  placeholder="security@partner.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="input-control"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  CONTACT PHONE OR DESK (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="+1 (800) 555-0199"
                  value={createContact}
                  onChange={(e) => setCreateContact(e.target.value)}
                  className="input-control"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  INTERNAL COMPLIANCE NOTES
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes on tenant security posture or SLAs..."
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="input-control"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={createLoading} className="btn btn-primary">
                  {createLoading ? <div className="spinner" /> : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Tenant Profile: {selectedUser.name}</h3>
              <button onClick={() => setShowDetailsModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
              <div><strong>Tenant ID:</strong> <span className="font-mono">{selectedUser.id}</span></div>
              <div><strong>Name:</strong> {selectedUser.name}</div>
              <div><strong>Label:</strong> {selectedUser.label}</div>
              <div><strong>Email:</strong> {selectedUser.email || 'None provided'}</div>
              <div><strong>Contact:</strong> {selectedUser.contact_info || 'None provided'}</div>
              <div><strong>Account Status:</strong> <span className={`badge ${selectedUser.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>{selectedUser.status}</span></div>
              <div><strong>Bound API Keys:</strong> {selectedUser.key_count} keys</div>
              <div><strong>Registered Devices:</strong> {selectedUser.device_count} devices</div>
              <div><strong>Completed Scans:</strong> {selectedUser.scan_count} reports</div>
              <div><strong>Created:</strong> {formatDate(selectedUser.created_at)}</div>
              <div><strong>Internal Notes:</strong> {selectedUser.notes || 'No notes'}</div>

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
