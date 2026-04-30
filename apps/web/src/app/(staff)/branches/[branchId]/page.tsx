'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { branchesApi } from '@/lib/api/branchesApi';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { hasRole, MANAGER_ABOVE_ROLES } from '@/types/auth';
import { 
  Building2, ArrowLeft, Edit, Trash2, Users, 
  Package, UserCog, MapPin, Phone, Activity, Plus
} from 'lucide-react';
import styles from '@/styles/branch-detail.module.css';

// Import CRUD Modals
import MemberCrudModal from '@/components/branches/MemberCrudModal';
import StaffCrudModal from '@/components/branches/StaffCrudModal';
import InventoryCrudModal from '@/components/branches/InventoryCrudModal';

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  type: string;
  address: string;
  city: string;
  phone: string;
  operatingHours?: string;
  isActive: boolean;
  stats?: {
    activeUsers: number;
    totalMembers: number;
    activePackages: number;
  };
}

interface Member {
  memberId: string;
  memberNo: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  isActive: boolean;
  registrationBranch: string;
  voucherCount: number;
  basicPackageCount: number;
  isLintas: boolean;
  photoUrl?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  stock: number;
  usageStock: number;
  stockDisplay: string;
  minThreshold: number;
  minThresholdUsage: number;
  thresholdDisplay: string;
  isLowStock: boolean;
  storageLocation?: string;
}

interface Staff {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  isActive: boolean;
  profile: {
    fullName: string;
    phone: string;
  };
  branch?: {
    name: string;
    branchCode: string;
  };
}

type TabType = 'overview' | 'members' | 'inventory' | 'staff';

type CrudModalType = 'member' | 'staff' | 'inventory' | null;
type CrudAction = 'create' | 'edit' | 'delete';

