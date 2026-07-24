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

// ══════════════════════════════════════════════════════════════
// ROLE-SPECIFIC DASHBOARD TYPES
// ══════════════════════════════════════════════════════════════

export interface DoctorDashboardData {
  todaySessions: {
    total: number;
    completed: number;
    ongoing: number;
    scheduled: number;
  };
  monthlyStats: {
    totalSessions: number;
    completionRate: number;
  };
  schedule: Array<{
    id: string;
    sessionCode: string;
    time: string;
    memberName: string;
    packageType: string;
    infusKe: number;
    pelaksanaan: string;
    status: 'completed' | 'ongoing' | 'scheduled';
  }>;
  recentPatients: Array<{
    memberId: string;
    memberNo: string;
    memberName: string;
    packageType: string;
    progress: string;
    lastSession: string | null;
  }>;
}

export interface NurseDashboardData {
  todaySessions: {
    total: number;
    completed: number;
    ongoing: number;
  };
  materialUsedToday: number;
  activeSessions: Array<{
    id: string;
    sessionCode: string;
    memberName: string;
    doctorName: string;
    startTime: string;
    infusKe: number;
    vitalSigns: {
      sistol: number | null;
      diastol: number | null;
      hr: number | null;
      saturasi: number | null;
    } | null;
  }>;
  upcomingSessions: Array<{
    id: string;
    sessionCode: string;
    time: string;
    memberName: string;
    doctorName: string;
    infusKe: number;
  }>;
  stockOverview: Array<{
    itemName: string;
    currentStock: number;
    unit: string;
    isLow: boolean;
  }>;
}

export interface AdminLayananDashboardData {
  todayStats: {
    sessionsToday: number;
    completedToday: number;
    pendingPayments: number;
    activeMembers: number;
  };
  sessionSchedule: Array<{
    id: string;
    sessionCode: string;
    time: string;
    memberName: string;
    memberNo: string;
    packageType: string;
    doctorName: string;
    status: string;
  }>;
  pendingPayments: Array<{
    invoiceId: string;
    invoiceNumber: string;
    memberName: string;
    daysOverdue: number;
  }>;
  membersNeedFollowup: Array<{
    memberId: string;
    memberNo: string;
    memberName: string;
    reason: string;
    lastActivity: string | null;
  }>;
  weeklyStats: {
    sessionsCompleted: number;
    newMembers: number;
    packagesSold: number;
  };
}

export interface AdminManagerDashboardData {
  summary: {
    totalBranches: number;
    totalMembers: number;
    activeMembers: number;
    totalRevenue: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    totalSessions: number;
    completedSessions: number;
    pendingPayments: number;
    totalAdminCabang: number;
  };
  branches: Array<{
    id: string;
    branchCode: string;
    name: string;
    city: string | null;
    type: 'PUSAT' | 'CABANG';
    stats: {
      totalMembers: number;
      activeMembers: number;
      newMembersThisMonth: number;
      totalSessions: number;
      completedSessions: number;
      monthlyRevenue: number;
      pendingPayments: number;
      totalStaff: number;
    };
    growth: number;
  }>;
}

export interface MemberDashboardEnhanced {
  greeting: string;
  stats: {
    voucherSisa: number;
    paketAktif: number;
    totalSesi: number;
    sesiSelesai: number;
  };
  activePackages: Array<{
    id: string;
    packageCode: string;
    packageType: string;
    totalSessions: number;
    usedSessions: number;
    remainingSessions: number;
    progress: number;
    status: string;
    expiredAt: string | null;
    branchName: string;
  }>;
  lastSession: {
    id: string;
    sessionCode: string;
    treatmentDate: string;
    infusKe: number;
    pelaksanaan: string;
    doctorName: string;
    branchName: string;
    isCompleted: boolean;
  } | null;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }>;
  branchContact: {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
  } | null;
}

// ══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ══════════════════════════════════════════════════════════════

export const dashboardApi = {
  getBranchDashboard: async (startDate?: string, endDate?: string, branchId?: string): Promise<DashboardStats> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (branchId) params.append('branchId', branchId);
    
    const response = await api.get(`/dashboard/branch?${params.toString()}`);
    return response.data.data;
  },

  getDoctorDashboard: async (): Promise<DoctorDashboardData> => {
    const response = await api.get('/dashboard/doctor');
    return response.data.data;
  },

  getNurseDashboard: async (): Promise<NurseDashboardData> => {
    const response = await api.get('/dashboard/nurse');
    return response.data.data;
  },

  getAdminLayananDashboard: async (): Promise<AdminLayananDashboardData> => {
    const response = await api.get('/dashboard/admin-layanan');
    return response.data.data;
  },

  getAdminManagerDashboard: async (startDate?: string, endDate?: string): Promise<AdminManagerDashboardData> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/dashboard/admin-manager?${params.toString()}`);
    return response.data.data;
  },

  getMemberDashboard: async (): Promise<MemberDashboardEnhanced> => {
    const response = await api.get('/dashboard/member');
    return response.data.data;
  },
};
