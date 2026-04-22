import { useState, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import { BranchDetail, User, BranchMember } from './types';

export function useBranchData(branchId: string, accessToken: string) {
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBranchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/branches/${branchId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Gagal memuat detail cabang');

      const result = await response.json();
      setBranch(result.data);
    } catch (error: any) {
      console.error('Error loading branch detail:', error);
      showToast.error(error.message || 'Gagal memuat detail cabang');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [branchId, accessToken]);

  const loadBranchUsers = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users?branchId=${branchId}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Gagal memuat data user');

      const result = await response.json();
      setUsers(result.data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      showToast.error(error.message || 'Gagal memuat data user');
    }
  }, [branchId, accessToken]);

  const loadBranchMembers = useCallback(async () => {
    try {
      console.log('🔍 Loading members for branch:', branchId);
      const url = `${process.env.NEXT_PUBLIC_API_URL}/branches/${branchId}/members?limit=100`;
      console.log('📡 Fetching from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        throw new Error('Gagal memuat data member');
      }

      const result = await response.json();
      console.log('✅ Full response:', JSON.stringify(result, null, 2));
      
      const membersData = result.data?.members || [];
      console.log('👥 Members array:', membersData);
      console.log('📊 Members count:', membersData.length);
      
      if (membersData.length > 0) {
        console.log('📋 First member sample:', membersData[0]);
      }
      
      setMembers(membersData);
    } catch (error: any) {
      console.error('❌ Error loading members:', error);
      showToast.error(error.message || 'Gagal memuat data member');
    }
  }, [branchId, accessToken]);

  const toggleUserActive = useCallback(async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Gagal mengubah status user');

      showToast.success(`User berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      await loadBranchUsers();
      await loadBranchDetail();
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      showToast.error(error.message || 'Gagal mengubah status user');
    }
  }, [accessToken, loadBranchUsers, loadBranchDetail]);

  return {
    branch,
    users,
    members,
    loading,
    loadBranchDetail,
    loadBranchUsers,
    loadBranchMembers,
    toggleUserActive,
  };
}
