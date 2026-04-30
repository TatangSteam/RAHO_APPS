'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMembersApi } from '@/lib/membersApi';
import type { Member } from '@/types/member';
import { useAuthStore } from '@/stores/authStore';
import { LookupMemberModal } from '@/components/members/LookupMemberModal';
import ExportMembersModal from '@/components/members/ExportMembersModal';

export default function MembersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showLookupModal, setShowLookupModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const canCreateMember = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(
    user?.role || ''
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page when search changes
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadMembers();
  }, [page, status, debouncedSearch]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const result = await getMembersApi({
        search: debouncedSearch || undefined,
        status: status || undefined,
        page,
        limit: 20,
      });
      console.log('Members data:', result.members);
      console.log('First member photoUrl:', result.members[0]?.photoUrl);
      setMembers(result.members);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPage(1);
  };

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Manajemen Member
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Kelola data member dan akses lintas cabang</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowExportModal(true)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              📥 Export Data
            </button>
            <button
              onClick={() => setShowLookupModal(true)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              🔍 Cari Lintas Cabang
            </button>
            {canCreateMember && (
              <button
                onClick={() => router.push('/members/new')}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                ➕ Daftarkan Member Baru
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', opacity: 0.9 }}>Total Member</span>
              <span style={{ fontSize: '32px' }}>👥</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '700', margin: 0 }}>{total}</p>
            <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>Member terdaftar</p>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', opacity: 0.9 }}>Member Aktif</span>
              <span style={{ fontSize: '32px' }}>✅</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '700', margin: 0 }}>{members.filter(m => m.isActive).length}</p>
            <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>Dari halaman ini</p>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', border: 'none', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', opacity: 0.9 }}>Lintas Cabang</span>
              <span style={{ fontSize: '32px' }}>🔗</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '700', margin: 0 }}>{members.filter(m => m.isLintas).length}</p>
            <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>Dari halaman ini</p>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', opacity: 0.9 }}>Total Voucher BASIC</span>
              <span style={{ fontSize: '32px' }}>🎫</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '700', margin: 0 }}>{members.reduce((sum, m) => sum + (m.basicPackageCount || 0), 0)}</p>
            <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>Sisa voucher BASIC aktif</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>🔍</span>
            <input
              type="text"
              placeholder="Cari nama, no. member, atau telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '44px' }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="form-input"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Cari
        </button>
      </form>
    </div>

    {/* Table */}
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Memuat data member...</p>
      </div>
    ) : members.length === 0 ? (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>👥</div>
        <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>Tidak ada member ditemukan</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Coba ubah filter pencarian Anda</p>
      </div>
    ) : (
      <>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>No. Member</th>
                <th>Nama & Cabang</th>
                <th>Telepon</th>
                <th style={{ textAlign: 'center' }}>Voucher BASIC</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr 
                  key={member.memberId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/members/${member.memberId}`)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{member.memberNo || 'N/A'}</span>
                      {member.isLintas && (
                        <span className="badge badge-cyan">🔗 Lintas</span>
                      )}
                    </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '50%', 
                                background: member.photoUrl ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'white', 
                                fontWeight: '700',
                                fontSize: '16px',
                                flexShrink: 0,
                                position: 'relative',
                                overflow: 'visible',
                                border: '2px solid var(--surface-border)'
                              }}>
                                {member.photoUrl ? (
                                  <img
                                    src={member.photoUrl}
                                    alt={member.fullName || 'Member'}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      borderRadius: '50%'
                                    }}
                                  />
                                ) : (
                                  (member.fullName || 'M').charAt(0).toUpperCase()
                                )}
                                {member.isActive && (
                                  <span style={{
                                    position: 'absolute',
                                    bottom: '0',
                                    right: '0',
                                    width: '12px',
                                    height: '12px',
                                    background: '#22c55e',
                                    border: '2px solid var(--surface-card)',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 0 2px var(--surface-card)'
                                  }}></span>
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600', marginBottom: '2px' }}>{member.fullName || 'Nama tidak tersedia'}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                  🏢 {member.registrationBranch || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '14px' }}>📞 {member.phone || '-'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '48px',
                              height: '48px',
                              background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.2))',
                              border: '2px solid rgba(245,158,11,0.3)',
                              borderRadius: '12px',
                              fontWeight: '700',
                              fontSize: '18px',
                              color: '#f59e0b'
                            }}>
                              {member.basicPackageCount || 0}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {member.isActive ? (
                              <span className="badge badge-success">
                                <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', display: 'inline-block', marginRight: '6px' }}></span>
                                Aktif
                              </span>
                            ) : (
                              <span className="badge badge-gray">
                                <span style={{ width: '6px', height: '6px', background: '#64748b', borderRadius: '50%', display: 'inline-block', marginRight: '6px' }}></span>
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/members/${member.memberId}`);
                              }}
                              className="btn btn-sm btn-primary"
                          >
                            👁️ Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-sm btn-secondary"
                  >
                    ← Sebelumnya
                  </button>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Halaman <strong style={{ color: 'var(--color-primary-400)' }}>{page}</strong> dari <strong>{totalPages}</strong>
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-sm btn-secondary"
                  >
                    Selanjutnya →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Lookup */}
        <LookupMemberModal
          isOpen={showLookupModal}
          onClose={() => setShowLookupModal(false)}
          onSuccess={() => loadMembers()}
        />

        {/* Modal Export */}
        <ExportMembersModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          currentSearch={debouncedSearch}
          currentStatus={status}
        />
    </>
  );
}
