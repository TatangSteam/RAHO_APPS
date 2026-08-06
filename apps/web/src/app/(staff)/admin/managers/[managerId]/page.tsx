'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { ArrowLeft, Building2, Users, UserCog, ChevronDown, ChevronUp, Plus, X, Trash2, Edit, Eye, EyeOff, Power } from 'lucide-react';
import { adminManagersApi, Branch, UpdateAdminManagerData } from '@/lib/api/adminManagersApi';
import type { AdminManagerAccessScope } from '@/types/auth';
import styles from './page.module.css';

interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface Member {
  memberId: string;
  memberNo: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
}

interface AdminManagerDetail {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  adminManagerAccessScope?: AdminManagerAccessScope | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  branches: Branch[];
}

const accessScopeLabels: Record<AdminManagerAccessScope, string> = {
  FULL: 'Akses Penuh',
  MEMBER_VIEW_ONLY: 'Hanya Lihat Member',
};

export default function AdminManagerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const managerId = params?.managerId as string;
  const { user, accessToken } = useAuthStore();
  
  const [manager, setManager] = useState<AdminManagerDetail | null>(null);
  const [branchStaff, setBranchStaff] = useState<Record<string, Staff[]>>({});
  const [branchMembers, setBranchMembers] = useState<Record<string, Member[]>>({});
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Record<string, 'staff' | 'members'>>({});
  const [loading, setLoading] = useState(true);
  
  // Add Branch Modal State
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [loadingAvailableBranches, setLoadingAvailableBranches] = useState(false);
  const [assigningBranch, setAssigningBranch] = useState<string | null>(null);
  const [removingBranch, setRemovingBranch] = useState<string | null>(null);
  const [selectedAccessScope, setSelectedAccessScope] = useState<AdminManagerAccessScope>('FULL');
  const [updatingBranchScope, setUpdatingBranchScope] = useState<string | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    email: '',
    fullName: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    isActive: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete State
  const [deleting, setDeleting] = useState(false);

  // Activate State
  const [activating, setActivating] = useState(false);

  const loadBranchStaff = useCallback(async (branchId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/branches/${branchId}/staff`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        // API returns { users: [...], total, page, limit } inside data
        const staffData = result.data?.users || result.data || [];
        // Transform to match Staff interface
        const transformedStaff = Array.isArray(staffData) ? staffData.map((s) => ({
          id: s.id,
          email: s.email,
          fullName: s.profile?.fullName || s.fullName || '-',
          role: s.role,
          isActive: s.isActive,
        })) : [];
        setBranchStaff(prev => ({ ...prev, [branchId]: transformedStaff }));
      }
    } catch (error) {
      assertCaughtError(error);
      devError(`Error loading staff for branch ${branchId}:`, error);
    }
  }, [accessToken]);

  const loadBranchMembers = useCallback(async (branchId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/branches/${branchId}/members?limit=100`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBranchMembers(prev => ({ ...prev, [branchId]: result.data?.members || [] }));
      }
    } catch (error) {
      assertCaughtError(error);
      devError(`Error loading members for branch ${branchId}:`, error);
    }
  }, [accessToken]);

  const loadAvailableBranches = async () => {
    try {
      setLoadingAvailableBranches(true);
      const response = await adminManagersApi.getAvailableBranchesForManager(managerId);
      setAvailableBranches(response.data || []);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading available branches:', error);
      showToast.error('Gagal memuat daftar cabang');
    } finally {
      setLoadingAvailableBranches(false);
    }
  };

  const loadManagerDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/managers/${managerId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!response.ok) throw new Error('Failed to load manager');

      const result = await response.json();
      setManager(result.data);

      if (result.data.branches) {
        for (const branch of result.data.branches) {
          await loadBranchStaff(branch.id);
          await loadBranchMembers(branch.id);
        }
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading manager detail:', error);
      showToast.error('Gagal memuat detail Admin Manager');
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadBranchMembers, loadBranchStaff, managerId]);

  useEffect(() => {
    if (!user || user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak');
      router.push('/dashboard');
      return;
    }

    void loadManagerDetail();
  }, [loadManagerDetail, router, user]);

  const handleOpenAddBranchModal = () => {
    setSelectedAccessScope('FULL');
    setShowAddBranchModal(true);
    loadAvailableBranches();
  };

  const handleAssignBranch = async (branchId: string) => {
    try {
      setAssigningBranch(branchId);
      await adminManagersApi.assignBranchToManager(managerId, branchId, selectedAccessScope);
      showToast.success('Cabang berhasil ditambahkan');
      setShowAddBranchModal(false);
      await loadManagerDetail();
    } catch (error) {
      assertCaughtError(error);
      devError('Error assigning branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal menambahkan cabang');
    } finally {
      setAssigningBranch(null);
    }
  };

  const getBranchAccessScope = (branch: Branch): AdminManagerAccessScope => {
    return branch.accessScope || manager?.adminManagerAccessScope || 'FULL';
  };

  const handleUpdateBranchScope = async (
    branchId: string,
    accessScope: AdminManagerAccessScope,
  ) => {
    try {
      setUpdatingBranchScope(branchId);
      await adminManagersApi.updateBranchAccessScope(managerId, branchId, accessScope);
      setManager((previous) => previous
        ? {
            ...previous,
            branches: previous.branches.map((branch) => (
              branch.id === branchId ? { ...branch, accessScope } : branch
            )),
          }
        : previous);
      if (accessScope === 'MEMBER_VIEW_ONLY') {
        setActiveTab((previous) => ({ ...previous, [branchId]: 'members' }));
      }
      showToast.success('Scope cabang berhasil diperbarui');
    } catch (error) {
      assertCaughtError(error);
      devError('Error updating branch scope:', error);
      showToast.error(error.response?.data?.message || 'Gagal memperbarui scope cabang');
    } finally {
      setUpdatingBranchScope(null);
    }
  };

  const handleRemoveBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus cabang "${branchName}" dari manager ini?`)) {
      return;
    }

    try {
      setRemovingBranch(branchId);
      await adminManagersApi.unassignBranchFromManager(managerId, branchId);
      showToast.success('Cabang berhasil dihapus');
      await loadManagerDetail();
    } catch (error) {
      assertCaughtError(error);
      devError('Error removing branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    } finally {
      setRemovingBranch(null);
    }
  };

  const handleOpenEditModal = () => {
    if (manager) {
      setEditForm({
        email: manager.email,
        fullName: manager.fullName,
        phoneNumber: manager.phoneNumber || '',
        password: '',
        confirmPassword: '',
        isActive: manager.isActive,
      });
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = async () => {
    // Validation
    if (!editForm.email.trim()) {
      showToast.error('Email harus diisi');
      return;
    }
    if (!editForm.fullName.trim()) {
      showToast.error('Nama lengkap harus diisi');
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      showToast.error('Password minimal 6 karakter');
      return;
    }
    if (editForm.password && editForm.password !== editForm.confirmPassword) {
      showToast.error('Password dan konfirmasi password tidak sama');
      return;
    }

    try {
      setSavingEdit(true);
      
      const updateData: UpdateAdminManagerData = {
        email: editForm.email,
        fullName: editForm.fullName,
        phoneNumber: editForm.phoneNumber,
        isActive: editForm.isActive,
      };

      // Only include password if it's being changed
      if (editForm.password) {
        updateData.password = editForm.password;
      }

      await adminManagersApi.updateAdminManager(managerId, updateData);
      showToast.success('Admin Manager berhasil diperbarui');
      setShowEditModal(false);
      await loadManagerDetail();
    } catch (error) {
      assertCaughtError(error);
      devError('Error updating manager:', error);
      showToast.error(error.response?.data?.message || 'Gagal memperbarui Admin Manager');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!manager) return;

    const confirmText = `Apakah Anda yakin ingin menghapus Admin Manager "${manager.fullName}"?\n\nTindakan ini akan:\n- Menghapus semua assignment cabang\n- Menghapus akun Admin Manager secara permanen\n\nTindakan ini tidak dapat dibatalkan.`;
    
    if (!confirm(confirmText)) {
      return;
    }

    try {
      setDeleting(true);
      await adminManagersApi.deleteAdminManager(managerId);
      showToast.success('Admin Manager berhasil dihapus');
      router.push('/admin/managers');
    } catch (error) {
      assertCaughtError(error);
      devError('Error deleting manager:', error);
      showToast.error(error.response?.data?.message || 'Gagal menghapus Admin Manager');
    } finally {
      setDeleting(false);
    }
  };

  const handleActivate = async () => {
    if (!manager) return;

    if (!confirm(`Apakah Anda yakin ingin mengaktifkan kembali Admin Manager "${manager.fullName}"?`)) {
      return;
    }

    try {
      setActivating(true);
      await adminManagersApi.updateAdminManager(managerId, { isActive: true });
      showToast.success('Admin Manager berhasil diaktifkan');
      await loadManagerDetail();
    } catch (error) {
      assertCaughtError(error);
      devError('Error activating manager:', error);
      showToast.error(error.response?.data?.message || 'Gagal mengaktifkan Admin Manager');
    } finally {
      setActivating(false);
    }
  };

  const toggleBranch = (branchId: string) => {
    setExpandedBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
        const branch = manager?.branches.find((item) => item.id === branchId);
        const defaultTab = branch && getBranchAccessScope(branch) === 'MEMBER_VIEW_ONLY'
          ? 'members'
          : 'staff';
        if (!activeTab[branchId]) {
          setActiveTab(prev => ({ ...prev, [branchId]: defaultTab }));
        }
      }
      return newSet;
    });
  };

  const setTab = (branchId: string, tab: 'staff' | 'members') => {
    const branch = manager?.branches.find((item) => item.id === branchId);
    if (tab === 'staff' && branch && getBranchAccessScope(branch) === 'MEMBER_VIEW_ONLY') {
      return;
    }

    setActiveTab(prev => ({ ...prev, [branchId]: tab }));
  };

  const fullAccessBranchCount = manager?.branches.filter(
    (branch) => getBranchAccessScope(branch) === 'FULL',
  ).length || 0;
  const memberOnlyBranchCount = manager?.branches.filter(
    (branch) => getBranchAccessScope(branch) === 'MEMBER_VIEW_ONLY',
  ).length || 0;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!manager) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Admin Manager tidak ditemukan</p>
          <button onClick={() => router.back()} className={styles.backBtn}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          <ArrowLeft size={20} />
          <span>Kembali</span>
        </button>
        
        <div className={styles.headerRow}>
          <div className={styles.headerInfo}>
            <div className={styles.avatar}>
              {manager.fullName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.headerText}>
              <h1>{manager.fullName}</h1>
              <p className={styles.email}>{manager.email}</p>
              <div className={styles.headerBadges}>
                <span className={`${styles.statusBadge} ${manager.isActive ? styles.active : styles.inactive}`}>
                  {manager.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
                <span className={`${styles.accessBadge} ${styles.fullAccess}`}>
                  {fullAccessBranchCount} Akses Penuh
                </span>
                <span className={`${styles.accessBadge} ${styles.memberOnly}`}>
                  {memberOnlyBranchCount} Hanya Lihat Member
                </span>
              </div>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            {!manager.isActive && (
              <button 
                className={styles.activateBtn}
                onClick={handleActivate}
                disabled={activating}
              >
                {activating ? '⏳' : <Power size={18} />}
                <span>{activating ? 'Mengaktifkan...' : 'Aktifkan'}</span>
              </button>
            )}
            <button 
              className={styles.editBtn}
              onClick={handleOpenEditModal}
            >
              <Edit size={18} />
              <span>Edit</span>
            </button>
            <button 
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '⏳' : <Trash2 size={18} />}
              <span>{deleting ? 'Menghapus...' : 'Hapus'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Building2 size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{manager.branches.length}</div>
            <div className={styles.statLabel}>Branches</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <UserCog size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {Object.values(branchStaff).reduce((sum, staff) => sum + staff.length, 0)}
            </div>
            <div className={styles.statLabel}>Total Staff</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Users size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {Object.values(branchMembers).reduce((sum, members) => sum + members.length, 0)}
            </div>
            <div className={styles.statLabel}>Total Members</div>
          </div>
        </div>
      </div>

      {/* Branches List */}
      <div className={styles.branchesSection}>
        <div className={styles.branchesSectionHeader}>
          <h2>Branches yang Dikelola</h2>
          <button 
            className={styles.addBranchBtn}
            onClick={handleOpenAddBranchModal}
          >
            <Plus size={18} />
            <span>Tambah Cabang</span>
          </button>
        </div>
        
        {manager.branches.length === 0 ? (
          <div className={styles.emptyState}>
            <Building2 size={48} />
            <p>Belum ada branch yang di-assign</p>
            <button 
              className={styles.addBranchBtnEmpty}
              onClick={handleOpenAddBranchModal}
            >
              <Plus size={18} />
              <span>Tambah Cabang Pertama</span>
            </button>
          </div>
        ) : (
          <div className={styles.branchesList}>
            {manager.branches.map((branch) => {
              const isExpanded = expandedBranches.has(branch.id);
              const staff = branchStaff[branch.id] || [];
              const members = branchMembers[branch.id] || [];
              const branchAccessScope = getBranchAccessScope(branch);
              const isMemberOnlyBranch = branchAccessScope === 'MEMBER_VIEW_ONLY';
              const currentTab = isMemberOnlyBranch ? 'members' : (activeTab[branch.id] || 'staff');

              return (
                <div key={branch.id} className={styles.branchCard}>
                  {/* Branch Header */}
                  <div className={styles.branchHeader}>
                    <div 
                      className={styles.branchInfo}
                      onClick={() => toggleBranch(branch.id)}
                    >
                      <div className={styles.branchIcon}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3>{branch.name}</h3>
                        <p className={styles.branchMeta}>
                          <span className={styles.branchCode}>{branch.branchCode}</span>
                          <span className={styles.separator}>•</span>
                          <span>{branch.city || '-'}</span>
                          <span className={styles.separator}>•</span>
                          <span>{branch.type}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className={styles.branchStats}>
                      <span className={`${styles.accessBadge} ${isMemberOnlyBranch ? styles.memberOnly : styles.fullAccess}`}>
                        {accessScopeLabels[branchAccessScope]}
                      </span>
                      <span className={styles.statBadge}>
                        <UserCog size={14} />
                        {staff.length} Staff
                      </span>
                      <span className={styles.statBadge}>
                        <Users size={14} />
                        {members.length} Members
                      </span>
                      <button
                        className={styles.removeBranchBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBranch(branch.id, branch.name);
                        }}
                        disabled={removingBranch === branch.id}
                        title="Hapus cabang dari manager"
                      >
                        {removingBranch === branch.id ? '⏳' : <Trash2 size={16} />}
                      </button>
                      <select
                        className={styles.scopeSelect}
                        value={branchAccessScope}
                        disabled={updatingBranchScope === branch.id}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateBranchScope(branch.id, e.target.value as AdminManagerAccessScope);
                        }}
                        title="Ubah akses manager untuk cabang ini"
                      >
                        <option value="FULL">Akses Penuh</option>
                        <option value="MEMBER_VIEW_ONLY">Hanya Lihat Member</option>
                      </select>
                      <div 
                        className={styles.expandIcon}
                        onClick={() => toggleBranch(branch.id)}
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Branch Content */}
                  {isExpanded && (
                    <div className={styles.branchContent}>
                      {/* Tabs */}
                      <div className={styles.tabs}>
                        <button
                          className={`${styles.tab} ${currentTab === 'staff' ? styles.active : ''}`}
                          onClick={() => setTab(branch.id, 'staff')}
                          disabled={isMemberOnlyBranch}
                          title={isMemberOnlyBranch ? 'Scope cabang ini hanya mengizinkan lihat member' : undefined}
                        >
                          <UserCog size={16} />
                          Staff ({staff.length})
                        </button>
                        <button
                          className={`${styles.tab} ${currentTab === 'members' ? styles.active : ''}`}
                          onClick={() => setTab(branch.id, 'members')}
                        >
                          <Users size={16} />
                          Members ({members.length})
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div className={styles.tabContent}>
                        {currentTab === 'staff' && (
                          <div className={styles.staffList}>
                            {staff.length === 0 ? (
                              <p className={styles.emptyMessage}>Belum ada staff di branch ini</p>
                            ) : (
                              <table className={styles.dataTable}>
                                <thead>
                                  <tr>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {staff.map((s) => (
                                    <tr key={s.id}>
                                      <td>{s.fullName}</td>
                                      <td>{s.email}</td>
                                      <td>
                                        <span className={styles.roleBadge}>{s.role}</span>
                                      </td>
                                      <td>
                                        <span className={`${styles.statusDot} ${s.isActive ? styles.active : styles.inactive}`}>
                                          {s.isActive ? 'Aktif' : 'Tidak Aktif'}
                                        </span>
                                      </td>
                                      <td>
                                        <button
                                          className={styles.actionBtn}
                                          onClick={() => router.push(`/branches/${branch.id}`)}
                                          title="Lihat Detail"
                                        >
                                          👁️
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {currentTab === 'members' && (
                          <div className={styles.membersList}>
                            {members.length === 0 ? (
                              <p className={styles.emptyMessage}>Belum ada member di branch ini</p>
                            ) : (
                              <table className={styles.dataTable}>
                                <thead>
                                  <tr>
                                    <th>Kode Member</th>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Telepon</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map((m) => (
                                    <tr key={m.memberId}>
                                      <td>
                                        <span className={styles.memberCode}>{m.memberNo}</span>
                                      </td>
                                      <td>{m.fullName}</td>
                                      <td>{m.email}</td>
                                      <td>{m.phone}</td>
                                      <td>
                                        <span className={`${styles.statusDot} ${m.isActive ? styles.active : styles.inactive}`}>
                                          {m.isActive ? 'Aktif' : 'Tidak Aktif'}
                                        </span>
                                      </td>
                                      <td>
                                        <button
                                          className={styles.actionBtn}
                                          onClick={() => router.push(`/members/${m.memberId}`)}
                                          title="Lihat Detail"
                                        >
                                          👁️
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Branch Modal */}
      {showAddBranchModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddBranchModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Tambah Cabang</h3>
              <button 
                className={styles.modalCloseBtn}
                onClick={() => setShowAddBranchModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label>Scope akses untuk cabang yang ditambahkan</label>
                <div className={styles.toggleContainer}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${selectedAccessScope === 'FULL' ? styles.active : ''}`}
                    onClick={() => setSelectedAccessScope('FULL')}
                  >
                    Akses Penuh
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${selectedAccessScope === 'MEMBER_VIEW_ONLY' ? styles.active : ''}`}
                    onClick={() => setSelectedAccessScope('MEMBER_VIEW_ONLY')}
                  >
                    Hanya Lihat Member
                  </button>
                </div>
                <p className={styles.fieldHelp}>
                  Scope ini hanya berlaku untuk cabang yang dipilih di bawah.
                </p>
              </div>

              {loadingAvailableBranches ? (
                <div className={styles.modalLoading}>
                  <div className={styles.loadingSpinner}>⏳</div>
                  <p>Memuat daftar cabang...</p>
                </div>
              ) : availableBranches.length === 0 ? (
                <div className={styles.modalEmpty}>
                  <Building2 size={48} />
                  <p>Semua cabang sudah di-assign ke manager ini</p>
                </div>
              ) : (
                <div className={styles.branchSelectList}>
                  {availableBranches.map((branch) => (
                    <div key={branch.id} className={styles.branchSelectItem}>
                      <div className={styles.branchSelectInfo}>
                        <div className={styles.branchSelectIcon}>
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div className={styles.branchSelectName}>{branch.name}</div>
                          <div className={styles.branchSelectMeta}>
                            <span className={styles.branchCode}>{branch.branchCode}</span>
                            <span className={styles.separator}>•</span>
                            <span>{branch.city || '-'}</span>
                            <span className={styles.separator}>•</span>
                            <span>{branch.type}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className={styles.assignBtn}
                        onClick={() => handleAssignBranch(branch.id)}
                        disabled={assigningBranch === branch.id}
                      >
                        {assigningBranch === branch.id ? '⏳' : (
                          <>
                            <Plus size={16} />
                            <span>Tambah</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Admin Manager</h3>
              <button 
                className={styles.modalCloseBtn}
                onClick={() => setShowEditModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label>Email <span className={styles.required}>*</span></label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Nama Lengkap <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Nama lengkap"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Nomor Telepon</label>
                <input
                  type="tel"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Password Baru <span className={styles.hint}>(kosongkan jika tidak ingin mengubah)</span></label>
                <div className={styles.passwordInput}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimal 6 karakter"
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {editForm.password && (
                <div className={styles.formGroup}>
                  <label>Konfirmasi Password Baru <span className={styles.required}>*</span></label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editForm.confirmPassword}
                    onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Ulangi password baru"
                    className={styles.input}
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Status</label>
                <div className={styles.toggleContainer}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${editForm.isActive ? styles.active : ''}`}
                    onClick={() => setEditForm(prev => ({ ...prev, isActive: true }))}
                  >
                    Aktif
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${!editForm.isActive ? styles.active : ''}`}
                    onClick={() => setEditForm(prev => ({ ...prev, isActive: false }))}
                  >
                    Tidak Aktif
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn}
                onClick={() => setShowEditModal(false)}
                disabled={savingEdit}
              >
                Batal
              </button>
              <button 
                className={styles.saveBtn}
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? '⏳ Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
