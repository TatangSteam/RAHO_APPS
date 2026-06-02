import { prisma } from '../../lib/prisma';
import { MemberPackage } from '@prisma/client';

/**
 * Role-specific Dashboard Service
 * Provides dashboard data tailored for each user role
 */

// ══════════════════════════════════════════════════════════════
// TYPES
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
    lastSession: Date | null;
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
    amount: number;
    daysOverdue: number;
  }>;
  membersNeedFollowup: Array<{
    memberId: string;
    memberNo: string;
    memberName: string;
    reason: string;
    lastActivity: Date | null;
  }>;
  weeklyStats: {
    sessionsCompleted: number;
    newMembers: number;
    packagesSold: number;
    revenue: number;
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

export interface MemberDashboardDataEnhanced {
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
    expiredAt: Date | null;
    branchName: string;
  }>;
  lastSession: {
    id: string;
    sessionCode: string;
    treatmentDate: Date;
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
    createdAt: Date;
  }>;
  branchContact: {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
  } | null;
}

// ══════════════════════════════════════════════════════════════
// SERVICE CLASS
// ══════════════════════════════════════════════════════════════

export class RoleDashboardService {
  
  // ────────────────────────────────────────────────────────────
  // DOCTOR DASHBOARD
  // ────────────────────────────────────────────────────────────
  
  async getDoctorDashboard(doctorId: string, branchId: string): Promise<DoctorDashboardData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get today's sessions for this doctor
    const todaySessions = await prisma.treatmentSession.findMany({
      where: {
        doctorId,
        branchId,
        treatmentDate: { gte: today, lt: tomorrow },
      },
      include: {
        encounter: {
          include: {
            member: {
              include: {
                user: { include: { profile: true } },
              },
            },
            memberPackage: true,
          },
        },
      },
      orderBy: { treatmentDate: 'asc' },
    });

    // Calculate stats
    const completed = todaySessions.filter(s => s.isCompleted).length;
    const ongoing = todaySessions.filter(s => !s.isCompleted && s.treatmentDate <= new Date()).length;
    const scheduled = todaySessions.filter(s => !s.isCompleted && s.treatmentDate > new Date()).length;

    // Monthly stats
    const monthlySessions = await prisma.treatmentSession.findMany({
      where: {
        doctorId,
        branchId,
        treatmentDate: { gte: startOfMonth },
      },
      select: { isCompleted: true },
    });

    const monthlyCompleted = monthlySessions.filter(s => s.isCompleted).length;
    const completionRate = monthlySessions.length > 0 
      ? Math.round((monthlyCompleted / monthlySessions.length) * 100) 
      : 0;

    // Recent patients - get unique members from recent sessions
    const recentSessions = await prisma.treatmentSession.findMany({
      where: {
        doctorId,
        branchId,
      },
      include: {
        encounter: {
          include: {
            member: {
              include: {
                user: { include: { profile: true } },
              },
            },
            memberPackage: true,
          },
        },
      },
      orderBy: { treatmentDate: 'desc' },
      take: 20,
    });

    // Get unique members from recent sessions
    const memberMap = new Map<string, {
      memberId: string;
      memberNo: string;
      memberName: string;
      packageType: string;
      progress: string;
      lastSession: Date | null;
    }>();

