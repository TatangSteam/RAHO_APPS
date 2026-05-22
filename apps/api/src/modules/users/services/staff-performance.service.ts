import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { errors } from '../../../middleware/errorHandler';

// ═══════════════════════════════════════════════════════════════
// STAFF PERFORMANCE SERVICE
// Provides performance metrics and session history for staff
// Access: ADMIN_CABANG and above
// ═══════════════════════════════════════════════════════════════

interface StaffPerformanceQuery {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface StaffSessionHistoryQuery {
  position?: 'doctor' | 'nurse' | 'adminLayanan' | 'all';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Get staff performance summary for a branch
 * Returns list of staff with their therapy counts by position
 */
export async function getStaffPerformanceSummaryService(
  query: StaffPerformanceQuery,
  callerRole: Role,
  callerBranchId: string | null,
) {
  const { branchId, startDate, endDate, page = 1, limit = 50 } = query;
  const skip = (page - 1) * limit;

  // Determine which branch to query
  let targetBranchId = branchId;
  if (callerRole === Role.ADMIN_CABANG) {
    // ADMIN_CABANG can only see their own branch
    targetBranchId = callerBranchId || undefined;
  }

  if (!targetBranchId) {
    throw errors.badRequest('BRANCH_REQUIRED', 'Branch ID diperlukan');
  }

  // Build date filter
  const dateFilter: Prisma.TreatmentSessionWhereInput = {};
  if (startDate || endDate) {
    const treatmentDateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      treatmentDateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      treatmentDateFilter.lte = new Date(endDate);
    }
    dateFilter.treatmentDate = treatmentDateFilter;
  }

  // Get all staff in the branch (excluding MEMBER and ADMIN_MANAGER)
  const staff = await prisma.user.findMany({
    where: {
      branchId: targetBranchId,
      isActive: true,
      NOT: { role: { in: [Role.MEMBER, Role.ADMIN_MANAGER] } },
    },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
          avatarUrl: true,
        },
      },
    },
    skip,
    take: limit,
    orderBy: { profile: { fullName: 'asc' } },
  });

  const staffIds = staff.map((s) => s.id);

  // Count sessions by position for each staff
  const [doctorCounts, nurseCounts, adminCounts] = await Promise.all([
    // Sessions as Doctor
    prisma.treatmentSession.groupBy({
      by: ['doctorId'],
      where: {
        doctorId: { in: staffIds },
        branchId: targetBranchId,
        isCompleted: true,
        ...dateFilter,
      },
      _count: true,
    }),
    // Sessions as Nurse
    prisma.treatmentSession.groupBy({
      by: ['nurseId'],
      where: {
        nurseId: { in: staffIds },
        branchId: targetBranchId,
        isCompleted: true,
        ...dateFilter,
      },
      _count: true,
    }),
    // Sessions as Admin Layanan
    prisma.treatmentSession.groupBy({
      by: ['adminLayananId'],
      where: {
        adminLayananId: { in: staffIds },
        branchId: targetBranchId,
        isCompleted: true,
        ...dateFilter,
      },
      _count: true,
    }),
  ]);

  // Create maps for quick lookup
  const doctorMap = new Map(doctorCounts.map((d) => [d.doctorId, d._count]));
  const nurseMap = new Map(nurseCounts.map((n) => [n.nurseId, n._count]));
  const adminMap = new Map(adminCounts.map((a) => [a.adminLayananId, a._count]));

  // Build result with performance data
  const staffWithPerformance = staff.map((s) => {
    const asDoctor = doctorMap.get(s.id) || 0;
    const asNurse = nurseMap.get(s.id) || 0;
    const asAdminLayanan = adminMap.get(s.id) || 0;
    const total = asDoctor + asNurse + asAdminLayanan;

    return {
      id: s.id,
      email: s.email,
      role: s.role,
      staffCode: s.staffCode,
      fullName: s.profile?.fullName || '',
      phone: s.profile?.phone || '',
      avatarUrl: s.profile?.avatarUrl || null,
      performance: {
        asDoctor,
        asNurse,
        asAdminLayanan,
        total,
      },
    };
  });

  // Sort by total performance descending
  staffWithPerformance.sort((a, b) => b.performance.total - a.performance.total);

  // Get total count for pagination
  const totalStaff = await prisma.user.count({
    where: {
      branchId: targetBranchId,
      isActive: true,
      NOT: { role: { in: [Role.MEMBER, Role.ADMIN_MANAGER] } },
    },
  });

  // Get branch info
  const branch = await prisma.branch.findUnique({
    where: { id: targetBranchId },
    select: { id: true, branchCode: true, name: true },
  });

  return {
    branch,
    staff: staffWithPerformance,
    total: totalStaff,
    page,
    limit,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
}

