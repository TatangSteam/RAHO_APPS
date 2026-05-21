'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { Building2, Users, Package, MapPin, Phone, Clock, Calendar } from 'lucide-react';

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

export default function CabangPage() {
  const { user } = useAuthStore();
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to load branch data:', error);
      showToast.error('Gagal memuat data cabang');
    } finally {
      setLoading(false);
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