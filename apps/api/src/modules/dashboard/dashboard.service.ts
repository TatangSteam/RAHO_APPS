// @ts-nocheck
import { prisma } from '../../lib/prisma';

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
    // Total revenue from paid invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        branchId,
        status: 'PAID',
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        totalAmount: true,
        paidAt: true,
      },
    });

    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const transactionCount = invoices.length;
    const averageTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    // Get previous period for comparison
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(startDate);

    const prevInvoices = await prisma.invoice.findMany({
      where: {
        branchId,
        status: 'PAID',
        paidAt: {
          gte: prevStart,
          lte: prevEnd,
        },
      },
      select: {
        totalAmount: true,
      },
    });

    const prevRevenue = prevInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
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
    const invoices = await prisma.invoice.findMany({
      where: {
        branchId,
        status: 'PAID',
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        totalAmount: true,
        paidAt: true,
      },
      orderBy: {
        paidAt: 'asc',
      },
    });

    // Group by date
    const revenueMap = new Map<string, number>();
    invoices.forEach((inv) => {
      const date = inv.paidAt!.toISOString().split('T')[0];
      const current = revenueMap.get(date) || 0;
      revenueMap.set(date, current + Number(inv.totalAmount));
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
    // Packages sold in period
    const packagesSold = await prisma.memberPackage.count({
      where: {
        branchId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Active packages
    const activePackages = await prisma.memberPackage.count({
      where: {
        branchId,
        status: 'ACTIVE',
      },
    });

    // Pending payment packages (include WAITING_VERIFICATION)
    const pendingPayment = await prisma.memberPackage.count({
      where: {
        branchId,
        status: { in: ['PENDING_PAYMENT', 'WAITING_VERIFICATION'] },
      },
    });

    // Package types breakdown
    const packagesByType = await prisma.memberPackage.groupBy({
      by: ['packageType'],
      where: {
        branchId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
    });

    return {
      packagesSold,
      activePackages,
      pendingPayment,
      byType: packagesByType.map((p) => ({
        type: p.packageType,
        count: p._count,
      })),
    };
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
      include: {
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
      _sum: {
        finalPrice: true,
      },
      orderBy: {
        _count: {
          packageCode: 'desc',
        },
      },
      take: limit,
    });

    return packages.map((p) => ({
      packageCode: p.packageCode,
      count: p._count,
      totalRevenue: Number(p._sum.finalPrice || 0),
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
