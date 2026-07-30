'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMembersApi } from '@/lib/membersApi';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import type { Member } from '@/types/member';
import { useAuthStore } from '@/stores/authStore';
import { LookupMemberModal } from '@/components/members/LookupMemberModal';
import ExportMembersModal from '@/components/members/ExportMembersModal';
import { ColumnConfigModal } from '@/components/members/ColumnConfigModal';
import { MemberTableCell } from '@/components/members/MemberTableCell';
import { useMemberColumns } from '@/hooks/useMemberColumns';
import { devLog, devError } from '@/lib/logger';
import { PageLoading } from '@/components/ui/LoadingSpinner';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Link2,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import styles from './page.module.css';

export default function MembersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Array<{ branchCode: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branchFilter, setBranchFilter] = useState(''); // Filter cabang
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const [showLookupModal, setShowLookupModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showColumnConfigModal, setShowColumnConfigModal] = useState(false);

  // Custom columns hook
  const { columns, visibleColumns, toggleColumn, resetColumns } = useMemberColumns();

  // Check if user is ADMIN_MANAGER (can see multiple branches they manage)
  const isAdminManager = user?.role === 'ADMIN_MANAGER';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isMemberViewOnlyAdminManager =
    isAdminManager && user?.adminManagerAccessScope === 'MEMBER_VIEW_ONLY';

  const canCreateMember = ['ADMIN_LAYANAN', 'ADMIN_CABANG', 'SUPER_ADMIN'].includes(
    user?.role || ''
  );
  const canLookupCrossBranch = !['DOCTOR', 'NURSE', 'ADMIN_MANAGER'].includes(user?.role || '');
  // Load branches list for filter
  useEffect(() => {
    if (isSuperAdmin || isAdminManager) {
      loadBranches();
    }
    // Don't auto-set filter for ADMIN_MANAGER anymore - let them choose
  }, [isSuperAdmin, isAdminManager]);

  const loadBranches = async () => {
    try {
      devLog('🔄 Loading branches for role:', user?.role);
      const { branchesApi } = await import('@/lib/api/branchesApi');
      const response = await branchesApi.getAllBranches();
      devLog('📊 Full API response:', response);
      devLog('📊 Response data:', response.data);
      
      // getAllBranches returns array directly in response.data.data
      const branchesData = Array.isArray(response.data.data) ? response.data.data : [];
      devLog('📋 Branches data (array):', branchesData);
      devLog('📋 Branches count:', branchesData.length);
      
      if (branchesData.length === 0) {
        devLog('⚠️ No branches returned from API');
      }
      
      const mappedBranches = branchesData.map((b: any) => {
        devLog('  - Branch:', b.branchCode, b.name);
        return { branchCode: b.branchCode, name: b.name };
      });
      
      setBranches(mappedBranches);
      devLog('✅ Branches state updated:', mappedBranches.length, 'branches');
    } catch (error: any) {
      devError('❌ Failed to load branches:', error);
      devError('❌ Error details:', error.response?.data || error.message);
    }
  };

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
  }, [page, status, debouncedSearch, branchFilter]);

  useEffect(() => {
    let cancelled = false;

    const loadPhotoUrls = async () => {
      const entries = await Promise.all(
        members
          .filter((member) => Boolean(member.photoUrl))
          .map(async (member) => {
            try {
              const blobUrl = await createAuthenticatedObjectUrl(member.photoUrl!);
              return [member.memberId, blobUrl] as const;
            } catch (error) {
              devError('Failed to load member photo:', member.memberId, error);
              return [member.memberId, ''] as const;
            }
          }),
      );

      if (!cancelled) {
        setPhotoUrls((previous) => {
          Object.values(previous).forEach((url) => {
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          });

          return Object.fromEntries(entries.filter(([, url]) => Boolean(url)));
        });
      }
    };

    loadPhotoUrls();

    return () => {
      cancelled = true;
    };
  }, [members]);

  useEffect(() => {
    return () => {
      Object.values(photoUrls).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [photoUrls]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const result = await getMembersApi({
        search: debouncedSearch || undefined,
        status: status || undefined,
        branchCode: branchFilter || undefined,
        page,
        limit: 20,
      });
      devLog('Members data:', result.members);
      devLog('First member photoUrl:', result.members[0]?.photoUrl);
      setMembers(result.members);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (error) {
      devError('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPage(1);
  };

  const activeMembersOnPage = members.filter((member) => member.isActive && !member.isDeceased).length;
  const crossBranchMembersOnPage = members.filter((member) => member.isLintas).length;
  const basicVouchersOnPage = members.reduce(
    (sum, member) => sum + (Number.isFinite(member.basicPackageCount) ? member.basicPackageCount : 0),
    0,
  );
  const hasActiveFilter = Boolean(search || status || branchFilter);

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setBranchFilter('');
    setPage(1);
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroIcon}>
            <UsersRound size={25} />
          </div>
          <div>
            <p className={styles.eyebrow}>Data layanan</p>
            <h1>Member</h1>
            <p>Cari data, periksa kelengkapan, lalu lanjutkan ke profil atau sesi terapi.</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => setShowColumnConfigModal(true)}
            className={styles.secondaryAction}
            title="Atur kolom tabel"
          >
            <Settings2 size={17} />
            Atur kolom
          </button>
          {!['DOCTOR', 'NURSE'].includes(user?.role || '') && !isMemberViewOnlyAdminManager && (
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className={styles.secondaryAction}
            >
              <Download size={17} />
              Export
            </button>
          )}
          {canLookupCrossBranch && (
            <button
              type="button"
              onClick={() => setShowLookupModal(true)}
              className={styles.secondaryAction}
            >
              <Link2 size={17} />
              Lintas cabang
            </button>
          )}
          {canCreateMember && (
            <button
              type="button"
              onClick={() => router.push('/members/new')}
              className={styles.primaryAction}
            >
              <Plus size={18} />
              Daftarkan Member
            </button>
          )}
        </div>
      </section>

      <section className={styles.guide} aria-label="Petunjuk singkat">
        <ShieldCheck size={18} />
        <p>
          <strong>Alur cepat:</strong> cari member, buka profil untuk memeriksa data, lalu pilih tab Sesi Terapi
          saat akan melanjutkan pelayanan. Rank dihitung otomatis dari diskon pembelian paket terakhir:
          A 0–20%, B 21–50%, dan C 51–100%.
        </p>
      </section>

      <section className={styles.statsGrid} aria-label="Ringkasan member">
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.blue}`}><UsersRound size={20} /></div>
          <div><p>Total member</p><strong>{total}</strong><span>sesuai filter saat ini</span></div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.green}`}><UserCheck size={20} /></div>
          <div><p>Member aktif</p><strong>{activeMembersOnPage}</strong><span>pada halaman ini</span></div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.purple}`}><Link2 size={20} /></div>
          <div><p>Lintas cabang</p><strong>{crossBranchMembersOnPage}</strong><span>pada halaman ini</span></div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.amber}`}><Ticket size={20} /></div>
          <div><p>Voucher BASIC</p><strong>{basicVouchersOnPage}</strong><span>sisa pada halaman ini</span></div>
        </article>
      </section>

      <section className={styles.filterCard}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Cari member</h2>
            <p>Gunakan nama, nomor member, atau telepon.</p>
          </div>
          {hasActiveFilter && (
            <button type="button" onClick={resetFilters} className={styles.resetButton}>
              Reset filter
            </button>
          )}
        </div>
        <form onSubmit={handleSearch} className={styles.filterForm}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>Cari member</span>
            <Search size={18} />
            <input
              type="text"
              placeholder="Cari nama, no. member, atau telepon..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="form-input"
            />
          </label>
          {(isSuperAdmin || isAdminManager) ? (
            <label className={styles.selectField}>
              <span>Cabang</span>
              <select
                aria-label="Filter cabang"
                value={branchFilter}
                onChange={(event) => {
                  setBranchFilter(event.target.value);
                  setPage(1);
                }}
                className="form-input"
              >
                <option value="">Semua Cabang</option>
                {branches.map((branch) => (
                  <option key={branch.branchCode} value={branch.branchCode}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : user?.branchCode ? (
            <div className={styles.branchReadOnly}>
              <Building2 size={17} />
              <span>{user.branchCode}</span>
            </div>
          ) : null}
          <label className={styles.selectField}>
            <span>Status</span>
            <select
              aria-label="Filter status member"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="form-input"
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </label>
          <button type="submit" className={styles.searchButton}>
            <Search size={17} />
            Cari
          </button>
        </form>
      </section>

      <section className={styles.resultsCard}>
        <div className={styles.resultsHeader}>
          <div>
            <p className={styles.eyebrow}>Hasil pencarian</p>
            <h2>{loading ? 'Memuat member...' : `${total} member ditemukan`}</h2>
          </div>
          <p>Klik baris untuk membuka profil lengkap.</p>
        </div>

        {loading ? (
          <PageLoading text="Memuat data member" />
        ) : members.length === 0 ? (
          <div className={styles.emptyState}>
            <div><Inbox size={28} /></div>
            <h3>Tidak ada member ditemukan</h3>
            <p>Coba periksa kata pencarian atau ubah filter yang dipilih.</p>
            {hasActiveFilter && (
              <button type="button" onClick={resetFilters} className={styles.secondaryAction}>
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <>
            {branchFilter && (isSuperAdmin || isAdminManager) && (
              <div className={styles.contextBanner}>
                <Building2 size={16} />
                Menampilkan <strong>{total}</strong> member dari cabang{' '}
                <strong>{branches.find((branch) => branch.branchCode === branchFilter)?.name || branchFilter}</strong>
              </div>
            )}
            {isAdminManager && !branchFilter && branches.length > 0 && (
              <div className={styles.contextBanner}>
                <Building2 size={16} />
                Menampilkan member dari <strong>{branches.length}</strong> cabang yang Anda kelola
              </div>
            )}
            <div className={`table-wrapper ${styles.tableWrapper}`}>
              <table>
                <thead>
                  <tr>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.id}
                        style={{
                          textAlign: ['rank', 'status', 'basicPackage', 'voucherCount', 'actions', 'sessionCount', 'lastInfusion'].includes(column.id)
                            ? 'center'
                            : 'left',
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.memberId}
                      className={styles.memberRow}
                      onClick={() => router.push(`/members/${member.memberId}`)}
                    >
                      {visibleColumns.map((column) => (
                        <td
                          key={column.id}
                          style={{
                            textAlign: ['rank', 'status', 'basicPackage', 'voucherCount', 'actions', 'sessionCount', 'lastInfusion'].includes(column.id)
                              ? 'center'
                              : 'left',
                          }}
                        >
                          <MemberTableCell
                            columnId={column.id}
                            member={member}
                            photoUrl={photoUrls[member.memberId]}
                            onNavigate={() => router.push(`/members/${member.memberId}`)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={page === 1}
                  className={styles.pageButton}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft size={17} />
                  <span>Sebelumnya</span>
                </button>
                <span>Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong></span>
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  disabled={page === totalPages}
                  className={styles.pageButton}
                  aria-label="Halaman selanjutnya"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <LookupMemberModal
        isOpen={showLookupModal}
        onClose={() => setShowLookupModal(false)}
        onSuccess={() => loadMembers()}
      />
      <ExportMembersModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentSearch={debouncedSearch}
        currentStatus={status}
      />
      <ColumnConfigModal
        isOpen={showColumnConfigModal}
        onClose={() => setShowColumnConfigModal(false)}
        columns={columns}
        onToggleColumn={toggleColumn}
        onReset={resetColumns}
      />
    </main>
  );
}
