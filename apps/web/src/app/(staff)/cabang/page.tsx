'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { Building2, Users, Package, MapPin, Clock, Calendar, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface BranchInfo {
  id: string;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  type: 'PUSAT' | 'CABANG';
  operatingHours?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BranchStats {
  activeUsers: number;
  totalMembers: number;
  activePackages: number;
  totalStaff: number;
}

interface ImportIssue {
  rowNumber: number;
  field: string;
  message: string;
}

interface ImportPreview {
  rowNumber: number;
  fullName: string;
  username: string;
  phone: string;
  birthDate: string | null;
  gender: string | null;
}

interface ImportDryRunResult {
  counts: {
    rows: number;
    validRows: number;
    invalidRows: number;
  };
  preview: ImportPreview[];
  issues: ImportIssue[];
  canImport: boolean;
}

interface ImportedAccount {
  rowNumber: number;
  memberId: string;
  memberNo: string;
  fullName: string;
  username: string;
  password: string;
}

export default function CabangPage() {
  const { user } = useAuthStore();
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [checkingImport, setCheckingImport] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportDryRunResult | null>(null);
  const [importedAccounts, setImportedAccounts] = useState<ImportedAccount[]>([]);
  const canImportMemberAccounts = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  useEffect(() => {
    loadBranchData();
  }, []);

  const loadBranchData = async () => {
    try {
      setLoading(true);
      
      // Load branch info
      if (user?.branchId) {
        const branchResponse = await api.get(`/branches/${user.branchId}`);
        setBranch(branchResponse.data.data);
      }

      // Load branch stats (mock data for now)
      // TODO: Replace with actual API call
      setStats({
        activeUsers: 4,
        totalMembers: 10,
        activePackages: 11,
        totalStaff: 4
      });
    } catch (error: any) {
      devError('Failed to load branch data:', error);
      showToast.error('Gagal memuat data cabang');
    } finally {
      setLoading(false);
    }
  };

  const buildImportFormData = () => {
    if (!importFile) return null;
    const formData = new FormData();
    formData.append('file', importFile);
    if (branch?.id) {
      formData.append('branchId', branch.id);
    }
    return formData;
  };

  const handleImportDryRun = async () => {
    const formData = buildImportFormData();
    if (!formData) {
      showToast.error('Pilih file Excel terlebih dahulu');
      return;
    }

    try {
      setCheckingImport(true);
      setImportedAccounts([]);
      const response = await api.post('/members/import/accounts/dry-run', formData);
      setImportPreview(response.data.data);
      showToast.success('File Excel berhasil dicek');
    } catch (error: any) {
      devError('Failed to validate member import:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengecek file Excel');
    } finally {
      setCheckingImport(false);
    }
  };

  const handleExecuteImport = async () => {
    const formData = buildImportFormData();
    if (!formData || !importPreview?.canImport) {
      showToast.error('Cek file Excel yang valid terlebih dahulu');
      return;
    }

    try {
      setExecutingImport(true);
      const response = await api.post('/members/import/accounts/execute', formData);
      const created = response.data.data.created || [];
      setImportedAccounts(created);
      showToast.success(response.data.data.message || 'Import member berhasil');
      await loadBranchData();
    } catch (error: any) {
      devError('Failed to import member accounts:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal import akun member');
    } finally {
      setExecutingImport(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Memuat informasi cabang...</p>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="error-container">
        <Building2 size={48} />
        <h3>Data Cabang Tidak Ditemukan</h3>
        <p>Tidak dapat memuat informasi cabang</p>
      </div>
    );
  }

  return (
    <div className="cabang-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="branch-icon">
            <Building2 size={32} />
          </div>
          <div className="header-text">
            <h1>{branch.name}</h1>
            <div className="branch-badges">
              <span className="branch-code">{branch.branchCode}</span>
              {branch.type === 'PUSAT' && (
                <span className="branch-type-badge">PREMIER</span>
              )}
              {branch.isActive && (
                <span className="status-badge active">✓ Aktif</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.activeUsers || 0}</div>
            <div className="stat-label">User Aktif</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.totalMembers || 0}</div>
            <div className="stat-label">Total Member</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Package size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats?.activePackages || 0}</div>
            <div className="stat-label">Paket Aktif</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button className="tab active">
            <Building2 size={16} />
            Informasi Cabang
          </button>
          <button className="tab">
            <Users size={16} />
            Kelola User ({stats?.totalStaff || 0})
          </button>
          <button className="tab">
            <Users size={16} />
            Kelola Member ({stats?.totalMembers || 0})
          </button>
        </div>
      </div>

      {/* Branch Information */}
      <div className="info-section">
        {canImportMemberAccounts && (
        <div className="info-card import-card">
          <div className="info-header">
            <FileSpreadsheet size={20} />
            <h3>Import Akun Member dari Excel</h3>
          </div>

          <div className="import-layout">
            <div className="import-picker">
              <input
                id="member-account-import"
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setImportFile(file);
                  setImportPreview(null);
                  setImportedAccounts([]);
                }}
              />
              <label htmlFor="member-account-import">
                <Upload size={18} />
                <span>{importFile ? importFile.name : 'Pilih File Excel'}</span>
              </label>
            </div>

            <div className="import-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleImportDryRun}
                disabled={!importFile || checkingImport || executingImport}
              >
                {checkingImport ? 'Mengecek...' : 'Cek File'}
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={handleExecuteImport}
                disabled={!importPreview?.canImport || checkingImport || executingImport}
              >
                {executingImport ? 'Mengimport...' : 'Buat Akun'}
              </button>
            </div>
          </div>

          {importPreview && (
            <div className="import-result">
              <div className={`import-status ${importPreview.canImport ? 'success' : 'error'}`}>
                {importPreview.canImport ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>
                  {importPreview.counts.rows} baris dicek, {importPreview.counts.validRows} valid, {importPreview.counts.invalidRows} perlu diperbaiki
                </span>
              </div>

              {importPreview.issues.length > 0 && (
                <div className="issue-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Baris</th>
                        <th>Field</th>
                        <th>Masalah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.issues.slice(0, 8).map((issue, index) => (
                        <tr key={`${issue.rowNumber}-${issue.field}-${index}`}>
                          <td>{issue.rowNumber}</td>
                          <td>{issue.field}</td>
                          <td>{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importPreview.preview.length > 0 && importPreview.issues.length === 0 && (
                <div className="issue-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Baris</th>
                        <th>Nama</th>
                        <th>Username</th>
                        <th>No HP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.preview.slice(0, 8).map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td>{row.fullName}</td>
                          <td>{row.username}</td>
                          <td>{row.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {importedAccounts.length > 0 && (
            <div className="issue-table credentials-table">
              <table>
                <thead>
                  <tr>
                    <th>Member No</th>
                    <th>Nama</th>
                    <th>Username</th>
                    <th>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {importedAccounts.map((account) => (
                    <tr key={account.memberId}>
                      <td>{account.memberNo}</td>
                      <td>{account.fullName}</td>
                      <td>{account.username}</td>
                      <td>{account.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        <div className="info-card">
          <div className="info-header">
            <MapPin size={20} />
            <h3>Informasi Lokasi</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">ALAMAT:</span>
              <span className="info-value">{branch.address}</span>
            </div>
            <div className="info-item">
              <span className="info-label">KOTA:</span>
              <span className="info-value">{branch.city}</span>
            </div>
            <div className="info-item">
              <span className="info-label">TELEPON:</span>
              <span className="info-value">{branch.phone}</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <div className="info-header">
            <Clock size={20} />
            <h3>Jam Operasional</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">JAM OPERASIONAL:</span>
              <span className="info-value">{branch.operatingHours || '08:00 - 22:00'}</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <div className="info-header">
            <Calendar size={20} />
            <h3>Informasi Sistem</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">DIBUAT:</span>
              <span className="info-value">
                {new Date(branch.createdAt).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">TERAKHIR DIUPDATE:</span>
              <span className="info-value">
                {new Date(branch.updatedAt).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cabang-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .page-header {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 32px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .branch-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(124, 58, 237, 0.2));
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary-500);
          flex-shrink: 0;
        }

        .header-text h1 {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        .branch-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .branch-code {
          font-size: 13px;
          font-weight: 600;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.1);
          color: var(--color-info);
          border-radius: var(--radius-sm);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .branch-type-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
        }

        .status-badge.active {
          background: rgba(34, 197, 94, 0.1);
          color: var(--color-success);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .stat-card {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all var(--transition-fast);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon.purple {
          background: rgba(168, 85, 247, 0.15);
          color: #a855f7;
        }

        .stat-icon.blue {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .stat-icon.orange {
          background: rgba(251, 146, 60, 0.15);
          color: #fb923c;
        }

        .stat-content {
          flex: 1;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 13px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .tabs-container {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 4px;
        }

        .tabs {
          display: flex;
          gap: 4px;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .tab:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .tab.active {
          background: var(--color-primary-500);
          color: white;
        }

        .info-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .import-layout {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .import-picker input {
          display: none;
        }

        .import-picker label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 42px;
          padding: 10px 14px;
          border: 1px dashed var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          max-width: 420px;
        }

        .import-picker span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .import-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .primary-action,
        .secondary-action {
          min-height: 40px;
          padding: 0 16px;
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .primary-action {
          background: var(--color-primary-500);
          color: white;
        }

        .secondary-action {
          background: var(--surface-hover);
          color: var(--text-primary);
          border-color: var(--surface-border);
        }

        .primary-action:disabled,
        .secondary-action:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .import-result {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .import-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        .import-status.success {
          color: var(--color-success);
        }

        .import-status.error {
          color: var(--color-danger);
        }

        .issue-table {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
        }

        .issue-table table {
          width: 100%;
          border-collapse: collapse;
          min-width: 640px;
        }

        .issue-table th,
        .issue-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--surface-border);
          text-align: left;
          font-size: 13px;
          color: var(--text-primary);
        }

        .issue-table th {
          color: var(--text-secondary);
          font-weight: 700;
          background: var(--surface-hover);
        }

        .issue-table tr:last-child td {
          border-bottom: none;
        }

        .credentials-table {
          margin-top: 16px;
        }

        .info-card {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 24px;
        }

        .info-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--surface-border);
          color: var(--color-primary-500);
        }

        .info-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .info-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 16px;
          text-align: center;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--surface-border);
          border-top: 3px solid var(--color-primary-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .error-container h3 {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .error-container p {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .page-header {
            padding: 20px;
          }

          .header-content {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .tabs {
            flex-direction: column;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
