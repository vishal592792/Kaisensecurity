'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  AlertTriangle,
  Download,
  Eye,
  CheckCircle,
  X,
  Shield,
  Layers,
  Smartphone,
  ExternalLink
} from 'lucide-react';

interface ScanReportItem {
  id: string;
  user_id: string;
  user_name: string;
  device_id: string;
  key_id: string;
  scan_type: string;
  apps_assessed_count: number;
  inaccessible_apps_count: number;
  critical_findings_count: number;
  high_findings_count: number;
  medium_findings_count: number;
  low_findings_count: number;
  info_findings_count: number;
  coverage_percent: number;
  status: string;
  started_at: string;
  finished_at: string;
}

interface FindingItem {
  id: string;
  package_name: string;
  app_name: string;
  finding_type: string;
  severity: string;
  detection_engine: string;
  confidence: number;
  description: string;
  remediation?: string;
}

export default function ScanReportsView() {
  const [scans, setScans] = useState<ScanReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inspector state
  const [selectedScan, setSelectedScan] = useState<ScanReportItem | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);

  const fetchScans = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        type: typeFilter
      });
      const res = await fetch(`/api/v1/admin/scans?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setScans(data.data.scans || []);
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotalCount(data.data.pagination.total || 0);
      } else {
        setError(data.error || 'Failed to fetch scan reports.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [page, typeFilter]);

  const handleInspect = async (scan: ScanReportItem) => {
    setSelectedScan(scan);
    setShowInspectModal(true);
    setFindingsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/scans/${scan.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setFindings(data.data.findings || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setFindingsLoading(false);
    }
  };

  const handleExportRedacted = (scan: ScanReportItem, findingsList: FindingItem[]) => {
    const redactedData = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      reportId: scan.id,
      tenantId: scan.user_id,
      deviceRecordId: scan.device_id,
      scanType: scan.scan_type,
      coveragePercent: scan.coverage_percent,
      summary: {
        assessedApps: scan.apps_assessed_count,
        inaccessibleApps: scan.inaccessible_apps_count,
        critical: scan.critical_findings_count,
        high: scan.high_findings_count,
        medium: scan.medium_findings_count,
        low: scan.low_findings_count,
        info: scan.info_findings_count
      },
      findings: findingsList.map((f) => ({
        packageName: f.package_name,
        appName: f.app_name,
        findingType: f.finding_type,
        severity: f.severity,
        confidence: f.confidence,
        description: f.description,
        remediation: f.remediation
      }))
    };

    const blob = new Blob([JSON.stringify(redactedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redacted_scan_${scan.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              fetchScans();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <input
                type="text"
                placeholder="Search Scan ID, User, or Device..."
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
              <option value="">All Scan Types</option>
              <option value="FULL">FULL SCAN</option>
              <option value="QUICK">QUICK SCAN</option>
              <option value="INTEGRITY">INTEGRITY SCAN</option>
            </select>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              Filter
            </button>
          </form>

          <button onClick={fetchScans} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 12px' }}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>Client Scan Reports Inventory</h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Total {totalCount} completed Android app assessments with vulnerability breakdown
            </p>
          </div>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
            Verified Findings
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading scan reports...
          </div>
        ) : scans.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No scan reports found</div>
          </div>
        ) : (
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>SCAN ID</th>
                  <th>TENANT & DEVICE</th>
                  <th>SCAN TYPE</th>
                  <th>ASSESSED / INACCESSIBLE</th>
                  <th>FINDINGS (CRIT / HIGH / MED)</th>
                  <th>COVERAGE</th>
                  <th>COMPLETED</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--cyan-primary)', fontSize: '0.84rem' }}>
                        {s.id}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{s.user_name}</span>
                        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Dev: {s.device_id}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                        {s.scan_type}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {s.apps_assessed_count} apps <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({s.inaccessible_apps_count} locked)</span>
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {s.critical_findings_count > 0 && (
                          <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>
                            {s.critical_findings_count} CRIT
                          </span>
                        )}
                        {s.high_findings_count > 0 && (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                            {s.high_findings_count} HIGH
                          </span>
                        )}
                        {s.medium_findings_count > 0 && (
                          <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                            {s.medium_findings_count} MED
                          </span>
                        )}
                        {s.critical_findings_count === 0 && s.high_findings_count === 0 && s.medium_findings_count === 0 && (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                            CLEAN
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--emerald-success)' }}>
                        {s.coverage_percent}%
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {formatDate(s.finished_at)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleInspect(s)}
                        className="btn btn-secondary btn-sm"
                        title="Inspect Scan Findings"
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

      {/* Inspect Findings Modal */}
      {showInspectModal && selectedScan && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={22} style={{ color: 'var(--cyan-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Scan Report Findings</h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Scan ID: <span className="font-mono">{selectedScan.id}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowInspectModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Scan Summary Ribbon */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  textAlign: 'center',
                  fontSize: '0.78rem'
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Type</div>
                  <div style={{ fontWeight: 700, color: 'var(--cyan-primary)', marginTop: '2px' }}>{selectedScan.scan_type}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Assessed</div>
                  <div style={{ fontWeight: 700, marginTop: '2px' }}>{selectedScan.apps_assessed_count} APKs</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Critical / High</div>
                  <div style={{ fontWeight: 700, color: 'var(--rose-danger)', marginTop: '2px' }}>
                    {selectedScan.critical_findings_count + selectedScan.high_findings_count}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Coverage</div>
                  <div style={{ fontWeight: 700, color: 'var(--emerald-success)', marginTop: '2px' }}>
                    {selectedScan.coverage_percent}%
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>
                  Identified Threats & Vulnerability Disclosures
                </h4>

                {findingsLoading ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px' }} />
                    Loading threat indicators...
                  </div>
                ) : findings.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--emerald-success)', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px' }}>
                    <CheckCircle size={24} style={{ margin: '0 auto 6px' }} />
                    <div>No critical or high-risk findings detected in this report submission.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                    {findings.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          padding: '14px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              className={`badge ${
                                f.severity === 'CRITICAL' ? 'badge-critical' : f.severity === 'HIGH' ? 'badge-warning' : 'badge-cyan'
                              }`}
                              style={{ fontSize: '0.65rem' }}
                            >
                              {f.severity}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{f.app_name}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Confidence: {(f.confidence * 100).toFixed(0)}%
                          </span>
                        </div>

                        <div className="font-mono" style={{ fontSize: '0.74rem', color: 'var(--cyan-primary)' }}>
                          {f.package_name} • {f.finding_type}
                        </div>

                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {f.description}
                        </p>

                        {f.remediation && (
                          <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', fontSize: '0.72rem', color: 'var(--amber-warning)' }}>
                            <strong>Remediation:</strong> {f.remediation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  onClick={() => handleExportRedacted(selectedScan, findings)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} /> Export Redacted Report (JSON)
                </button>

                <button onClick={() => setShowInspectModal(false)} className="btn btn-primary btn-sm">
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
