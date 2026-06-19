'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { branchesApi } from '@/lib/api/branchesApi';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { api } from '@/lib/api';
import { showToast, confirm } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { hasRole, MANAGER_ABOVE_ROLES } from '@/types/auth';
import { 
  Building2, ArrowLeft, Edit, Trash2, Users, 
  Package, UserCog, MapPin, Phone, Activity, Plus, Shield, Layers, DollarSign, Stethoscope
} from 'lucide-react';

// Import CRUD Modals
import MemberCrudModal from '@/components/branches/MemberCrudModal';
import StaffCrudModal from '@/components/branches/StaffCrudModal';
import InventoryCrudModal from '@/components/branches/InventoryCrudModal';
import InventoryBatchAddModal from '@/components/branches/InventoryBatchAddModal';
import AssignManagerModal from '@/components/branches/AssignManagerModal';
import AssignMedicalStaffModal from '@/components/branches/AssignMedicalStaffModal';
import ManageStaffBranchesModal from '@/components/branches/ManageStaffBranchesModal';
import StaffCredentialsModal from '@/components/branches/StaffCredentialsModal';
import MemberCredentialsModal from '@/components/members/MemberCredentialsModal';
import { devError } from '@/lib/logger';

import DeleteStaffModal from '@/components/branches/DeleteStaffModal';

// Import Tailwind Tables
import StaffTable from '@/components/branches/StaffTable';
import MembersTable from '@/components/branches/MembersTable';
import InventoryTable from '@/components/branches/InventoryTable';
import ManagersTable from '@/components/branches/ManagersTable';
import SessionsTable from '@/components/branches/SessionsTable';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

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
  masterProductId?: string;
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

interface Manager {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  assignedAt: string;
}

interface Session {
  id: string;
  sessionCode: string;
  date: string;
  status: string;
  member: {
    id: string;
    fullName: string;
    memberNo: string;
  };
  doctor: {
    fullName: string;
  };
  nurse: {
    fullName: string;
  };
  package: {
    name: string;
  };
}

type TabType = 'overview' | 'members' | 'inventory' | 'staff' | 'managers' | 'pricing' | 'sessions';
type CrudModalType = 'member' | 'staff' | 'inventory' | null;
type CrudAction = 'create' | 'edit' | 'delete';


// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatCard({ icon, value, label, color }: { 
  icon: React.ReactNode; 
  value: number; 
  label: string; 
  color: 'blue' | 'green' | 'amber' 
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-500',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  };

  return (
    <div className="flex items-center gap-4 p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-amber-500/30 transition-all duration-300 group shadow-sm dark:shadow-none">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-bold text-neutral-900 dark:text-white">{value}</div>
        <div className="text-sm text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-5 py-4 font-semibold text-sm transition-all duration-200 relative whitespace-nowrap
        ${active 
          ? 'text-amber-600 dark:text-amber-400' 
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full">
          {badge}
        </span>
      )}
      {active && (
        <div className="absolute bottom-0 left-5 right-5 h-0.5 bg-amber-500 rounded-full" />
      )}
    </button>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

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
  const [managers, setManagers] = useState<Manager[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Member filter state
  const [memberBranchFilter, setMemberBranchFilter] = useState<'all' | 'registered' | 'lintas'>('all');

  // Filtered members based on branch filter
  const filteredMembers = members.filter((member) => {
    if (memberBranchFilter === 'all') return true;
    if (memberBranchFilter === 'registered') {
      return member.registrationBranch === branch?.branchCode;
    }
    if (memberBranchFilter === 'lintas') {
      return member.isLintas || member.registrationBranch !== branch?.branchCode;
    }
    return true;
  });

  // CRUD Modal states
  const [crudModal, setCrudModal] = useState<{
    type: CrudModalType;
    action: CrudAction;
    data?: any;
  }>({ type: null, action: 'create' });

  const [showAssignManagerModal, setShowAssignManagerModal] = useState(false);
  const [showBatchAddModal, setShowBatchAddModal] = useState(false);
  const [showAssignMedicalStaffModal, setShowAssignMedicalStaffModal] = useState(false);
  const [staffListVersion, setStaffListVersion] = useState(0); // Track changes to trigger modal refresh
  const [manageStaffBranchesModal, setManageStaffBranchesModal] = useState<{
    isOpen: boolean;
    userId: string;
    staffName: string;
    staffRole: 'DOCTOR' | 'NURSE';
  }>({ isOpen: false, userId: '', staffName: '', staffRole: 'DOCTOR' });
  
  // Credentials Modal state (Super Admin only)
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    staffId: string;
    staffName: string;
  }>({ isOpen: false, staffId: '', staffName: '' });

  // Member Credentials Modal state (Super Admin only)
  const [memberCredentialsModal, setMemberCredentialsModal] = useState<{
    isOpen: boolean;
    memberId: string;
    memberName: string;
  }>({ isOpen: false, memberId: '', memberName: '' });

  // Delete Staff Modal state
  const [deleteStaffModal, setDeleteStaffModal] = useState<{
    isOpen: boolean;
    staff: Staff | null;
  }>({ isOpen: false, staff: null });


  // Check authorization
  useEffect(() => {
    if (!user || !hasRole(user.role, MANAGER_ABOVE_ROLES)) {
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
      devError('Error loading branch:', error);
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

      if (activeTab === 'members') {
        const response = await branchesApi.getBranchMembers(branchId, { page: 1, limit: 100 });
        const membersResult = response.data.data;
        const membersData = membersResult?.members || [];
        setMembers(Array.isArray(membersData) ? membersData : []);
      } else if (activeTab === 'inventory') {
        const response = await inventoryApi.getInventoryItems(branchId, {});
        const inventoryData = response.data.data;
        setInventory(Array.isArray(inventoryData) ? inventoryData : []);
      } else if (activeTab === 'staff') {
        const response = await branchesApi.getBranchStaff(branchId, { page: 1, limit: 100 });
        const staffResult = response.data.data;
        const staffData = staffResult?.users || staffResult || [];
        setStaff(Array.isArray(staffData) ? staffData : []);
      } else if (activeTab === 'managers') {
        const response = await branchesApi.getBranchManagers(branchId);
        const managersData = response.data.data?.managers || [];
        setManagers(Array.isArray(managersData) ? managersData : []);
      } else if (activeTab === 'sessions') {
        const response = await branchesApi.getBranchSessions(branchId, { page: 1, limit: 100 });
        const sessionsData = response.data.data?.sessions || [];
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      }
    } catch (error: any) {
      devError(`Error loading ${activeTab} data:`, error);
      showToast.error(`Gagal memuat data ${activeTab}`);
      if (activeTab === 'members') setMembers([]);
      else if (activeTab === 'inventory') setInventory([]);
      else if (activeTab === 'staff') setStaff([]);
      else if (activeTab === 'managers') setManagers([]);
      else if (activeTab === 'sessions') setSessions([]);
    } finally {
      setTabLoading(false);
    }
  };


  const handleDelete = async () => {
    if (!branch) return;
    const confirmed = await confirm.delete(branch.name);
    if (!confirmed) return;

    try {
      await branchesApi.deleteBranch(branchId);
      showToast.success('Cabang berhasil dihapus');
      router.push('/branches');
    } catch (error: any) {
      devError('Error deleting branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    }
  };

  const getBranchTypeStyles = (type: string) => {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      PUSAT: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
      PREMIER: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      PARTNERSHIP: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    };
    return styles[type] || { bg: 'bg-neutral-500/15', text: 'text-neutral-400', border: 'border-neutral-500/30' };
  };

  const openCrudModal = (type: CrudModalType, action: CrudAction, data?: any) => {
    setCrudModal({ type, action, data });
  };

  const closeCrudModal = () => {
    setCrudModal({ type: null, action: 'create' });
  };

  const handleCrudSuccess = () => {
    closeCrudModal();
    loadTabData();
    if (branch) loadBranch();
  };

  const handleDeleteItem = async (type: 'member' | 'staff' | 'inventory', id: string, name: string) => {
    const confirmed = await confirm.delete(name);
    if (!confirmed) return;

    try {
      if (type === 'member') {
        await api.delete(`/members/${id}`);
        showToast.success('Member berhasil dihapus');
      } else if (type === 'staff') {
        await api.delete(`/users/${id}`);
        showToast.success('Staff berhasil dihapus');
      } else if (type === 'inventory') {
        await api.delete(`/inventory/items/${id}`);
        showToast.success('Item inventori berhasil dihapus');
      }
      handleCrudSuccess();
    } catch (error: any) {
      devError(`Error deleting ${type}:`, error);
      showToast.error(error.response?.data?.message || `Gagal menghapus ${type}`);
    }
  };

  // Handle unassign staff from branch
  const handleUnassignFromBranch = async (staffUser: Staff) => {
    // Only DOCTOR and NURSE can be unassigned from branches
    if (staffUser.role !== 'DOCTOR' && staffUser.role !== 'NURSE') {
      showToast.error('Hanya DOCTOR dan NURSE yang dapat di-unassign dari cabang');
      return;
    }

    const confirmed = await confirm.warning(
      'Unassign Staff dari Cabang',
      `Apakah Anda yakin ingin meng-unassign ${staffUser.profile?.fullName || staffUser.email} dari cabang ini?`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/users/${staffUser.id}/branches/${branchId}`);
      showToast.success('Staff berhasil di-unassign dari cabang');
      
      // Increment staff list version to force modal refresh
      setStaffListVersion(prev => prev + 1);
      
      // Reload staff list
      loadTabData();
      if (branch) loadBranch();
    } catch (error: any) {
      devError('Error unassigning staff from branch:', error);
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal unassign staff dari cabang';
      showToast.error(errorMessage);
    }
  };

  // Handle delete staff (soft delete)
  const handleDeleteStaff = async (staffUser: Staff) => {
    setDeleteStaffModal({
      isOpen: true,
      staff: staffUser,
    });
  };

  const confirmDeleteStaff = async () => {
    if (!deleteStaffModal.staff) return;

    try {
      const response = await api.delete(`/users/${deleteStaffModal.staff.id}`);
      const result = response.data.data;
      
      if (result.hasHistoricalData) {
        showToast.success(
          `${deleteStaffModal.staff.profile?.fullName} berhasil dihapus. Riwayat ${result.historicalSessions} sesi terapi tetap tersimpan.`
        );
      } else {
        showToast.success(`${deleteStaffModal.staff.profile?.fullName} berhasil dihapus.`);
      }

      // Increment staff list version to force modal refresh
      setStaffListVersion(prev => prev + 1);
      
      // Close modal and reload data
      setDeleteStaffModal({ isOpen: false, staff: null });
      loadTabData();
      if (branch) loadBranch();
    } catch (error: any) {
      devError('Error deleting staff:', error);
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal menghapus staff';
      showToast.error(errorMessage);
    }
  };


  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neutral-300 dark:border-neutral-700 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400">Memuat data cabang...</p>
        </div>
      </div>
    );
  }

  if (!branch) return null;

  const typeStyles = getBranchTypeStyles(branch.type);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HEADER SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-sm dark:shadow-none">
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
          
          {/* Back button */}
          <button 
            onClick={() => router.push('/branches')}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800/50 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-all duration-200"
          >
            <ArrowLeft size={18} />
            <span className="font-medium">Kembali</span>
          </button>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Branch Info */}
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Building2 size={28} className="text-white" />
              </div>
              
              <div>
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg font-mono tracking-wider">
                    {branch.branchCode}
                  </span>
                  <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}>
                    {branch.type === 'PUSAT' ? 'Pusat' : branch.type === 'PREMIER' ? 'Premier' : 'Partnership'}
                  </span>
                  <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                    branch.isActive 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                      : 'bg-neutral-500/15 text-neutral-500 dark:text-neutral-400 border-neutral-500/30'
                  }`}>
                    {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
                
                {/* Branch name */}
                <h1 className="text-2xl lg:text-3xl font-bold text-neutral-900 dark:text-white mb-2">{branch.name}</h1>
                
                {/* Location */}
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <MapPin size={16} />
                  <span>{branch.city}</span>
                </div>
              </div>
            </div>


            {/* Action buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => router.push(`/branches/${branchId}/edit`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/50 transition-all duration-200"
              >
                <Edit size={18} />
                <span>Edit</span>
              </button>
              <button 
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-700 dark:text-neutral-200 hover:text-red-600 dark:hover:text-red-400 font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-red-500/50 transition-all duration-200"
              >
                <Trash2 size={18} />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STATS GRID */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            icon={<Users size={24} />} 
            value={branch.stats?.totalMembers || 0} 
            label="Total Members" 
            color="blue" 
          />
          <StatCard 
            icon={<UserCog size={24} />} 
            value={branch.stats?.activeUsers || 0} 
            label="Staff Aktif" 
            color="green" 
          />
          <StatCard 
            icon={<Package size={24} />} 
            value={branch.stats?.activePackages || 0} 
            label="Paket Aktif" 
            color="amber" 
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TABS SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
          {/* Tab Navigation */}
          <div className="flex overflow-x-auto bg-neutral-50 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={18} />} label="Overview" />
            <TabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={<Users size={18} />} label="Members" badge={branch.stats?.totalMembers} />
            <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} icon={<Stethoscope size={18} />} label="Sesi Terapi" />
            <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={18} />} label="Stok" />
            <TabButton active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<UserCog size={18} />} label="Staff" badge={branch.stats?.activeUsers} />
            <TabButton active={activeTab === 'managers'} onClick={() => setActiveTab('managers')} icon={<Shield size={18} />} label="Managers" />
            {user?.role === 'SUPER_ADMIN' && (
              <TabButton active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')} icon={<DollarSign size={18} />} label="Harga Paket" />
            )}
          </div>


          {/* Tab Content */}
          <div className="p-6 lg:p-8">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Location Info */}
                <div className="bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50 rounded-xl p-6">
                  <h3 className="flex items-center gap-3 text-lg font-semibold text-neutral-900 dark:text-white mb-5">
                    <MapPin size={20} className="text-amber-500" />
                    Informasi Lokasi
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-neutral-200 dark:border-neutral-700/50">
                      <span className="text-neutral-500 dark:text-neutral-400">Alamat</span>
                      <span className="text-neutral-900 dark:text-white font-medium text-right max-w-[60%]">{branch.address}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-neutral-500 dark:text-neutral-400">Kota</span>
                      <span className="text-neutral-900 dark:text-white font-medium">{branch.city}</span>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50 rounded-xl p-6">
                  <h3 className="flex items-center gap-3 text-lg font-semibold text-neutral-900 dark:text-white mb-5">
                    <Phone size={20} className="text-amber-500" />
                    Kontak & Operasional
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-neutral-200 dark:border-neutral-700/50">
                      <span className="text-neutral-500 dark:text-neutral-400">Telepon</span>
                      <span className="text-neutral-900 dark:text-white font-medium">{branch.phone}</span>
                    </div>
                    {branch.operatingHours && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-neutral-500 dark:text-neutral-400">Jam Operasional</span>
                        <span className="text-neutral-900 dark:text-white font-medium">{branch.operatingHours}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


            {/* Members Tab */}
            {activeTab === 'members' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700/50">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Members</h2>
                  <div className="flex flex-wrap gap-3 items-center">
                    <select 
                      value={memberBranchFilter}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'all' || value === 'registered' || value === 'lintas') {
                          setMemberBranchFilter(value);
                        }
                      }}
                      className="px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                    >
                      <option value="all">Semua Cabang</option>
                      <option value="registered">Terdaftar di Cabang Ini</option>
                      <option value="lintas">Member Lintas Cabang</option>
                    </select>
                    <button 
                      onClick={() => openCrudModal('member', 'create')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors shadow-lg shadow-amber-500/20"
                    >
                      <Plus size={18} />
                      <span>Tambah Member</span>
                    </button>
                  </div>
                </div>

                {filteredMembers.length > 0 && (
                  <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm text-neutral-600 dark:text-neutral-400">
                    Menampilkan <strong className="text-blue-600 dark:text-blue-400">{filteredMembers.length}</strong> dari <strong className="text-blue-600 dark:text-blue-400">{members.length}</strong> member
                    {memberBranchFilter === 'registered' && ' yang terdaftar di cabang ini'}
                    {memberBranchFilter === 'lintas' && ' lintas cabang'}
                  </div>
                )}

                <MembersTable
                  data={filteredMembers}
                  loading={tabLoading}
                  currentBranchCode={branch?.branchCode}
                  showCredentialsButton={user?.role === 'SUPER_ADMIN'}
                  onEdit={(member) => openCrudModal('member', 'edit', member)}
                  onDelete={(member) => handleDeleteItem('member', member.memberId, member.fullName)}
                  onAddMember={() => openCrudModal('member', 'create')}
                  onManageCredentials={(member) => setMemberCredentialsModal({
                    isOpen: true,
                    memberId: member.memberId,
                    memberName: member.fullName,
                  })}
                />
              </div>
            )}


            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700/50">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Inventori</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowBatchAddModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 transition-colors"
                    >
                      <Layers size={18} />
                      <span>Tambah Batch</span>
                    </button>
                    <button 
                      onClick={() => openCrudModal('inventory', 'create')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors shadow-lg shadow-amber-500/20"
                    >
                      <Plus size={18} />
                      <span>Tambah Item</span>
                    </button>
                  </div>
                </div>

                <InventoryTable
                  data={inventory}
                  loading={tabLoading}
                  onEdit={(item) => openCrudModal('inventory', 'edit', item)}
                  onDelete={(item) => handleDeleteItem('inventory', item.id, item.name)}
                  onAddItem={() => openCrudModal('inventory', 'create')}
                />
              </div>
            )}

            {/* Staff Tab */}
            {activeTab === 'staff' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700/50">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Staff</h2>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowAssignMedicalStaffModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-500/15 hover:bg-purple-100 dark:hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 font-medium rounded-lg border border-purple-200 dark:border-purple-500/30 transition-colors"
                    >
                      <Stethoscope size={18} />
                      <span>Assign Dokter/Nakes</span>
                    </button>
                    <button 
                      onClick={() => openCrudModal('staff', 'create')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors shadow-lg shadow-amber-500/20"
                    >
                      <Plus size={18} />
                      <span>Tambah Staff</span>
                    </button>
                  </div>
                </div>

                <StaffTable
                  data={staff}
                  loading={tabLoading}
                  showCredentialsButton={user?.role === 'SUPER_ADMIN'}
                  onEdit={(staffUser) => openCrudModal('staff', 'edit', staffUser)}
                  onUnassignFromBranch={handleUnassignFromBranch}
                  onDeleteStaff={handleDeleteStaff}
                  onManageBranches={(staffUser) => setManageStaffBranchesModal({
                    isOpen: true,
                    userId: staffUser.id,
                    staffName: staffUser.profile?.fullName || staffUser.email,
                    staffRole: staffUser.role as 'DOCTOR' | 'NURSE',
                  })}
                  onManageCredentials={(staffUser) => setCredentialsModal({
                    isOpen: true,
                    staffId: staffUser.id,
                    staffName: staffUser.profile?.fullName || staffUser.email,
                  })}
                  onAddStaff={() => openCrudModal('staff', 'create')}
                />
              </div>
            )}


            {/* Managers Tab */}
            {activeTab === 'managers' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700/50">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Admin Managers</h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Daftar Admin Manager yang di-assign ke cabang ini</p>
                  </div>
                  {user?.role === 'SUPER_ADMIN' && (
                    <button 
                      onClick={() => setShowAssignManagerModal(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-purple-500/20"
                    >
                      <Plus size={18} />
                      <span>Tambah Manager</span>
                    </button>
                  )}
                </div>

                <ManagersTable
                  data={managers}
                  loading={tabLoading}
                  canManage={user?.role === 'SUPER_ADMIN'}
                  onUnassign={async (manager) => {
                    const confirmed = await confirm.warning(
                      'Hapus Manager dari Cabang',
                      `Apakah Anda yakin ingin menghapus ${manager.fullName} dari cabang ini?`
                    );
                    if (!confirmed) return;
                    try {
                      await branchesApi.unassignManager(branchId, manager.id);
                      showToast.success('Admin Manager berhasil di-unassign');
                      loadTabData();
                    } catch (error: any) {
                      showToast.error(error.response?.data?.message || 'Gagal unassign Admin Manager');
                    }
                  }}
                  onAssignManager={() => setShowAssignManagerModal(true)}
                />
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700/50">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Sesi Terapi</h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
                      Daftar sesi terapi yang dilakukan di {branch.name}
                    </p>
                  </div>
                  <button 
                    onClick={() => router.push('/sessions')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    <Plus size={18} />
                    <span>Buat Sesi Baru</span>
                  </button>
                </div>

                <SessionsTable
                  data={sessions}
                  loading={tabLoading}
                />
              </div>
            )}

            {/* Pricing Tab */}
            {activeTab === 'pricing' && user?.role === 'SUPER_ADMIN' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700/50">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Harga Paket Cabang</h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Kelola harga paket khusus untuk cabang {branch.name}</p>
                  </div>
                  <button 
                    onClick={() => router.push(`/admin/package-pricing?branchId=${branchId}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors shadow-lg shadow-amber-500/20"
                  >
                    <DollarSign size={18} />
                    <span>Kelola Harga Paket</span>
                  </button>
                </div>

                <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50 rounded-xl">
                  <DollarSign size={56} className="mx-auto mb-4 text-amber-500" />
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Pengaturan Harga Paket</h3>
                  <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
                    Klik tombol di atas untuk mengelola harga paket khusus cabang ini. 
                    Anda dapat mengatur harga paket BASIC dan BOOSTER yang berbeda dari harga global.
                  </p>
                  <button 
                    onClick={() => router.push(`/admin/package-pricing?branchId=${branchId}`)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
                  >
                    <DollarSign size={18} />
                    <span>Buka Halaman Harga Paket</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      
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
          callerRole={user?.role}
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
          existingProductIds={inventory.map(item => item.masterProductId || '')}
        />
      )}

      {showAssignManagerModal && branch && (
        <AssignManagerModal
          isOpen={showAssignManagerModal}
          onClose={() => setShowAssignManagerModal(false)}
          onSuccess={() => {
            setShowAssignManagerModal(false);
            loadTabData();
          }}
          branchId={branchId}
          branchName={branch.name}
        />
      )}

      {showBatchAddModal && (
        <InventoryBatchAddModal
          isOpen={showBatchAddModal}
          onClose={() => setShowBatchAddModal(false)}
          onSuccess={() => {
            setShowBatchAddModal(false);
            loadTabData();
          }}
          branchId={branchId}
          existingProductIds={inventory.map(item => item.masterProductId || '')}
        />
      )}

      {showAssignMedicalStaffModal && branch && (
        <AssignMedicalStaffModal
          key={`assign-staff-${staffListVersion}`} // Force remount when staff list changes
          isOpen={showAssignMedicalStaffModal}
          onClose={() => setShowAssignMedicalStaffModal(false)}
          onSuccess={() => {
            setShowAssignMedicalStaffModal(false);
            loadTabData(); // Reload staff list
            loadBranch(); // Reload branch stats (updates badge counter)
            setStaffListVersion(prev => prev + 1); // Increment version after successful assign
          }}
          branchId={branchId}
          branchName={branch.name}
        />
      )}

      {manageStaffBranchesModal.isOpen && (
        <ManageStaffBranchesModal
          isOpen={manageStaffBranchesModal.isOpen}
          onClose={() => setManageStaffBranchesModal({ isOpen: false, userId: '', staffName: '', staffRole: 'DOCTOR' })}
          onSuccess={() => {
            loadTabData();
            setStaffListVersion(prev => prev + 1); // Increment version to trigger AssignMedicalStaffModal refresh
          }}
          userId={manageStaffBranchesModal.userId}
          staffName={manageStaffBranchesModal.staffName}
          staffRole={manageStaffBranchesModal.staffRole}
        />
      )}

      {/* Staff Credentials Modal (Super Admin Only) */}
      {credentialsModal.isOpen && (
        <StaffCredentialsModal
          isOpen={credentialsModal.isOpen}
          onClose={() => setCredentialsModal({ isOpen: false, staffId: '', staffName: '' })}
          staffId={credentialsModal.staffId}
          staffName={credentialsModal.staffName}
          onSuccess={() => loadTabData()}
        />
      )}

      {/* Member Credentials Modal (Super Admin Only) */}
      {memberCredentialsModal.isOpen && (
        <MemberCredentialsModal
          isOpen={memberCredentialsModal.isOpen}
          onClose={() => setMemberCredentialsModal({ isOpen: false, memberId: '', memberName: '' })}
          memberId={memberCredentialsModal.memberId}
          memberName={memberCredentialsModal.memberName}
          onSuccess={() => loadTabData()}
        />
      )}

      {/* Delete Staff Modal */}
      {deleteStaffModal.isOpen && deleteStaffModal.staff && (
        <DeleteStaffModal
          isOpen={deleteStaffModal.isOpen}
          onClose={() => setDeleteStaffModal({ isOpen: false, staff: null })}
          onConfirm={confirmDeleteStaff}
          staff={{
            id: deleteStaffModal.staff.id,
            fullName: deleteStaffModal.staff.profile?.fullName || deleteStaffModal.staff.email,
            role: deleteStaffModal.staff.role,
            email: deleteStaffModal.staff.email,
          }}
        />
      )}
    </div>
  );
}
