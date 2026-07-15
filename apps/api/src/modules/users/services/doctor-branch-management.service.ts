import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/errorHandler';
import { logAudit } from '@/utils/auditLog';

export class DoctorBranchManagementService {
  /**
   * Get doctors by branch - scoped by Admin Manager's managed branches
   * @param options Filter options
   * @param requestingUserId User ID making the request
   * @param requestingUserRole Role of the requesting user
   */
  async getDoctorsByBranch(
    options: {
      branchId?: string;
      status?: boolean;
      page?: number;
      limit?: number;
    },
    requestingUserId: string,
    requestingUserRole: string
  ) {
    const { branchId, status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Build branch filter based on role
    let branchIds: string[] = [];

    if (requestingUserRole === 'SUPER_ADMIN') {
      // Super Admin sees all branches
      if (branchId) {
        branchIds = [branchId];
      } else {
        // Get all branch IDs
        const allBranches = await prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        branchIds = allBranches.map((b) => b.id);
      }
    } else if (requestingUserRole === 'ADMIN_MANAGER') {
      // Admin Manager only sees their managed branches
      const managedBranches = await prisma.managerBranch.findMany({
        where: { userId: requestingUserId },
        select: { branchId: true },
      });

      branchIds = managedBranches.map((mb) => mb.branchId);

      // If specific branchId requested, check if Admin Manager manages it
      if (branchId) {
        if (!branchIds.includes(branchId)) {
          throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke cabang ini');
        }
        branchIds = [branchId];
      }

      if (branchIds.length === 0) {
        return {
          doctors: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
    } else {
      throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki izin untuk mengakses data ini');
    }

    // Build where clause
    const whereClause: any = {
      role: 'DOCTOR',
      ...(status !== undefined ? { isActive: status } : {}),
    };

    // Get doctors with their branch assignments
    const [doctors, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          profile: true,
          staffBranches: {
            where: {
              branchId: { in: branchIds },
            },
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                  branchCode: true,
                },
              },
            },
          },
          sessionsAsDoctor: {
            where: {
              branchId: { in: branchIds },
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { profile: { fullName: 'asc' } }],
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    // Filter doctors who have at least one branch assignment in the allowed branches
    const filteredDoctors = doctors.filter((doc) => doc.staffBranches.length > 0);

    // Transform response
    const result = filteredDoctors.map((doctor) => ({
      userId: doctor.id,
      fullName: doctor.profile?.fullName || 'N/A',
      email: doctor.email,
      phoneNumber: doctor.profile?.phone || null,
      isActive: doctor.isActive,
      assignedBranches: doctor.staffBranches.map((sb) => ({
        branchId: sb.branch.id,
        branchName: sb.branch.name,
        branchCode: sb.branch.branchCode,
        assignedAt: sb.createdAt.toISOString(),
      })),
      sessionCount: doctor.sessionsAsDoctor.length,
    }));

    return {
      doctors: result,
      pagination: {
        page,
        limit,
        total: filteredDoctors.length,
        totalPages: Math.ceil(filteredDoctors.length / limit),
      },
    };
  }

  /**
   * Assign doctor to branch
   * @param doctorId Doctor user ID
   * @param branchId Branch ID
   * @param requestingUserId User ID making the request
   * @param requestingUserRole Role of the requesting user
   */
  async assignDoctorToBranch(
    doctorId: string,
    branchId: string,
    requestingUserId: string,
    requestingUserRole: string
  ) {
    // Check if doctor exists and is active
    const doctor = await prisma.user.findFirst({
      where: {
        id: doctorId,
        role: 'DOCTOR',
        isActive: true,
      },
      include: {
        profile: true,
      },
    });

    if (!doctor) {
      throw new AppError(404, 'NOT_FOUND', 'Dokter tidak ditemukan atau tidak aktif');
    }

    // Check if branch exists
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        isActive: true,
      },
    });

    if (!branch) {
      throw new AppError(404, 'NOT_FOUND', 'Cabang tidak ditemukan atau tidak aktif');
    }

