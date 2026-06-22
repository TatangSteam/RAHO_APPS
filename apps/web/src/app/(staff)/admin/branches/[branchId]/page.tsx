'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import CreateStaffModal from '@/components/staff/CreateStaffModal';
import BranchHeader from './BranchHeader';
import StatsCards from './StatsCards';
import TabNavigation from './TabNavigation';
import OverviewTab from './OverviewTab';
import UsersTab from './UsersTab';
import MembersTab from './MembersTab';
import StockTab from './StockTab';
import { useBranchData } from './useBranchData';
import styles from './page.module.css';

type BranchTab = 'overview' | 'users' | 'members' | 'stock';

export default function BranchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const branchId = params.branchId as string;
  const { user, accessToken } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<BranchTab>('overview');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    branch,
    users,
    members,
    inventory,
    loading,
    loadBranchDetail,
    loadBranchUsers,
    loadBranchMembers,
    loadBranchInventory,
    toggleUserActive,
  } = useBranchData(branchId, accessToken || '');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (!['ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      showToast.error('Akses ditolak');
      router.push('/dashboard');
      return;
    }

    loadBranchDetail();
    loadBranchUsers();
    loadBranchMembers();
    loadBranchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken, branchId]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat detail cabang...</p>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>❌ Cabang tidak ditemukan</h2>
          <button onClick={() => router.push('/admin/branches')} className={styles.backBtn}>
            ← Kembali ke Daftar Cabang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <BranchHeader
        branch={branch}
        onBack={() => router.push('/admin/branches')}
      />

      {/* Stats Cards */}
      <StatsCards branch={branch} />

      {/* Tabs */}
      <TabNavigation
        activeTab={activeTab}
        usersCount={users.length}
        membersCount={members.length}
        stockCount={inventory.length}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab branch={branch} />}
      
      {activeTab === 'users' && (
        <UsersTab
          users={users}
          onAddUser={() => setShowCreateUserModal(true)}
          onToggleUserActive={toggleUserActive}
        />
      )}
      
      {activeTab === 'members' && (
        <MembersTab
          members={members}
          branchName={branch.name}
          onAddMember={() => router.push('/members/new')}
          onViewMember={(memberId) => router.push(`/members/${memberId}`)}
        />
      )}

      {activeTab === 'stock' && (
        <StockTab
          inventory={inventory}
          branchName={branch.name}
        />
      )}

      {/* Create User Modal */}
      <CreateStaffModal
        show={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={() => {
          setShowCreateUserModal(false);
          loadBranchUsers();
          loadBranchDetail();
        }}
        accessToken={accessToken || ''}
        branchId={branchId}
        userRole={user?.role || ''}
      />
    </div>
  );
}
