import { prisma } from '../../../lib/prisma';
import { Prisma, ProductCategory } from '@prisma/client';

export interface MaterialUsageHistoryFilters {
  branchId?: string;
  branchIds?: string[];
  staffId?: string;
  staffGroupId?: string;
  startDate?: Date;
  endDate?: Date;
  productName?: string;
  category?: ProductCategory;
}

export interface MaterialUsageHistoryItem {
  id: string;
  date: Date;
  branchId: string;
  branchName: string;
  branchCode: string;
  productName: string;
  productCategory: ProductCategory;
  quantity: number;
  unit: string;
  staffName: string;
  staffGroup: string;
  staffRole: string;
  doctorName: string;
  adminLayananName: string;
  nurseName: string;
  sessionCode: string;
  notes: string | null;
}

export class MaterialUsageHistoryService {
  /**
   * Get material usage history with filters
   */
  async getMaterialUsageHistory(filters: MaterialUsageHistoryFilters) {
    const {
      branchId,
      branchIds,
      staffId,
      staffGroupId,
      startDate,
      endDate,
      productName,
      category,
    } = filters;

    // Build where clause
    const where: Prisma.MaterialUsageWhereInput = {};

    // Filter by branch through session
    if (branchIds) {
      where.session = {
        branchId: { in: branchIds },
      };
    } else if (branchId) {
      where.session = {
        branchId,
      };
    }

    // Filter by staff involved in the session or the person who recorded usage.
    if (staffId) {
      where.OR = [
        { recordedBy: staffId },
        { session: { doctorId: staffId } },
        { session: { nurseId: staffId } },
        { session: { adminLayananId: staffId } },
        { session: { sessionDoctors: { some: { doctorId: staffId } } } },
        { session: { sessionNurses: { some: { nurseId: staffId } } } },
      ];
    }

    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Filter by product name
    if (productName || category) {
      where.inventoryItem = {
        masterProduct: {
          ...(productName && {
            name: {
              contains: productName,
              mode: 'insensitive',
            },
          }),
          ...(category && { category }),
        },
      };
    }

    // Get material usages
    const materialUsages = await prisma.materialUsage.findMany({
      where,
      include: {
        inventoryItem: {
          include: {
            masterProduct: true,
          },
        },
        session: {
          include: {
            branch: true,
            adminLayanan: { include: { profile: true } },
            doctor: { include: { profile: true } },
            nurse: { include: { profile: true } },
            sessionDoctors: {
              include: {
                doctor: { include: { profile: true } },
              },
            },
            sessionNurses: {
              include: {
                nurse: { include: { profile: true } },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get staff information for each usage
    const staffIds = [...new Set(materialUsages.map(usage => usage.recordedBy))];
    const staffUsers = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
      },
      include: {
        profile: true,
        branch: true,
        staffBranches: {
          include: {
            branch: true,
          },
        },
      },
    });

    // Create staff map for quick lookup
    const staffMap = new Map(
      staffUsers.map(staff => [
        staff.id,
        {
          id: staff.id,
          name: staff.profile?.fullName || 'Unknown',
          role: staff.role,
          branchName: staff.branch?.name || '',
          branchCode: staff.branch?.branchCode || '',
          staffBranches: staff.staffBranches.map(sb => ({
            branchName: sb.branch.name,
            branchCode: sb.branch.branchCode,
          })),
        },
      ])
    );

    // Filter by staff group if specified
    let filteredUsages = materialUsages;
    if (staffGroupId) {
      filteredUsages = materialUsages.filter(usage => {
        const staff = staffMap.get(usage.recordedBy);
        if (!staff) return false;
        
        // Check if staff belongs to the specified branch (group)
        return staff.branchCode === staffGroupId || 
               staff.staffBranches.some(sb => sb.branchCode === staffGroupId);
      });
    }

    // Map to result format
    const result: MaterialUsageHistoryItem[] = filteredUsages.map(usage => {
      const staff = staffMap.get(usage.recordedBy);
      const staffBranchInfo = staff?.staffBranches.length 
        ? staff.staffBranches.map(sb => sb.branchName).join(', ')
        : staff?.branchName || '-';
      const adminLayananName = usage.session.adminLayanan?.profile?.fullName || '-';
      const doctorNames = usage.session.sessionDoctors.length > 0
        ? usage.session.sessionDoctors
            .map((sessionDoctor) => sessionDoctor.doctor.profile?.fullName)
            .filter(Boolean)
            .join(', ')
        : usage.session.doctor?.profile?.fullName || '';
      const nurseNames = usage.session.sessionNurses.length > 0
        ? usage.session.sessionNurses
            .map((sessionNurse) => sessionNurse.nurse.profile?.fullName)
            .filter(Boolean)
            .join(', ')
        : usage.session.nurse?.profile?.fullName || '';
      const doctorName = doctorNames || '-';
      const nurseName = nurseNames || '-';

      return {
        id: usage.id,
        date: usage.createdAt,
        branchId: usage.session.branchId,
        branchName: usage.session.branch.name,
        branchCode: usage.session.branch.branchCode,
        productName: usage.inventoryItem.masterProduct.name,
        productCategory: usage.inventoryItem.masterProduct.category,
        quantity: Number(usage.quantity),
        unit: usage.unit,
        staffName: staff?.name || 'Unknown',
        staffGroup: staffBranchInfo,
        staffRole: this.getRoleLabel(staff?.role || 'NURSE'),
        doctorName,
        adminLayananName,
        nurseName,
        sessionCode: usage.session?.sessionCode || '-',
        notes: null,
      };
    });

    return result;
  }

  /**
   * Get list of staff members for filter dropdown
   */
  async getStaffList(branchId?: string, allowedBranchIds?: string[]) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      role: {
        in: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
      },
    };

    if (allowedBranchIds) {
      where.OR = [
        { branchId: { in: allowedBranchIds } },
        { staffBranches: { some: { branchId: { in: allowedBranchIds } } } },
      ];
    } else if (branchId) {
      where.OR = [
        { branchId },
        { staffBranches: { some: { branchId } } },
      ];
    }

    const staff = await prisma.user.findMany({
      where,
      include: {
        profile: true,
        branch: true,
        staffBranches: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: {
        profile: {
          fullName: 'asc',
        },
      },
    });

    return staff.map(s => ({
      id: s.id,
      name: s.profile?.fullName || 'Unknown',
      role: s.role,
      roleLabel: this.getRoleLabel(s.role),
      branchName: s.branch?.name || '',
      branchCode: s.branch?.branchCode || '',
      staffBranches: s.staffBranches.map(sb => ({
        branchId: sb.branchId,
        branchName: sb.branch.name,
        branchCode: sb.branch.branchCode,
      })),
    }));
  }

  /**
   * Get list of branch groups for filter dropdown
   */
  async getBranchGroups(branchIds?: string[]) {
    const branches = await prisma.branch.findMany({
      where: {
        isActive: true,
        ...(branchIds && { id: { in: branchIds } }),
      },
      orderBy: {
        name: 'asc',
      },
    });

    return branches.map(branch => ({
      id: branch.id,
      name: branch.name,
      branchCode: branch.branchCode,
      type: branch.type,
    }));
  }

  private getRoleLabel(role: string): string {
    const roleLabels: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN_MANAGER: 'Admin Manager',
      ADMIN_CABANG: 'Admin Cabang',
      ADMIN_LAYANAN: 'Admin Layanan',
      DOCTOR: 'Dokter',
      NURSE: 'Nakes',
      MEMBER: 'Member',
    };
    return roleLabels[role] || role;
  }
}