    for (const session of recentSessions) {
      const memberId = session.encounter.memberId;
      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          memberId,
          memberNo: session.encounter.member.memberNo,
          memberName: session.encounter.member.user.profile?.fullName || 'Unknown',
          packageType: session.encounter.memberPackage.packageType,
          progress: `${session.encounter.memberPackage.usedSessions}/${session.encounter.memberPackage.totalSessions}`,
          lastSession: session.treatmentDate,
        });
      }
      if (memberMap.size >= 5) break;
    }

    return {
      todaySessions: {
        total: todaySessions.length,
        completed,
        ongoing,
        scheduled,
      },
      monthlyStats: {
        totalSessions: monthlySessions.length,
        completionRate,
      },
      schedule: todaySessions.map(s => ({
        id: s.id,
        sessionCode: s.sessionCode,
        time: s.treatmentDate.toISOString(),
        memberName: s.encounter.member.user.profile?.fullName || 'Unknown',
        packageType: s.encounter.memberPackage.packageType,
        infusKe: s.infusKe,
        pelaksanaan: s.pelaksanaan,
        status: s.isCompleted ? 'completed' as const : 
                (s.treatmentDate <= new Date() ? 'ongoing' as const : 'scheduled' as const),
      })),
      recentPatients: Array.from(memberMap.values()),
    };
  }


  // ────────────────────────────────────────────────────────────
  // NURSE DASHBOARD
  // ────────────────────────────────────────────────────────────
  
  async getNurseDashboard(branchId: string): Promise<NurseDashboardData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();

    // Get today's sessions with vital signs
    const todaySessions = await prisma.treatmentSession.findMany({
      where: {
        branchId,
        treatmentDate: { gte: today, lt: tomorrow },
      },
      include: {
        encounter: {
          include: {
            member: {
              include: {
                user: { include: { profile: true } },
              },
            },
          },
        },
        doctor: {
          include: { profile: true },
        },
        vitalSigns: {
          where: { waktuCatat: 'SEBELUM' },
        },
      },
      orderBy: { treatmentDate: 'asc' },
    });

    const completed = todaySessions.filter(s => s.isCompleted).length;
    const ongoing = todaySessions.filter(s => !s.isCompleted && s.treatmentDate <= now).length;

    // Material used today - aggregate from MaterialUsage
    const materialUsage = await prisma.materialUsage.aggregate({
      where: {
        session: {
          branchId,
          treatmentDate: { gte: today, lt: tomorrow },
        },
      },
      _sum: { quantity: true },
    });

    // Helper function to extract vital sign value
    const getVitalValue = (vitalSigns: Array<{ pencatatan: string; value: { toNumber: () => number } }>, type: string): number | null => {
      const vital = vitalSigns.find(v => v.pencatatan === type);
      return vital ? vital.value.toNumber() : null;
    };

    // Active sessions (ongoing)
    const activeSessions = todaySessions
      .filter(s => !s.isCompleted && s.treatmentDate <= now)
      .map(s => ({
        id: s.id,
        sessionCode: s.sessionCode,
        memberName: s.encounter.member.user.profile?.fullName || 'Unknown',
        doctorName: s.doctor.profile?.fullName || 'Unknown',
        startTime: s.treatmentDate.toISOString(),
        infusKe: s.infusKe,
        vitalSigns: s.vitalSigns.length > 0 ? {
          sistol: getVitalValue(s.vitalSigns, 'SISTOL'),
          diastol: getVitalValue(s.vitalSigns, 'DIASTOL'),
          hr: getVitalValue(s.vitalSigns, 'HR'),
          saturasi: getVitalValue(s.vitalSigns, 'SATURASI'),
        } : null,
      }));

    // Upcoming sessions
    const upcomingSessions = todaySessions
      .filter(s => !s.isCompleted && s.treatmentDate > now)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        sessionCode: s.sessionCode,
        time: s.treatmentDate.toISOString(),
        memberName: s.encounter.member.user.profile?.fullName || 'Unknown',
        doctorName: s.doctor.profile?.fullName || 'Unknown',
        infusKe: s.infusKe,
      }));

    // Stock overview (low stock items)
    const inventory = await prisma.inventoryItem.findMany({
      where: { branchId },
      include: {
        masterProduct: true,
      },
      orderBy: { stock: 'asc' },
      take: 10,
    });

    return {
      todaySessions: {
        total: todaySessions.length,
        completed,
        ongoing,
      },
      materialUsedToday: materialUsage._sum.quantity?.toNumber() || 0,
      activeSessions,
      upcomingSessions,
      stockOverview: inventory.map(item => ({
        itemName: item.masterProduct.name,
        currentStock: item.stock.toNumber(),
        unit: item.masterProduct.unit,
        isLow: item.stock.toNumber() <= item.minThreshold.toNumber(),
      })),
    };
  }


  // ────────────────────────────────────────────────────────────
  // ADMIN MANAGER DASHBOARD
  // ────────────────────────────────────────────────────────────
  
  async getAdminManagerDashboard(userId: string, startDate?: Date, endDate?: Date): Promise<AdminManagerDashboardData> {
    const start = startDate || new Date(new Date().setDate(1)); // First day of current month
    const end = endDate || new Date();
    
    // Get previous period for growth calculation
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(start);

    // Get branches assigned to this manager
    const managerBranches = await prisma.managerBranch.findMany({
      where: { userId },
      include: {
        branch: true,
      },
    });

    const branchIds = managerBranches.map(mb => mb.branch.id);

    if (branchIds.length === 0) {
      return {
        summary: {
          totalBranches: 0,
          totalMembers: 0,
          activeMembers: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          revenueGrowth: 0,
          totalSessions: 0,
          completedSessions: 0,
          pendingPayments: 0,
          totalAdminCabang: 0,
        },
        branches: [],
      };
    }

    // Get aggregated stats for all branches
    const [
      totalMembers,
      activeMembers,
      totalSessions,
      completedSessions,
      pendingPayments,
      totalAdminCabang,
      currentRevenue,
      previousRevenue,
    ] = await Promise.all([
      // Total members across all branches
      prisma.member.count({
        where: { registrationBranchId: { in: branchIds } },
      }),
      // Active members
      prisma.member.count({
        where: {
          registrationBranchId: { in: branchIds },
          memberPackages: { some: { status: 'ACTIVE' } },
        },
      }),
      // Total sessions in period
      prisma.treatmentSession.count({
        where: {
          branchId: { in: branchIds },
          treatmentDate: { gte: start, lte: end },
        },
      }),
      // Completed sessions in period
      prisma.treatmentSession.count({
        where: {
          branchId: { in: branchIds },
          treatmentDate: { gte: start, lte: end },
          isCompleted: true,
        },
      }),
      // Pending payments
      prisma.memberPackage.count({
        where: {
          branchId: { in: branchIds },
          status: 'PENDING_PAYMENT',
        },
      }),
      // Total Admin Cabang
      prisma.user.count({
        where: {
          branchId: { in: branchIds },
          role: 'ADMIN_CABANG',
          isActive: true,
        },
      }),
      // Current period revenue
      prisma.invoice.aggregate({
        where: {
          branchId: { in: branchIds },
          status: 'PAID',
          paidAt: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),
      // Previous period revenue
      prisma.invoice.aggregate({
        where: {
          branchId: { in: branchIds },
          status: 'PAID',
          paidAt: { gte: prevStart, lte: prevEnd },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    // Total revenue (all time)
    const totalRevenueResult = await prisma.invoice.aggregate({
      where: {
        branchId: { in: branchIds },
        status: 'PAID',
      },
      _sum: { totalAmount: true },
    });

    const monthlyRevenue = Number(currentRevenue._sum.totalAmount || 0);
    const prevMonthlyRevenue = Number(previousRevenue._sum.totalAmount || 0);
    const revenueGrowth = prevMonthlyRevenue > 0 
      ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100 
      : 0;

    // Get per-branch stats
    const branchStats = await Promise.all(
      managerBranches.map(async (mb) => {
        const branch = mb.branch;
        
        const [
          branchTotalMembers,
          branchActiveMembers,
          branchNewMembers,
          branchTotalSessions,
          branchCompletedSessions,
          branchRevenue,
          branchPrevRevenue,
          branchPendingPayments,
          branchStaff,
        ] = await Promise.all([
          prisma.member.count({
            where: { registrationBranchId: branch.id },
          }),
          prisma.member.count({
            where: {
              registrationBranchId: branch.id,
              memberPackages: { some: { status: 'ACTIVE' } },
            },
          }),
          prisma.member.count({
            where: {
              registrationBranchId: branch.id,
              createdAt: { gte: start },
            },
          }),
          prisma.treatmentSession.count({
            where: {
              branchId: branch.id,
              treatmentDate: { gte: start, lte: end },
            },
          }),
          prisma.treatmentSession.count({
            where: {
              branchId: branch.id,
              treatmentDate: { gte: start, lte: end },
              isCompleted: true,
            },
          }),
          prisma.invoice.aggregate({
            where: {
              branchId: branch.id,
              status: 'PAID',
              paidAt: { gte: start, lte: end },
            },
            _sum: { totalAmount: true },
          }),
          prisma.invoice.aggregate({
            where: {
              branchId: branch.id,
              status: 'PAID',
              paidAt: { gte: prevStart, lte: prevEnd },
            },
            _sum: { totalAmount: true },
          }),
          prisma.memberPackage.count({
            where: {
              branchId: branch.id,
              status: 'PENDING_PAYMENT',
            },
          }),
          prisma.user.count({
            where: {
              branchId: branch.id,
              isActive: true,
              role: { in: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'] },
            },
          }),
        ]);

        const branchMonthlyRevenue = Number(branchRevenue._sum.totalAmount || 0);
        const branchPrevMonthlyRevenue = Number(branchPrevRevenue._sum.totalAmount || 0);
        const branchGrowth = branchPrevMonthlyRevenue > 0
          ? ((branchMonthlyRevenue - branchPrevMonthlyRevenue) / branchPrevMonthlyRevenue) * 100
          : 0;

        return {
          id: branch.id,
          branchCode: branch.branchCode,
          name: branch.name,
          city: branch.city,
          type: branch.type as 'PUSAT' | 'CABANG',
          stats: {
            totalMembers: branchTotalMembers,
            activeMembers: branchActiveMembers,
            newMembersThisMonth: branchNewMembers,
            totalSessions: branchTotalSessions,
            completedSessions: branchCompletedSessions,
            monthlyRevenue: branchMonthlyRevenue,
            pendingPayments: branchPendingPayments,
            totalStaff: branchStaff,
          },
          growth: Math.round(branchGrowth * 10) / 10,
        };
      })
    );

    // Sort branches by revenue (highest first)
    branchStats.sort((a, b) => b.stats.monthlyRevenue - a.stats.monthlyRevenue);

    return {
      summary: {
        totalBranches: branchIds.length,
        totalMembers,
        activeMembers,
        totalRevenue: Number(totalRevenueResult._sum.totalAmount || 0),
        monthlyRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        totalSessions,
        completedSessions,
        pendingPayments,
        totalAdminCabang,
      },
      branches: branchStats,
    };
  }


  // ────────────────────────────────────────────────────────────
  // ADMIN LAYANAN DASHBOARD
  // ────────────────────────────────────────────────────────────
  
  async getAdminLayananDashboard(branchId: string): Promise<AdminLayananDashboardData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Today's stats
    // Active Members: count unique members who have ACTIVE packages at THIS branch
    // (not based on registration branch, but based on where their active packages are)
    const [sessionsToday, completedToday, pendingPaymentsCount, activeMembersResult] = await Promise.all([
      prisma.treatmentSession.count({
        where: { branchId, treatmentDate: { gte: today, lt: tomorrow } },
      }),
      prisma.treatmentSession.count({
        where: { branchId, treatmentDate: { gte: today, lt: tomorrow }, isCompleted: true },
      }),
      prisma.memberPackage.count({
        where: { branchId, status: 'PENDING_PAYMENT' },
      }),
      // Count unique members with ACTIVE packages at this branch
      prisma.memberPackage.findMany({
        where: { 
          branchId, 
          status: 'ACTIVE' 
        },
        select: { memberId: true },
        distinct: ['memberId'],
      }),
    ]);
    
    const activeMembers = activeMembersResult.length;

    // Session schedule
    const sessionSchedule = await prisma.treatmentSession.findMany({
      where: { branchId, treatmentDate: { gte: today, lt: tomorrow } },
      include: {
        encounter: {
          include: {
            member: {
              include: { user: { include: { profile: true } } },
            },
            memberPackage: true,
          },
        },
        doctor: { include: { profile: true } },
      },
      orderBy: { treatmentDate: 'asc' },
    });

    // Pending payments - use correct InvoiceStatus values
    const pendingPayments = await prisma.invoice.findMany({
      where: {
        branchId,
        status: { in: ['PENDING_PAYMENT', 'OVERDUE'] },
      },
      include: {
        member: {
          include: { user: { include: { profile: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Members needing follow-up (inactive for 14+ days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Get members with active packages who haven't had sessions recently
    const membersWithActivePackages = await prisma.member.findMany({
      where: {
        registrationBranchId: branchId,
        memberPackages: { some: { status: 'ACTIVE' } },
      },
      include: {
        user: { include: { profile: true } },
        encounters: {
          include: {
            sessions: {
              orderBy: { treatmentDate: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 50,
    });

    // Filter members who haven't had sessions in 14 days
    const inactiveMembers = membersWithActivePackages.filter(m => {
      const lastSession = m.encounters[0]?.sessions[0];
      if (!lastSession) return true; // No sessions at all
      return lastSession.treatmentDate < twoWeeksAgo;
    }).slice(0, 10);

    // Weekly stats
    const [weeklySessionsCompleted, weeklyNewMembers, weeklyPackagesSold, weeklyRevenue] = await Promise.all([
      prisma.treatmentSession.count({
        where: { branchId, treatmentDate: { gte: weekAgo }, isCompleted: true },
      }),
      prisma.member.count({
        where: { registrationBranchId: branchId, createdAt: { gte: weekAgo } },
      }),
      prisma.memberPackage.count({
        where: { branchId, createdAt: { gte: weekAgo } },
      }),
      prisma.invoice.aggregate({
        where: { branchId, status: 'PAID', paidAt: { gte: weekAgo } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      todayStats: {
        sessionsToday,
        completedToday,
        pendingPayments: pendingPaymentsCount,
        activeMembers,
      },
      sessionSchedule: sessionSchedule.map(s => ({
        id: s.id,
        sessionCode: s.sessionCode,
        time: s.treatmentDate.toISOString(),
        memberName: s.encounter.member.user.profile?.fullName || 'Unknown',
        memberNo: s.encounter.member.memberNo,
        packageType: s.encounter.memberPackage.packageType,
        doctorName: s.doctor.profile?.fullName || 'Unknown',
        status: s.isCompleted ? 'completed' : (s.treatmentDate <= new Date() ? 'ongoing' : 'scheduled'),
      })),
      pendingPayments: pendingPayments.map(inv => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        memberName: inv.member.user.profile?.fullName || 'Unknown',
        amount: Number(inv.totalAmount),
        daysOverdue: Math.floor((Date.now() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      membersNeedFollowup: inactiveMembers.map(m => ({
        memberId: m.id,
        memberNo: m.memberNo,
        memberName: m.user.profile?.fullName || 'Unknown',
        reason: 'Tidak ada sesi dalam 14 hari terakhir',
        lastActivity: m.encounters[0]?.sessions[0]?.treatmentDate || null,
      })),
      weeklyStats: {
        sessionsCompleted: weeklySessionsCompleted,
        newMembers: weeklyNewMembers,
        packagesSold: weeklyPackagesSold,
        revenue: Number(weeklyRevenue._sum.totalAmount || 0),
      },
    };
  }


  // ────────────────────────────────────────────────────────────
  // ENHANCED MEMBER DASHBOARD
  // ────────────────────────────────────────────────────────────
  
  async getMemberDashboardEnhanced(memberId: string): Promise<MemberDashboardDataEnhanced> {
    // Get member with all related data
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: { include: { profile: true } },
        registrationBranch: true,
        memberPackages: {
          where: { status: 'ACTIVE' },
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
        },
        encounters: {
          include: {
            sessions: {
              orderBy: { treatmentDate: 'desc' },
              take: 1,
              include: {
                doctor: { include: { profile: true } },
                branch: true,
              },
            },
            memberPackage: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan.' };
    }

    // Get total sessions
    const sessionStats = await prisma.treatmentSession.aggregate({
      where: {
        encounter: { memberId },
      },
      _count: true,
    });

    const completedSessions = await prisma.treatmentSession.count({
      where: {
        encounter: { memberId },
        isCompleted: true,
      },
    });

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
    });

    // Find last session
    let lastSession = null;
    for (const encounter of member.encounters) {
      if (encounter.sessions.length > 0) {
        const session = encounter.sessions[0];
        lastSession = {
          id: session.id,
          sessionCode: session.sessionCode,
          treatmentDate: session.treatmentDate,
          infusKe: session.infusKe,
          pelaksanaan: session.pelaksanaan,
          doctorName: session.doctor.profile?.fullName || 'Dokter',
          branchName: session.branch.name,
          isCompleted: session.isCompleted,
        };
        break;
      }
    }

    // Get greeting based on time
    const hour = new Date().getHours();
    let greeting = 'Selamat pagi';
    if (hour >= 12 && hour < 15) greeting = 'Selamat siang';
    else if (hour >= 15 && hour < 18) greeting = 'Selamat sore';
    else if (hour >= 18) greeting = 'Selamat malam';

    const firstName = member.user.profile?.fullName?.split(' ')[0] || 'Member';

    return {
      greeting: `${greeting}, ${firstName}!`,
      stats: {
        voucherSisa: member.voucherCount,
        paketAktif: member.memberPackages.length,
        totalSesi: sessionStats._count,
        sesiSelesai: completedSessions,
      },
      activePackages: member.memberPackages.map((pkg: MemberPackage & { branch: { name: string } }) => ({
        id: pkg.id,
        packageCode: pkg.packageCode,
        packageType: pkg.packageType,
        totalSessions: pkg.totalSessions,
        usedSessions: pkg.usedSessions,
        remainingSessions: pkg.totalSessions - pkg.usedSessions,
        progress: Math.round((pkg.usedSessions / pkg.totalSessions) * 100),
        status: pkg.status,
        expiredAt: pkg.expiredAt,
        branchName: pkg.branch.name,
      })),
      lastSession,
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: Number(inv.totalAmount),
        status: inv.status,
        createdAt: inv.createdAt,
      })),
      branchContact: member.registrationBranch ? {
        name: member.registrationBranch.name,
        phone: member.registrationBranch.phone,
        address: member.registrationBranch.address,
        city: member.registrationBranch.city,
      } : null,
    };
  }
}
