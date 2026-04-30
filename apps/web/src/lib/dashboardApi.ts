import { api } from './api';

export interface DashboardStats {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    totalRevenue: number;
    transactionCount: number;
    averageTransaction: number;
    revenueGrowth: number;
    revenueByDay: Array<{
      date: string;
      amount: number;
    }>;
  };
  packages: {
    packagesSold: number;
    activePackages: number;
    pendingPayment: number;
    byType: Array<{
      type: string;
      count: number;
    }>;
  };
  members: {
    totalMembers: number;
    activeMembers: number;
    newMembersThisMonth: number;
    inactiveMembers: number;
  };
  sessions: {
    totalSessions: number;
    completedSessions: number;
    pendingSessions: number;
  };
  staff: {
    totalStaff: number;
    byRole: Record<string, number>;
  };
  recentTransactions: Array<{
    invoiceNumber: string;
    memberNo: string;
    memberName: string;
    amount: number;
    paidAt: string;
  }>;
  topPackages: Array<{
    packageCode: string;
    count: number;
    totalRevenue: number;
  }>;
  topStaff: Array<{
    staffId: string;
    staffCode: string;
    name: string;
    role: string;
    sessionsCompleted: number;
  }>;
}

export const dashboardApi = {
  getBranchDashboard: async (startDate?: string, endDate?: string, branchId?: string): Promise<DashboardStats> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (branchId) params.append('branchId', branchId);
    
    const response = await api.get(`/dashboard/branch?${params.toString()}`);
    return response.data.data;
  },
};