/**
 * Get detailed session history for a specific staff member
 * Shows all sessions they participated in, grouped by position
 */
export async function getStaffSessionHistoryService(
  staffId: string,
  query: StaffSessionHistoryQuery,
  callerRole: Role,
  callerBranchId: string | null,
) {
  const { position = 'all', startDate, endDate, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  // Get staff info
  const staff = await prisma.user.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      branchId: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
          avatarUrl: true,
        },
      },
      branch: {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      },
    },
  });

  if (!staff) {
    throw errors.notFound('Staff tidak ditemukan');
  }

  // Check access - ADMIN_CABANG can only see staff in their branch
  if (callerRole === Role.ADMIN_CABANG && staff.branchId !== callerBranchId) {
    throw errors.forbidden('Anda tidak memiliki akses ke staff ini');
  }

  // Build date filter
  const dateFilter: Prisma.TreatmentSessionWhereInput = {};
  if (startDate || endDate) {
    const treatmentDateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      treatmentDateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      treatmentDateFilter.lte = new Date(endDate);
    }
    dateFilter.treatmentDate = treatmentDateFilter;
  }

  // Build position filter
  const positionFilter: Prisma.TreatmentSessionWhereInput = {};
  if (position === 'doctor') {
    positionFilter.doctorId = staffId;
  } else if (position === 'nurse') {
    positionFilter.nurseId = staffId;
  } else if (position === 'adminLayanan') {
    positionFilter.adminLayananId = staffId;
  } else {
    // All positions
    positionFilter.OR = [
      { doctorId: staffId },
      { nurseId: staffId },
      { adminLayananId: staffId },
    ];
  }

  // Get sessions
  const [sessions, totalSessions] = await Promise.all([
    prisma.treatmentSession.findMany({
      where: {
        ...positionFilter,
        ...dateFilter,
        isCompleted: true,
      },
      select: {
        id: true,
        sessionCode: true,
        infusKe: true,
        pelaksanaan: true,
        treatmentDate: true,
        isCompleted: true,
        doctorId: true,
        nurseId: true,
        adminLayananId: true,
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
          },
        },
        encounter: {
          select: {
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
            memberPackage: {
              select: {
                packageType: true,
                boosterType: true,
              },
            },
          },
        },
      },
      orderBy: { treatmentDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.treatmentSession.count({
      where: {
        ...positionFilter,
        ...dateFilter,
        isCompleted: true,
      },
    }),
  ]);

  // Add position info to each session
  const sessionsWithPosition = sessions.map((session) => {
    const positions: string[] = [];
    if (session.doctorId === staffId) positions.push('doctor');
    if (session.nurseId === staffId) positions.push('nurse');
    if (session.adminLayananId === staffId) positions.push('adminLayanan');

    return {
      id: session.id,
      sessionCode: session.sessionCode,
      infusKe: session.infusKe,
      pelaksanaan: session.pelaksanaan,
      treatmentDate: session.treatmentDate,
      isCompleted: session.isCompleted,
      branch: session.branch,
      member: {
        memberNo: session.encounter.member.memberNo,
        fullName: session.encounter.member.user.profile?.fullName || '',
      },
      package: {
        packageType: session.encounter.memberPackage.packageType,
        boosterType: session.encounter.memberPackage.boosterType,
      },
      positions, // Array of positions this staff held in this session
    };
  });

  // Get counts by position
  const [doctorCount, nurseCount, adminCount] = await Promise.all([
    prisma.treatmentSession.count({
      where: { doctorId: staffId, isCompleted: true, ...dateFilter },
    }),
    prisma.treatmentSession.count({
      where: { nurseId: staffId, isCompleted: true, ...dateFilter },
    }),
    prisma.treatmentSession.count({
      where: { adminLayananId: staffId, isCompleted: true, ...dateFilter },
    }),
  ]);

  return {
    staff: {
      id: staff.id,
      email: staff.email,
      role: staff.role,
      staffCode: staff.staffCode,
      fullName: staff.profile?.fullName || '',
      phone: staff.profile?.phone || '',
      avatarUrl: staff.profile?.avatarUrl || null,
      branch: staff.branch,
    },
    summary: {
      asDoctor: doctorCount,
      asNurse: nurseCount,
      asAdminLayanan: adminCount,
      total: doctorCount + nurseCount + adminCount,
    },
    sessions: sessionsWithPosition,
    total: totalSessions,
    page,
    limit,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
}
