import { prisma } from '../../lib/prisma';
import { summarizeDashboardPackages } from './dashboard-statistics.helpers';

/**
 * Service for dashboard statistics
 */
export class DashboardService {
  /**
   * Get branch dashboard statistics
   */
  async getBranchDashboard(branchId: string, startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(new Date().setDate(1)); // First day of current month
    const end = endDate || new Date(); // Today

    // Run all queries in parallel for better performance
    const [
      revenueStats,
      packageStats,
      memberStats,
      sessionStats,
      staffStats,
      recentTransactions,
      topPackages,
      topStaff,
    ] = await Promise.all([
      this.getRevenueStats(branchId, start, end),
      this.getPackageStats(branchId, start, end),
      this.getMemberStats(branchId),
      this.getSessionStats(branchId, start, end),
      this.getStaffStats(branchId),
      this.getRecentTransactions(branchId, 5),
      this.getTopPackages(branchId, start, end, 5),
      this.getTopStaff(branchId, start, end, 5),
    ]);

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      revenue: revenueStats,
      packages: packageStats,
      members: memberStats,
      sessions: sessionStats,
      staff: staffStats,
      recentTransactions,
      topPackages,
      topStaff,
    };
  }

  /**
   * Get revenue statistics
   */
  private async getRevenueStats(branchId: string, startDate: Date, endDate: Date) {
    // Revenue is sourced from posted recognition, never from package payment.
    const recognitions = await prisma.revenueRecognition.findMany({
      where: {
        branchId,
        status: 'POSTED',
        recognizedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        recognizedAt: true,
      },
    });

    const totalRevenue = recognitions.reduce((sum, row) => sum + Number(row.amount), 0);
    const transactionCount = recognitions.length;
    const averageTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    // Get previous period for comparison
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(startDate);

    const previousRecognitions = await prisma.revenueRecognition.findMany({
      where: {
        branchId,
        status: 'POSTED',
        recognizedAt: {
          gte: prevStart,
          lte: prevEnd,
        },
      },
      select: {
        amount: true,
      },
    });

    const prevRevenue = previousRecognitions.reduce((sum, row) => sum + Number(row.amount), 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Revenue by day for chart
    const revenueByDay = await this.getRevenueByDay(branchId, startDate, endDate);

    return {
      totalRevenue,
      transactionCount,
      averageTransaction,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      revenueByDay,
    };
  }

  /**
   * Get revenue grouped by day
   */
  private async getRevenueByDay(branchId: string, startDate: Date, endDate: Date) {
    const recognitions = await prisma.revenueRecognition.findMany({
      where: {
        branchId,
        status: 'POSTED',
        recognizedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        recognizedAt: true,
      },
      orderBy: {
        recognizedAt: 'asc',
      },
    });

    // Group by date
    const revenueMap = new Map<string, number>();
    recognitions.forEach((row) => {
      const date = row.recognizedAt!.toISOString().split('T')[0];
      const current = revenueMap.get(date) || 0;
      revenueMap.set(date, current + Number(row.amount));
    });

    return Array.from(revenueMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));
  }

  /**
   * Get package statistics
   */
  private async getPackageStats(branchId: string, startDate: Date, endDate: Date) {
    const packages = await prisma.memberPackage.findMany({
      where: {
        branchId,
      },
      select: {
        id: true,
        purchaseGroupId: true,
        packageType: true,
        status: true,
        createdAt: true,
      },
    });

    return summarizeDashboardPackages(packages, startDate, endDate);
  }

  /**
   * Get member statistics
   */
  private async getMemberStats(branchId: string) {
    // Total members registered at this branch
    const totalMembers = await prisma.member.count({
      where: {
        registrationBranchId: branchId,
      },
    });

    // Active members (have active packages)
    const activeMembers = await prisma.member.count({
      where: {
        registrationBranchId: branchId,
        isActive: true,
        isDeceased: false,
        memberPackages: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
    });

    // New members this month
    const startOfMonth = new Date(new Date().setDate(1));
    const newMembersThisMonth = await prisma.member.count({
      where: {
        registrationBranchId: branchId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    return {
      totalMembers,
      activeMembers,
      newMembersThisMonth,
      inactiveMembers: totalMembers - activeMembers,
    };
  }

  /**
   * Get session statistics (BASIC packages only)
   */
  private async getSessionStats(branchId: string, startDate: Date, endDate: Date) {
    const sessions = await prisma.treatmentSession.count({
      where: {
        branchId,
        encounter: {
          memberPackage: {
            packageType: 'BASIC', // Only count BASIC packages
          },
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const completedSessions = await prisma.treatmentSession.count({
      where: {
        branchId,
        encounter: {
          memberPackage: {
            packageType: 'BASIC', // Only count BASIC packages
          },
        },
        isCompleted: true,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      totalSessions: sessions,
      completedSessions,
      pendingSessions: sessions - completedSessions,
    };
  }

  /**
   * Get staff statistics
   */
  private async getStaffStats(branchId: string) {
    const staff = await prisma.user.findMany({
      where: {
        branchId,
        isActive: true,
      },
      select: {
        role: true,
      },
    });

    const byRole = staff.reduce((acc, s) => {
      acc[s.role] = (acc[s.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalStaff: staff.length,
      byRole,
    };
  }

  /**
   * Get recent transactions
   */
  private async getRecentTransactions(branchId: string, limit: number = 5) {
    const invoices = await prisma.invoice.findMany({
      where: {
        branchId,
        status: 'PAID',
      },
      select: {
        invoiceNumber: true,
        totalAmount: true,
        paidAt: true,
        member: {
          select: {
            memberNo: true,
            user: {
              select: {
                profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        paidAt: 'desc',
      },
      take: limit,
    });

    return invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      memberNo: inv.member.memberNo,
      memberName: inv.member.user.profile?.fullName || 'Unknown',
      amount: Number(inv.totalAmount),
      paidAt: inv.paidAt?.toISOString(),
    }));
  }

  /**
   * Get top selling packages
   */
  private async getTopPackages(branchId: string, startDate: Date, endDate: Date, limit: number = 5) {
    const packages = await prisma.memberPackage.groupBy({
      by: ['packageCode'],
      where: {
        branchId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
      orderBy: {
        _count: {
          packageCode: 'desc',
        },
      },
      take: limit,
    });

    return Promise.all(packages.map(async (p) => {
      const recognized = await prisma.revenueRecognition.aggregate({
        where: {
          branchId,
          status: 'POSTED',
          recognizedAt: { gte: startDate, lte: endDate },
          memberPackage: { packageCode: p.packageCode },
        },
        _sum: { amount: true },
      });
      return { packageCode: p.packageCode, count: p._count, totalRevenue: Number(recognized._sum.amount || 0) };
    }));
  }

  /**
   * Get top performing staff (by sessions completed - BASIC packages only)
   */
  private async getTopStaff(branchId: string, startDate: Date, endDate: Date, limit: number = 5) {
    // Get doctors with most completed sessions (BASIC packages only)
    const doctors = await prisma.treatmentSession.groupBy({
      by: ['doctorId'],
      where: {
        branchId,
        encounter: {
          memberPackage: {
            packageType: 'BASIC', // Only count BASIC packages
          },
        },
        isCompleted: true,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
      orderBy: {
        _count: {
          doctorId: 'desc',
        },
      },
      take: limit,
    });

    // Get user details for doctors
    const doctorIds = doctors.map(d => d.doctorId);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: doctorIds,
        },
      },
      select: {
        id: true,
        staffCode: true,
        role: true,
        profile: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Map doctors with their session counts
    const topStaff = doctors.map(d => {
      const user = users.find(u => u.id === d.doctorId);
      return {
        staffId: d.doctorId,
        staffCode: user?.staffCode || 'N/A',
        name: user?.profile?.fullName || 'Unknown',
        role: user?.role || 'DOCTOR',
        sessionsCompleted: d._count,
      };
    });

    return topStaff;
  }
}
