import { prisma } from '../../../lib/prisma';
import { Role, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

// ============================================================
// TYPES
// ============================================================

export interface ExportFilters {
  branchIds?: string[];
  status?: string;
  dateRange?: { start?: string; end?: string };
  packageTypes?: string[];
  gender?: string;
  ageRange?: { min?: number | null; max?: number | null };
  referralCodeId?: string;
  search?: string;
  preset?: string;
}

export interface ExportOptions {
  columns: string[];
  groupBy?: 'none' | 'branch' | 'packageType' | 'registrationMonth' | 'gender' | 'referral';
  sortBy?: 'memberNo' | 'fullName' | 'createdAt' | 'lastTherapyDate';
  sortOrder?: 'asc' | 'desc';
  includeSubtotals?: boolean;
  includeGrandTotal?: boolean;
}

export interface ExportPayload {
  filters: ExportFilters;
  options: ExportOptions;
  format: 'csv' | 'xlsx';
}

// Column definitions for mapping
const COLUMN_MAPPINGS: Record<string, (member: any) => any> = {
  memberNo: (m) => m.memberNo,
  fullName: (m) => m.user?.profile?.fullName || '',
  nik: (m) => m.nik || '',
  birthPlace: (m) => m.tempatLahir || '',
  birthDate: (m) => m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString('id-ID') : '',
  gender: (m) => m.jenisKelamin === 'L' ? 'Laki-laki' : m.jenisKelamin === 'P' ? 'Perempuan' : '',
  maritalStatus: (m) => m.statusNikah || '',
  occupation: (m) => m.pekerjaan || '',
  registrationBranch: (m) => m.registrationBranch?.name || '',
  status: (m) => m.isActive ? 'Aktif' : 'Nonaktif',
  registrationDate: (m) => new Date(m.createdAt).toLocaleDateString('id-ID'),
  phone: (m) => m.user?.profile?.phone || '',
  email: (m) => m.user?.email || '',
  address: (m) => m.address || '',
  postalCode: (m) => m.postalCode || '',
  emergencyContact: (m) => m.emergencyContact || '',
  activePackageCount: (m) => m._packageStats?.activeCount || 0,
  totalRemainingSessions: (m) => m._packageStats?.remainingSessions || 0,
  packageDetails: (m) => m._packageStats?.details || '',
  infoSource: (m) => m.sumberInfoRaho || '',
  photoConsent: (m) => m.isConsentToPhoto ? 'Ya' : 'Tidak',
  diagnosisCount: (m) => m._diagnosisStats?.count || 0,
  latestDiagnosis: (m) => m._diagnosisStats?.latest || '',
  referralCode: (m) => m.referralCode?.code || '',
  referrerName: (m) => m.referralCode?.referrerName || '',
  referrerType: (m) => m.referralCode?.referrerType || '',
  totalTherapySessions: (m) => m._therapyStats?.totalSessions || 0,
  completedSessions: (m) => m._therapyStats?.completedSessions || 0,
  lastTherapyDate: (m) => m._therapyStats?.lastDate || '',
};

const COLUMN_LABELS: Record<string, string> = {
  memberNo: 'No. Member',
  fullName: 'Nama Lengkap',
  nik: 'NIK',
  birthPlace: 'Tempat Lahir',
  birthDate: 'Tanggal Lahir',
  gender: 'Jenis Kelamin',
  maritalStatus: 'Status Nikah',
  occupation: 'Pekerjaan',
  registrationBranch: 'Cabang Registrasi',
  status: 'Status',
  registrationDate: 'Tanggal Registrasi',
  phone: 'Telepon',
  email: 'Email',
  address: 'Alamat',
  postalCode: 'Kode Pos',
  emergencyContact: 'Kontak Darurat',
  activePackageCount: 'Jumlah Paket Aktif',
  totalRemainingSessions: 'Total Sesi Tersisa',
  packageDetails: 'Detail Paket',
  infoSource: 'Sumber Info RAHO',
  photoConsent: 'Persetujuan Foto',
  diagnosisCount: 'Jumlah Diagnosis',
  latestDiagnosis: 'Diagnosis Terakhir',
  referralCode: 'Kode Referral',
  referrerName: 'Nama Referrer',
  referrerType: 'Tipe Referrer',
  totalTherapySessions: 'Total Sesi Terapi',
  completedSessions: 'Sesi Selesai',
  lastTherapyDate: 'Tanggal Terapi Terakhir',
};

// ============================================================
// SERVICE CLASS
// ============================================================

export class MemberExportService {
  /**
   * Build where clause based on role and filters
   */
  private buildWhereClause(
    role: Role,
    branchId: string | null,
    userId: string,
    filters: ExportFilters
  ): Prisma.MemberWhereInput {
    const where: Prisma.MemberWhereInput = {};
    const andConditions: Prisma.MemberWhereInput[] = [];

    // Role-based access control
    if (role === Role.SUPER_ADMIN) {
      // Can see all members
    } else if (role === Role.ADMIN_MANAGER) {
      // Get branches managed by this manager
      andConditions.push({
        OR: [
          {
            registrationBranch: {
              managerBranches: {
                some: { userId },
              },
            },
          },
          {
            branchAccesses: {
              some: {
                branch: {
                  managerBranches: {
                    some: { userId },
                  },
                },
              },
            },
          },
        ],
      });
    } else if (role === Role.ADMIN_CABANG || role === Role.ADMIN_LAYANAN) {
      if (!branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Branch ID diperlukan' };
      }
      andConditions.push({
        OR: [
          { registrationBranchId: branchId },
          { branchAccesses: { some: { branchId } } },
        ],
      });
    }

    // Branch filter
    if (filters.branchIds && filters.branchIds.length > 0) {
      andConditions.push({
        OR: [
          { registrationBranchId: { in: filters.branchIds } },
          { branchAccesses: { some: { branchId: { in: filters.branchIds } } } },
        ],
      });
    }

    // Status filter
    if (filters.status) {
      where.isActive = filters.status === 'active';
    }

    // Gender filter
    if (filters.gender) {
      where.jenisKelamin = filters.gender as 'L' | 'P';
    }

    // Date range filter (registration date)
    if (filters.dateRange?.start || filters.dateRange?.end) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.dateRange.start) {
        dateFilter.gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        dateFilter.lte = new Date(filters.dateRange.end + 'T23:59:59.999Z');
      }
      where.createdAt = dateFilter;
    }

    // Age range filter
    if (filters.ageRange?.min !== null || filters.ageRange?.max !== null) {
      const today = new Date();
      const dateFilter: Prisma.DateTimeNullableFilter = {};
      
      if (filters.ageRange?.max !== null && filters.ageRange?.max !== undefined) {
        // Max age means minimum birth date
        const minBirthDate = new Date(today);
        minBirthDate.setFullYear(today.getFullYear() - filters.ageRange.max - 1);
        dateFilter.gte = minBirthDate;
      }
      
      if (filters.ageRange?.min !== null && filters.ageRange?.min !== undefined) {
        // Min age means maximum birth date
        const maxBirthDate = new Date(today);
        maxBirthDate.setFullYear(today.getFullYear() - filters.ageRange.min);
        dateFilter.lte = maxBirthDate;
      }
      
      if (Object.keys(dateFilter).length > 0) {
        where.dateOfBirth = dateFilter;
      }
    }

    // Search filter
    if (filters.search) {
      andConditions.push({
        OR: [
          { memberNo: { contains: filters.search, mode: 'insensitive' } },
          { user: { profile: { fullName: { contains: filters.search, mode: 'insensitive' } } } },
          { user: { profile: { phone: { contains: filters.search, mode: 'insensitive' } } } },
        ],
      });
    }

    // Package type filter
    if (filters.packageTypes && filters.packageTypes.length > 0) {
      andConditions.push({
        memberPackages: {
          some: {
            packageType: { in: filters.packageTypes as any },
            status: 'ACTIVE',
          },
        },
      });
    }

    // Referral filter
    if (filters.referralCodeId) {
      where.referralCodeId = filters.referralCodeId;
    }

    // Combine conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  /**
   * Get preview count for export
   */
  async getPreviewCount(
    userId: string,
    role: Role,
    branchId: string | null,
    filters: ExportFilters
  ): Promise<number> {
    const where = this.buildWhereClause(role, branchId, userId, filters);
    return prisma.member.count({ where });
  }

  /**
   * Export members with advanced options
   */
  async exportMembers(
    userId: string,
    role: Role,
    branchId: string | null,
    payload: ExportPayload
  ) {
    const { filters, options } = payload;
    const where = this.buildWhereClause(role, branchId, userId, filters);

    // Determine what to include based on selected columns
    const needsPackages = options.columns.some(c => 
      ['activePackageCount', 'totalRemainingSessions', 'packageDetails'].includes(c)
    );
    const needsSessions = options.columns.some(c => 
      ['totalTherapySessions', 'completedSessions', 'lastTherapyDate'].includes(c)
    );
    const needsDiagnosis = options.columns.some(c => 
      ['diagnosisCount', 'latestDiagnosis'].includes(c)
    );
    const needsReferral = options.columns.some(c => 
      ['referralCode', 'referrerName', 'referrerType'].includes(c)
    );

    // Build order by
    const orderBy: Prisma.MemberOrderByWithRelationInput[] = [];
    if (options.sortBy === 'fullName') {
      orderBy.push({ user: { profile: { fullName: options.sortOrder || 'asc' } } });
    } else if (options.sortBy === 'createdAt') {
      orderBy.push({ createdAt: options.sortOrder || 'desc' });
    } else {
      orderBy.push({ memberNo: options.sortOrder || 'asc' });
    }

    // Fetch members
    const members = await prisma.member.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: true,
        branchAccesses: needsPackages ? {
          include: { branch: true },
        } : false,
        memberPackages: needsPackages ? {
          where: { status: 'ACTIVE' },
          include: { packagePricing: true },
        } : false,
        referralCode: needsReferral ? true : false,
        diagnoses: needsDiagnosis ? {
          orderBy: { createdAt: 'desc' },
          take: 1,
        } : false,
      },
      orderBy,
    });

    // Fetch session stats if needed
    let sessionStats: Map<string, { total: number; completed: number; lastDate: string | null }> = new Map();
    if (needsSessions) {
      const memberIds = members.map(m => m.id);
      
      // Get detailed session data per member via encounters
      const encounters = await prisma.encounter.findMany({
        where: {
          memberId: { in: memberIds },
        },
        include: {
          sessions: {
            select: {
              id: true,
              isCompleted: true,
              treatmentDate: true,
            },
            orderBy: { treatmentDate: 'desc' },
          },
        },
      });

      // Aggregate by member
      encounters.forEach(encounter => {
        const memberId = encounter.memberId;
        const existing = sessionStats.get(memberId) || { total: 0, completed: 0, lastDate: null };
        
        encounter.sessions.forEach(session => {
          existing.total++;
          if (session.isCompleted) existing.completed++;
          if (!existing.lastDate || new Date(session.treatmentDate) > new Date(existing.lastDate)) {
            existing.lastDate = new Date(session.treatmentDate).toLocaleDateString('id-ID');
          }
        });
        
        sessionStats.set(memberId, existing);
      });
    }

    // Transform data
    const exportData = members.map((member: any) => {
      // Add computed stats
      if (needsPackages) {
        const activePackages = member.memberPackages || [];
        member._packageStats = {
          activeCount: activePackages.length,
          remainingSessions: activePackages.reduce(
            (sum: number, p: any) => sum + (p.totalSessions - p.usedSessions),
            0
          ),
          details: activePackages
            .map((p: any) => `${p.packageCode} (${p.packageType}, ${p.totalSessions - p.usedSessions}/${p.totalSessions})`)
            .join('; '),
        };
      }

      if (needsSessions) {
        const stats = sessionStats.get(member.id);
        member._therapyStats = {
          totalSessions: stats?.total || 0,
          completedSessions: stats?.completed || 0,
          lastDate: stats?.lastDate || '',
        };
      }

      if (needsDiagnosis) {
        const diagnoses = member.diagnoses || [];
        member._diagnosisStats = {
          count: diagnoses.length,
          latest: diagnoses.length > 0 ? diagnoses[0].diagnosa : '',
        };
      }

      // Build row data based on selected columns
      const row: Record<string, any> = {};
      options.columns.forEach(col => {
        const mapper = COLUMN_MAPPINGS[col];
        if (mapper) {
          row[COLUMN_LABELS[col] || col] = mapper(member);
        }
      });

      // Add grouping key if needed
      if (options.groupBy && options.groupBy !== 'none') {
        row._groupKey = this.getGroupKey(member, options.groupBy);
      }

      return row;
    });

    return exportData;
  }

  /**
   * Get group key for a member
   */
  private getGroupKey(member: any, groupBy: string): string {
    switch (groupBy) {
      case 'branch':
        return member.registrationBranch?.name || 'Tidak Ada Cabang';
      case 'packageType':
        const packages = member.memberPackages || [];
        if (packages.length === 0) return 'Tidak Ada Paket';
        const types = [...new Set(packages.map((p: any) => p.packageType))];
        return types.join(', ');
      case 'registrationMonth':
        const date = new Date(member.createdAt);
        return `${date.toLocaleString('id-ID', { month: 'long' })} ${date.getFullYear()}`;
      case 'gender':
        return member.jenisKelamin === 'L' ? 'Laki-laki' : 
               member.jenisKelamin === 'P' ? 'Perempuan' : 'Tidak Diketahui';
      case 'referral':
        return member.referralCode?.code || 'Tanpa Referral';
      default:
        return '';
    }
  }

  /**
   * Generate CSV from data
   */
  generateCSV(data: any[], options: ExportOptions): string {
    if (data.length === 0) return '';

    // Remove internal keys
    const cleanData = data.map(row => {
      const clean = { ...row };
      delete clean._groupKey;
      return clean;
    });

    const headers = Object.keys(cleanData[0]);
    const csvRows = [
      headers.join(','),
      ...cleanData.map(row =>
        headers
          .map(header => {
            const value = row[header] || '';
            const escaped = String(value).replace(/"/g, '""');
            return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  }

  /**
   * Generate XLSX with grouping and totals
   */
  async generateXLSX(data: any[], options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Member');

    if (data.length === 0) {
      worksheet.addRow(['Tidak ada data']);
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    // Get headers (exclude internal keys)
    const headers = Object.keys(data[0]).filter(h => !h.startsWith('_'));

    // Style definitions
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }, // Amber
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const groupHeaderStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FF000000' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }, // Light amber
      alignment: { vertical: 'middle' },
    };

    const subtotalStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, italic: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
    };

    const grandTotalStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } },
      alignment: { vertical: 'middle' },
    };

    // Add header row
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell(cell => {
      Object.assign(cell, { style: headerStyle });
    });
    headerRow.height = 25;

    // Group data if needed
    if (options.groupBy && options.groupBy !== 'none') {
      const grouped = new Map<string, any[]>();
      data.forEach(row => {
        const key = row._groupKey || 'Lainnya';
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(row);
      });

      let grandTotal = 0;

      // Add grouped data
      grouped.forEach((rows, groupName) => {
        // Group header
        const groupRow = worksheet.addRow([`📁 ${groupName} (${rows.length} member)`]);
        groupRow.getCell(1).style = groupHeaderStyle;
        worksheet.mergeCells(groupRow.number, 1, groupRow.number, headers.length);

        // Data rows
        rows.forEach(row => {
          const values = headers.map(h => row[h] || '');
          const dataRow = worksheet.addRow(values);
          dataRow.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
          });
        });

        // Subtotal
        if (options.includeSubtotals) {
          const subtotalRow = worksheet.addRow([`Subtotal: ${rows.length} member`]);
          subtotalRow.getCell(1).style = subtotalStyle;
          worksheet.mergeCells(subtotalRow.number, 1, subtotalRow.number, headers.length);
        }

        grandTotal += rows.length;
      });

      // Grand total
      if (options.includeGrandTotal) {
        worksheet.addRow([]); // Empty row
        const totalRow = worksheet.addRow([`GRAND TOTAL: ${grandTotal} member`]);
        totalRow.getCell(1).style = grandTotalStyle;
        worksheet.mergeCells(totalRow.number, 1, totalRow.number, headers.length);
      }
    } else {
      // No grouping - just add data rows
      data.forEach(row => {
        const values = headers.map(h => row[h] || '');
        const dataRow = worksheet.addRow(values);
        dataRow.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
        });
      });

      // Grand total
      if (options.includeGrandTotal) {
        worksheet.addRow([]);
        const totalRow = worksheet.addRow([`TOTAL: ${data.length} member`]);
        totalRow.getCell(1).style = grandTotalStyle;
        worksheet.mergeCells(totalRow.number, 1, totalRow.number, headers.length);
      }
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? String(cell.value).length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