export default function BranchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const branchId = params.branchId as string;
  const { user } = useAuthStore();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Tab data
  const [members, setMembers] = useState<Member[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // CRUD Modal states
  const [crudModal, setCrudModal] = useState<{
    type: CrudModalType;
    action: CrudAction;
    data?: any;
  }>({ type: null, action: 'create' });

  // Check authorization
  useEffect(() => {
    if (!user || !hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      console.log('🔍 [BranchDetail] Current user:', user);
      console.log('🔍 [BranchDetail] User role:', user?.role);
      console.log('🔍 [BranchDetail] Required roles:', MANAGER_ABOVE_ROLES);
      console.log('🔍 [BranchDetail] Has access:', user ? hasRole(user.role, MANAGER_ABOVE_ROLES) : false);
      showToast.error('Anda tidak memiliki akses ke halaman ini');
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (user && hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      loadBranch();
    }
  }, [branchId, user]);

  useEffect(() => {
    if (branch) {
      loadTabData();
    }
  }, [activeTab, branch]);

  const loadBranch = async () => {
    try {
      setLoading(true);
      const response = await branchesApi.getBranch(branchId);
      setBranch(response.data.data);
    } catch (error: any) {
      console.error('Error loading branch:', error);
      showToast.error('Gagal memuat data cabang');
      router.push('/branches');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (activeTab === 'overview') return;

    try {
      setTabLoading(true);
      console.log(`🔍 [BranchDetail] Loading ${activeTab} data for branch:`, branchId);

      if (activeTab === 'members') {
        console.log('🔍 [BranchDetail] Starting members API call...');
        const response = await branchesApi.getBranchMembers(branchId, { page: 1, limit: 100 });
        console.log('🔍 [BranchDetail] Members response full:', JSON.stringify(response, null, 2));
        console.log('🔍 [BranchDetail] Members response.data:', response.data);
        console.log('🔍 [BranchDetail] Members response.data.data:', response.data.data);
        
        const membersResult = response.data.data; // { members: [...], pagination: {...} }
        console.log('🔍 [BranchDetail] Members result:', membersResult);
        
        const membersData = membersResult?.members || [];
        console.log('🔍 [BranchDetail] Members data final:', membersData, 'length:', membersData.length, 'isArray:', Array.isArray(membersData));
        
        setMembers(Array.isArray(membersData) ? membersData : []);
        console.log('🔍 [BranchDetail] Members state set, length:', membersData.length);
      } else if (activeTab === 'inventory') {
        const response = await inventoryApi.getInventoryItems(branchId, {});
        console.log('🔍 [BranchDetail] Inventory response:', response.data);
        const inventoryData = response.data.data;
        console.log('🔍 [BranchDetail] Inventory data:', inventoryData, 'isArray:', Array.isArray(inventoryData));
        setInventory(Array.isArray(inventoryData) ? inventoryData : []);
      } else if (activeTab === 'staff') {
        const response = await branchesApi.getBranchStaff(branchId, { page: 1, limit: 100 });
        console.log('🔍 [BranchDetail] Staff response:', response.data);
        const staffResult = response.data.data; // { users: [...], total: ..., page: ..., limit: ... }
        const staffData = staffResult?.users || staffResult || [];
        console.log('🔍 [BranchDetail] Staff data:', staffData, 'isArray:', Array.isArray(staffData));
        setStaff(Array.isArray(staffData) ? staffData : []);
      }
    } catch (error: any) {
      console.error(`❌ [BranchDetail] Error loading ${activeTab} data:`, error);
      if (error.response) {
        console.error('❌ [BranchDetail] Error response:', error.response.data);
        console.error('❌ [BranchDetail] Error status:', error.response.status);
      }
      showToast.error(`Gagal memuat data ${activeTab}`);
      
      // Reset to empty arrays on error
      if (activeTab === 'members') setMembers([]);
      else if (activeTab === 'inventory') setInventory([]);
      else if (activeTab === 'staff') setStaff([]);
    } finally {
      setTabLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;
    
    if (!confirm(`Apakah Anda yakin ingin menghapus cabang "${branch.name}"?`)) {
      return;
    }

    try {
      await branchesApi.deleteBranch(branchId);
      showToast.success('Cabang berhasil dihapus');
      router.push('/branches');
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    }
  };

  const getBranchTypeColor = (type: string) => {
    switch (type) {
      case 'PUSAT': return '#f59e0b';
      case 'PREMIERE': return '#eab308';
      case 'PARTNERSHIP': return '#3b82f6';
      case 'KLINIK': return '#10b981';
      case 'HOMECARE': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  // CRUD Modal handlers
  const openCrudModal = (type: CrudModalType, action: CrudAction, data?: any) => {
    setCrudModal({ type, action, data });
  };

  const closeCrudModal = () => {
    setCrudModal({ type: null, action: 'create' });
  };

  const handleCrudSuccess = () => {
    closeCrudModal();
    loadTabData(); // Refresh current tab data
    if (branch) {
      loadBranch(); // Refresh branch stats
    }
  };

  const handleDeleteItem = async (type: 'member' | 'staff' | 'inventory', id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${name}?`)) {
      return;
    }

    console.log('🔍 [BranchDetail] Delete attempt:', { type, id, name });
    console.log('🔍 [BranchDetail] Current user:', user);

    try {
      // Handle delete based on type
      if (type === 'member') {
        console.log('🔍 [BranchDetail] Calling DELETE /members/' + id);
        await api.delete(`/members/${id}`);
        showToast.success('Member berhasil dihapus');
      } else if (type === 'staff') {
        console.log('🔍 [BranchDetail] Calling DELETE /users/' + id);
        await api.delete(`/users/${id}`);
        showToast.success('Staff berhasil dihapus');
      } else if (type === 'inventory') {
        console.log('🔍 [BranchDetail] Calling DELETE /inventory/items/' + id);
        await api.delete(`/inventory/items/${id}`);
        showToast.success('Item inventori berhasil dihapus');
      }
      
      handleCrudSuccess();
    } catch (error: any) {
      console.error(`❌ [BranchDetail] Error deleting ${type}:`, error);
      console.error('❌ [BranchDetail] Error response:', error.response?.data);
      console.error('❌ [BranchDetail] Error status:', error.response?.status);
      showToast.error(error.response?.data?.message || `Gagal menghapus ${type}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Memuat data cabang...</p>
      </div>
    );
  }

  if (!branch) return null;

  return (
    <div className={styles.branchDetailPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <button className={styles.backButton} onClick={() => router.push('/branches')}>
          <ArrowLeft size={20} />
        </button>
        
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.branchInfo}>
              <div className={styles.branchIcon}>
                <Building2 size={24} />
              </div>
              <div className={styles.branchDetails}>
                <div className={styles.branchMeta}>
                  <span className={styles.branchCode}>{branch.branchCode}</span>
                  <span 
                    className={styles.typeBadge}
                    style={{ 
                      background: `${getBranchTypeColor(branch.type)}20`,
                      color: getBranchTypeColor(branch.type),
                      borderColor: `${getBranchTypeColor(branch.type)}40`
                    }}
                  >
                    {branch.type}
                  </span>
                  <span className={`${styles.statusBadge} ${branch.isActive ? styles.active : styles.inactive}`}>
                    {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
                <h1>{branch.name}</h1>
                <div className={styles.branchLocation}>
                  <MapPin size={16} />
                  <span>{branch.city}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            <button 
              className={`${styles.actionButton} ${styles.edit}`}
              onClick={() => router.push(`/branches/${branchId}/edit`)}
            >
              <Edit size={18} />
              <span>Edit</span>
            </button>
            <button 
              className={`${styles.actionButton} ${styles.delete}`}
              onClick={handleDelete}
            >
              <Trash2 size={18} />
              <span>Hapus</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#3b82f615', color: '#3b82f6' }}>
            <Users size={20} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{branch.stats?.totalMembers || 0}</div>
            <div className={styles.statLabel}>Total Members</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#10b98115', color: '#10b981' }}>
            <UserCog size={20} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{branch.stats?.activeUsers || 0}</div>
            <div className={styles.statLabel}>Staff Aktif</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f59e0b15', color: '#f59e0b' }}>
            <Package size={20} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{branch.stats?.activePackages || 0}</div>
            <div className={styles.statLabel}>Paket Aktif</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabsNav}>
          <button
            className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={18} />
            <span>Overview</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'members' ? styles.active : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <Users size={18} />
            <span>Members</span>
            {branch.stats && (
              <span className="tab-badge">{branch.stats.totalMembers}</span>
            )}
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'inventory' ? styles.active : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={18} />
            <span>Stok</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'staff' ? styles.active : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <UserCog size={18} />
            <span>Staff</span>
            {branch.stats && (
              <span className="tab-badge">{branch.stats.activeUsers}</span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewGrid}>
              <div className={styles.infoSection}>
                <h3>
                  <MapPin size={18} />
                  Informasi Lokasi
                </h3>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Alamat</span>
                  <span className={styles.infoValue}>{branch.address}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Kota</span>
                  <span className={styles.infoValue}>{branch.city}</span>
                </div>
              </div>

              <div className={styles.infoSection}>
                <h3>
                  <Phone size={18} />
                  Kontak & Operasional
                </h3>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Telepon</span>
                  <span className={styles.infoValue}>{branch.phone}</span>
                </div>
                {branch.operatingHours && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Jam Operasional</span>
                    <span className={styles.infoValue}>{branch.operatingHours}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              <div className={styles.tabHeader}>
                <h2>Members</h2>
                <button 
                  className={styles.addButton}
                  onClick={() => openCrudModal('member', 'create')}
                >
                  <Plus size={18} />
                  <span>Tambah Member</span>
                </button>
              </div>

              {tabLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner} />
                  <p>Memuat data members...</p>
                </div>
              ) : !Array.isArray(members) || members.length === 0 ? (
                <div className={styles.emptyState}>
                  <Users size={48} />
                  <h3>Belum Ada Member</h3>
                  <p>Cabang ini belum memiliki member terdaftar.</p>
                  <button 
                    className={styles.emptyStateButton}
                    onClick={() => openCrudModal('member', 'create')}
                  >
                    <Plus size={18} />
                    <span>Tambah Member Pertama</span>
                  </button>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>No. Member</th>
                      <th>Nama Lengkap</th>
                      <th>Email</th>
                      <th>Telepon</th>
                      <th>Tanggal Daftar</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.memberId}>
                        <td>
                          <div className={styles.memberCell}>
                            <div className={styles.memberAvatar}>
                              {member.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.memberInfo}>
                              <div className={styles.memberCode}>{member.memberNo}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.memberName}>{member.fullName}</div>
                        </td>
                        <td>
                          <div className={styles.memberEmail}>{member.email}</div>
                        </td>
                        <td>{member.phone}</td>
                        <td>{new Date(member.createdAt).toLocaleDateString('id-ID')}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${member.isActive ? styles.active : styles.inactive}`}>
                            {member.isActive ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button 
                              className={`${styles.actionBtn} ${styles.edit}`}
                              onClick={() => openCrudModal('member', 'edit', member)}
                              title="Edit Member"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className={`${styles.actionBtn} ${styles.delete}`}
                              onClick={() => handleDeleteItem('member', member.memberId, member.fullName)}
                              title="Hapus Member"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <div className={styles.tabHeader}>
                <h2>Inventori</h2>
                <button 
                  className={styles.addButton}
                  onClick={() => openCrudModal('inventory', 'create')}
                >
                  <Plus size={18} />
                  <span>Tambah Item</span>
                </button>
              </div>

              {tabLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner} />
                  <p>Memuat data stok...</p>
                </div>
              ) : !Array.isArray(inventory) || inventory.length === 0 ? (
                <div className={styles.emptyState}>
                  <Package size={48} />
                  <h3>Belum Ada Stok</h3>
                  <p>Cabang ini belum memiliki data inventori.</p>
                  <button 
                    className={styles.emptyStateButton}
                    onClick={() => openCrudModal('inventory', 'create')}
                  >
                    <Plus size={18} />
                    <span>Tambah Item Pertama</span>
                  </button>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Nama Item</th>
                      <th>Kategori</th>
                      <th>Stok Saat Ini</th>
                      <th>Min. Stok</th>
                      <th>Lokasi</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className={styles.inventoryItem}>
                            <div className={styles.inventoryIcon}>
                              <Package size={16} />
                            </div>
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td>{item.category}</td>
                        <td>
                          <div className={styles.stockInfo}>
                            <span className={styles.stockValue}>{item.stockDisplay}</span>
                          </div>
                        </td>
                        <td>{item.thresholdDisplay}</td>
                        <td>{item.storageLocation || '-'}</td>
                        <td>
                          {item.isLowStock && (
                            <span className={styles.lowStockBadge}>Stok Rendah</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button 
                              className={`${styles.actionBtn} ${styles.edit}`}
                              onClick={() => openCrudModal('inventory', 'edit', item)}
                              title="Edit Item"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className={`${styles.actionBtn} ${styles.delete}`}
                              onClick={() => handleDeleteItem('inventory', item.id, item.name)}
                              title="Hapus Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div>
              <div className={styles.tabHeader}>
                <h2>Staff</h2>
                <button 
                  className={styles.addButton}
                  onClick={() => openCrudModal('staff', 'create')}
                >
                  <Plus size={18} />
                  <span>Tambah Staff</span>
                </button>
              </div>

              {tabLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner} />
                  <p>Memuat data staff...</p>
                </div>
              ) : !Array.isArray(staff) || staff.length === 0 ? (
                <div className={styles.emptyState}>
                  <UserCog size={48} />
                  <h3>Belum Ada Staff</h3>
                  <p>Cabang ini belum memiliki staff terdaftar.</p>
                  <button 
                    className={styles.emptyStateButton}
                    onClick={() => openCrudModal('staff', 'create')}
                  >
                    <Plus size={18} />
                    <span>Tambah Staff Pertama</span>
                  </button>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Staff Code</th>
                      <th>Nama Lengkap</th>
                      <th>Email</th>
                      <th>Telepon</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <div className={styles.staffAvatar}>
                              {user.profile?.fullName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className={styles.staffInfo}>
                              <div className={styles.staffCode}>{user.staffCode}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.staffName}>{user.profile?.fullName || '-'}</div>
                          <div className={styles.staffRole}>{user.role}</div>
                        </td>
                        <td>{user.email}</td>
                        <td>{user.profile?.phone || '-'}</td>
                        <td>{user.role}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${user.isActive ? styles.active : styles.inactive}`}>
                            {user.isActive ? 'Aktif' : 'Tidak Aktif'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button 
                              className={`${styles.actionBtn} ${styles.edit}`}
                              onClick={() => openCrudModal('staff', 'edit', user)}
                              title="Edit Staff"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className={`${styles.actionBtn} ${styles.delete}`}
                              onClick={() => handleDeleteItem('staff', user.id, user.profile?.fullName || user.email)}
                              title="Hapus Staff"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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

      {/* CRUD Modals */}
      {crudModal.type === 'member' && (
        <MemberCrudModal
          isOpen={true}
          onClose={closeCrudModal}
          onSuccess={handleCrudSuccess}
          action={crudModal.action}
          branchId={branchId}
          memberData={crudModal.data}
        />
      )}

      {crudModal.type === 'staff' && (
        <StaffCrudModal
          isOpen={true}
          onClose={closeCrudModal}
          onSuccess={handleCrudSuccess}
          action={crudModal.action}
          branchId={branchId}
          staffData={crudModal.data}
        />
      )}

      {crudModal.type === 'inventory' && (
        <InventoryCrudModal
          isOpen={true}
          onClose={closeCrudModal}
          onSuccess={handleCrudSuccess}
          action={crudModal.action}
          branchId={branchId}
          inventoryData={crudModal.data}
        />
      )}

    </div>
  );
}