    // Authorization check
    if (requestingUserRole === 'ADMIN_MANAGER') {
      // Check if Admin Manager manages this branch
      const managesBranch = await prisma.managerBranch.findFirst({
        where: {
          userId: requestingUserId,
          branchId,
        },
      });

      if (!managesBranch) {
        throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses untuk manage cabang ini');
      }
    }

    // Check if already assigned
    const existingAssignment = await prisma.staffBranch.findFirst({
      where: {
        userId: doctorId,
        branchId,
      },
    });

    if (existingAssignment) {
      throw new AppError(400, 'BAD_REQUEST', 'Dokter sudah di-assign ke cabang ini');
    }

    // Create assignment
    const assignment = await prisma.staffBranch.create({
      data: {
        userId: doctorId,
        branchId,
      },
      include: {
        branch: true,
      },
    });

    // Get requesting user info for audit
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { profile: true },
    });

    // Audit log
    await logAudit({
      userId: requestingUserId,
      branchId,
      action: 'CREATE',
      resource: 'STAFF_BRANCH_ASSIGNMENT',
      resourceId: assignment.id,
      meta: {
        action: 'ASSIGN_DOCTOR_TO_BRANCH',
        targetUserId: doctorId,
        branchName: branch.name,
        doctorName: doctor.profile?.fullName,
        managerName: requestingUser?.profile?.fullName,
      },
    });

    return {
      id: assignment.id,
      userId: assignment.userId,
      branchId: assignment.branchId,
      assignedAt: assignment.createdAt.toISOString(),
      assignedBy: {
        userId: requestingUserId,
        fullName: requestingUser?.profile?.fullName || 'N/A',
      },
      branch: {
        id: branch.id,
        name: branch.name,
        branchCode: branch.branchCode,
      },
    };
  }

  /**
   * Remove doctor from branch
   * @param doctorId Doctor user ID
   * @param branchId Branch ID
   * @param requestingUserId User ID making the request
   * @param requestingUserRole Role of the requesting user
   */
  async removeDoctorFromBranch(
    doctorId: string,
    branchId: string,
    requestingUserId: string,
    requestingUserRole: string
  ) {
    // Find assignment
    const assignment = await prisma.staffBranch.findFirst({
      where: {
        userId: doctorId,
        branchId,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        branch: true,
      },
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Assignment tidak ditemukan');
    }

    // Authorization check
    if (requestingUserRole === 'ADMIN_MANAGER') {
      // Check if Admin Manager manages this branch
      const managesBranch = await prisma.managerBranch.findFirst({
        where: {
          userId: requestingUserId,
          branchId,
        },
      });

      if (!managesBranch) {
        throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses untuk manage cabang ini');
      }
    }

    // Delete assignment
    await prisma.staffBranch.delete({
      where: {
        id: assignment.id,
      },
    });

    // Audit log
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { profile: true },
    });

    await logAudit({
      userId: requestingUserId,
      branchId,
      action: 'DELETE',
      resource: 'STAFF_BRANCH_ASSIGNMENT',
      resourceId: assignment.id,
      meta: {
        action: 'REMOVE_DOCTOR_FROM_BRANCH',
        targetUserId: doctorId,
        branchName: assignment.branch.name,
        doctorName: assignment.user.profile?.fullName,
        managerName: requestingUser?.profile?.fullName,
      },
    });

    return {
      success: true,
      message: 'Dokter berhasil di-remove dari cabang',
    };
  }

  /**
   * Get managed branches for Admin Manager
   * @param managerId Admin Manager user ID
   * @param includeStats Include branch statistics
   */
  async getManagedBranches(managerId: string, includeStats: boolean = false) {
    const managerBranches = await prisma.managerBranch.findMany({
      where: {
        userId: managerId,
        branch: { isActive: true },
      },
      include: {
        branch: {
          include: {
            users: includeStats
              ? {
                  where: {
                    isActive: true,
                  },
                  select: {
                    role: true,
                  },
                }
              : false,
            members: includeStats
              ? {
                  where: {
                    isActive: true,
                  },
                  select: {
                    id: true,
                  },
                }
              : false,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get staff branch stats separately if needed
    const results = await Promise.all(
      managerBranches.map(async (mb, index) => {
        let stats;
        if (includeStats) {
          const staffBranches = await prisma.staffBranch.findMany({
            where: {
              branchId: mb.branch.id,
            },
            include: {
              user: {
                select: {
                  role: true,
                },
              },
            },
          });

          stats = {
            doctorCount: staffBranches.filter((sb) => sb.user.role === 'DOCTOR').length,
            nurseCount: staffBranches.filter((sb) => sb.user.role === 'NURSE').length,
            memberCount: mb.branch.members?.length || 0,
          };
        }

        return {
          branchId: mb.branch.id,
          branchName: mb.branch.name,
          branchCode: mb.branch.branchCode,
          address: mb.branch.address,
          type: mb.branch.type,
          accessScope: mb.accessScope,
          isPrimary: index === 0, // First branch is considered primary
          addedAt: mb.createdAt.toISOString(),
          ...(stats ? { stats } : {}),
        };
      })
    );

    return { branches: results };
  }

  /**
   * Add branch to Admin Manager's managed list
   * @param managerId Admin Manager user ID
   * @param branchId Branch ID to add
   */
  async addManagedBranch(managerId: string, branchId: string) {
    // Check if branch exists
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        isActive: true,
      },
    });

    if (!branch) {
      throw new AppError(404, 'NOT_FOUND', 'Cabang tidak ditemukan atau tidak aktif');
    }

    // Check if already managing
    const existingManagement = await prisma.managerBranch.findFirst({
      where: {
        userId: managerId,
        branchId,
      },
    });

    if (existingManagement) {
      throw new AppError(400, 'BAD_REQUEST', 'Anda sudah mengelola cabang ini');
    }

    // Get original manager (if any)
    const originalManager = await prisma.managerBranch.findFirst({
      where: {
        branchId,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Add branch to manager's list
    const management = await prisma.managerBranch.create({
      data: {
        userId: managerId,
        branchId,
      },
    });

    // Audit log
    await logAudit({
      userId: managerId,
      branchId,
      action: 'CREATE',
      resource: 'MANAGER_BRANCH',
      resourceId: management.id,
      meta: {
        action: 'ADD_MANAGED_BRANCH',
        branchName: branch.name,
        originalManager: originalManager
          ? {
              userId: originalManager.user.id,
              name: originalManager.user.profile?.fullName,
            }
          : null,
      },
    });

    return {
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.branchCode,
      addedAt: management.createdAt.toISOString(),
      originalManager: originalManager
        ? {
            userId: originalManager.user.id,
            fullName: originalManager.user.profile?.fullName || 'N/A',
          }
        : null,
    };
  }

  /**
   * Remove branch from Admin Manager's managed list
   * @param managerId Admin Manager user ID
   * @param branchId Branch ID to remove
   */
  async removeManagedBranch(managerId: string, branchId: string) {
    // Find management record
    const management = await prisma.managerBranch.findFirst({
      where: {
        userId: managerId,
        branchId,
      },
      include: {
        branch: true,
      },
    });

    if (!management) {
      throw new AppError(404, 'NOT_FOUND', 'Cabang tidak ada dalam daftar kelola Anda');
    }

    // Check if this is the primary branch (first created)
    const allManaged = await prisma.managerBranch.findMany({
      where: {
        userId: managerId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (allManaged.length > 0 && allManaged[0].id === management.id) {
      throw new AppError(400, 'BAD_REQUEST', 'Tidak dapat menghapus cabang utama');
    }

    // Delete management record
    await prisma.managerBranch.delete({
      where: {
        id: management.id,
      },
    });

    // Audit log
    await logAudit({
      userId: managerId,
      branchId,
      action: 'DELETE',
      resource: 'MANAGER_BRANCH',
      resourceId: management.id,
      meta: {
        action: 'REMOVE_MANAGED_BRANCH',
        branchName: management.branch.name,
      },
    });

    return {
      success: true,
      message: 'Cabang berhasil dihapus dari daftar kelola Anda',
    };
  }
}


