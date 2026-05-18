'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { ArrowLeft, Building2, Users, UserCog, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './page.module.css';

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  city: string;
  type: string;
  isActive: boolean;
}

interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface Member {
  id: string;
  memberCode: string;
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
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  branches: Branch[];
}

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

  useEffect(() => {
    if (!user || user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak');
      router.push('/dashboard');
      return;
    }

    loadManagerDetail();
  }, [managerId]);

  const loadManagerDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/managers/${managerId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load manager');

      const result = await response.json();
      setManager(result.data);

      // Load staff and members for each branch
      if (result.data.branches) {
        for (const branch of result.data.branches) {
          await loadBranchStaff(branch.id);
          await loadBranchMembers(branch.id);
        }
      }
    } catch (error: any) {
      console.error('Error loading manager detail:', error);
      showToast.error('Gagal memuat detail Admin Manager');
    } finally {
      setLoading(false);
    }
  };

  const loadBranchStaff = async (branchId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/branches/${branchId}/staff`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBranchStaff(prev => ({ ...prev, [branchId]: result.data || [] }));
      }
    } catch (error) {
      console.error(`Error loading staff for branch ${branchId}:`, error);
    }
  };

  const loadBranchMembers = async (branchId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/members?branchId=${branchId}&limit=100`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBranchMembers(prev => ({ ...prev, [branchId]: result.data?.members || [] }));
      }
    } catch (error) {
      console.error(`Error loading members for branch ${branchId}:`, error);
    }
  };

  const toggleBranch = (branchId: string) => {
    setExpandedBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
        // Set default tab to staff
        if (!activeTab[branchId]) {
          setActiveTab(prev => ({ ...prev, [branchId]: 'staff' }));
        }
      }
      return newSet;
    });
  };

  const setTab = (branchId: string, tab: 'staff' | 'members') => {
    setActiveTab(prev => ({ ...prev, [branchId]: tab }));
  };

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
        
        <div className={styles.headerInfo}>
          <div className={styles.avatar}>
            {manager.fullName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.headerText}>
            <h1>{manager.fullName}</h1>
            <p className={styles.email}>{manager.email}</p>
            <span className={`${styles.statusBadge} ${manager.isActive ? styles.active : styles.inactive}`}>
              {manager.isActive ? 'Aktif' : 'Tidak Aktif'}
            </span>
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
        <h2>Branches yang Dikelola</h2>
        
        {manager.branches.length === 0 ? (
          <div className={styles.emptyState}>
            <Building2 size={48} />
            <p>Belum ada branch yang di-assign</p>
          </div>
        ) : (
          <div className={styles.branchesList}>
            {manager.branches.map((branch) => {
              const isExpanded = expandedBranches.has(branch.id);
              const currentTab = activeTab[branch.id] || 'staff';
              const staff = branchStaff[branch.id] || [];
              const members = branchMembers[branch.id] || [];

              return (
                <div key={branch.id} className={styles.branchCard}>
                  {/* Branch Header */}
                  <div 
                    className={styles.branchHeader}
                    onClick={() => toggleBranch(branch.id)}
                  >
                    <div className={styles.branchInfo}>
                      <div className={styles.branchIcon}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3>{branch.name}</h3>
                        <p className={styles.branchMeta}>
                          <span className={styles.branchCode}>{branch.branchCode}</span>
                          <span className={styles.separator}>•</span>
                          <span>{branch.city}</span>
                          <span className={styles.separator}>•</span>
                          <span>{branch.type}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className={styles.branchStats}>
                      <span className={styles.statBadge}>
                        <UserCog size={14} />
                        {staff.length} Staff
                      </span>
                      <span className={styles.statBadge}>
                        <Users size={14} />
                        {members.length} Members
                      </span>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
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
                                    <tr key={m.id}>
                                      <td>
                                        <span className={styles.memberCode}>{m.memberCode}</span>
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
                                          onClick={() => router.push(`/members/${m.id}`)}
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
    </div>
  );
}
