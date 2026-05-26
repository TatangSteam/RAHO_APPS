'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import styles from './page.module.css';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  meta: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  branch: {
    id: string;
    name: string;
    branchCode: string;
  } | null;
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak - Hanya untuk Super Admin');
      router.push('/dashboard');
      return;
    }

    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken, page, action, resource]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(action && { action }),
        ...(resource && { resource }),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/branches/system/audit-logs?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Gagal memuat audit logs');

      const result = await response.json();
      setLogs(result.data.logs);
      setTotalPages(result.data.pagination.totalPages);
    } catch (error: any) {
      devError('Error loading audit logs:', error);
      showToast.error(error.message || 'Gagal memuat audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadAuditLogs();
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return styles.actionCreate;
      case 'UPDATE':
        return styles.actionUpdate;
      case 'DELETE':
        return styles.actionDelete;
      case 'LOGIN':
        return styles.actionLogin;
      case 'LOGOUT':
        return styles.actionLogout;
      default:
        return styles.actionDefault;
    }
  };

  if (!mounted) return null;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>🔐 Audit Log</h1>
          <p className={styles.subtitle}>Riwayat aktivitas sistem</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <input
            type="text"
            placeholder="Cari resource atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.searchInput}
          />
          <button onClick={handleSearch} className={styles.searchBtn}>
            🔍 Cari
          </button>
        </div>

        <div className={styles.filterGroup}>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className={styles.select}
          >
            <option value="">Semua Action</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="VERIFY">VERIFY</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
          </select>

          <select
            value={resource}
            onChange={(e) => {
              setResource(e.target.value);
              setPage(1);
            }}
            className={styles.select}
          >
            <option value="">Semua Resource</option>
            <option value="User">User</option>
            <option value="Member">Member</option>
            <option value="Branch">Branch</option>
            <option value="Package">Package</option>
            <option value="Session">Session</option>
            <option value="Invoice">Invoice</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <h3>Tidak Ada Log</h3>
          <p>Belum ada aktivitas yang tercatat</p>
        </div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>User</th>
                  <th>Cabang</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.timestamp}>
                      {new Date(log.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <span className={`${styles.actionBadge} ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div className={styles.resourceCell}>
                        <span className={styles.resourceName}>{log.resource}</span>
                        {log.resourceId && (
                          <span className={styles.resourceId}>{log.resourceId.substring(0, 8)}...</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.userCell}>
                        <span className={styles.userName}>{log.user.fullName}</span>
                        <span className={styles.userRole}>{log.user.role}</span>
                      </div>
                    </td>
                    <td>{log.branch?.name || '-'}</td>
                    <td className={styles.ipAddress}>{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className={styles.paginationBtn}
            >
              ← Sebelumnya
            </button>
            <span className={styles.pageInfo}>
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className={styles.paginationBtn}
            >
              Selanjutnya →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
