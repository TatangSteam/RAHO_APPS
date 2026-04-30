import { prisma } from '../../../lib/prisma';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';

export interface ExportOptions {
  fields: {
    basicInfo?: boolean;
    contactInfo?: boolean;
    medicalInfo?: boolean;
    packages?: boolean;
    sessions?: boolean;
    diagnosis?: boolean;
  };
  format: 'csv' | 'json' | 'xlsx';
  search?: string;
  status?: string;
}

export class MemberExportService {
  async exportMembers(
    userId: string,
    role: Role,
    branchId: string | null,
    options: ExportOptions
  ) {
    // Build where clause based on role
    const where: any = { isActive: true };

    if (role === Role.SUPER_ADMIN || role === Role.ADMIN_MANAGER) {
      // Can see all members
    } else if (role === Role.ADMIN_CABANG || role === Role.ADMIN_LAYANAN) {
      // Branch admin can only see members from their branch
      if (!branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Branch ID diperlukan' };
      }
      where.OR = [
        { registrationBranchId: branchId },
        { branchAccesses: { some: { branchId } } },
      ];
    }

    // Search filter
    if (options.search) {
      const searchConditions = [
        { memberNo: { contains: options.search, mode: 'insensitive' } },
        {
          user: {
            profile: {
              fullName: { contains: options.search, mode: 'insensitive' },
            },
          },
        },
      ];

      if (where.OR && where.OR.length > 0) {
        const branchConditions = where.OR;
        where.AND = [{ OR: branchConditions }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Status filter
    if (options.status) {
      where.isActive = options.status === 'active';
    }

    // Fetch members with selected data
    const members = await prisma.member.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: true,
        branchAccesses: {
          include: {
            branch: true,
          },
        },
        memberPackages: options.fields.packages
          ? {
              include: {
                packagePricing: true,
                branch: true,
              },
            }
          : false,
        encounters: options.fields.sessions
          ? {
              include: {
                sessions: {
                  include: {
                    therapyPlan: true,
                    infusion: true,
                    vitalSigns: true,
                  },
                },
              },
            }
          : false,
        diagnoses: options.fields.diagnosis
          ? true
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform data based on selected fields
    const exportData = members.map((member) => {
      const data: any = {};

      // Basic Info
      if (options.fields.basicInfo) {
        data['No. Member'] = member.memberNo;
        data['Nama Lengkap'] = member.user.profile?.fullName || '';
        data['NIK'] = member.nik || '';
        data['Tempat Lahir'] = member.tempatLahir || '';
        data['Tanggal Lahir'] = member.dateOfBirth
          ? new Date(member.dateOfBirth).toLocaleDateString('id-ID')
          : '';
        data['Jenis Kelamin'] = member.jenisKelamin || '';
        data['Status Nikah'] = member.statusNikah || '';
        data['Pekerjaan'] = member.pekerjaan || '';
        data['Cabang Registrasi'] = member.registrationBranch.name;
        data['Status'] = member.isActive ? 'Aktif' : 'Nonaktif';
        data['Tanggal Registrasi'] = new Date(member.createdAt).toLocaleDateString('id-ID');
      }

      // Contact Info
      if (options.fields.contactInfo) {
        data['Telepon'] = member.user.profile?.phone || '';
        data['Email'] = member.user.email || '';
        data['Alamat'] = member.address || '';
        data['Kode Pos'] = member.postalCode || '';
        data['Kontak Darurat'] = member.emergencyContact || '';
      }

      // Medical Info
      if (options.fields.medicalInfo) {
        data['Sumber Info RAHO'] = member.sumberInfoRaho || '';
        data['Persetujuan Foto'] = member.isConsentToPhoto ? 'Ya' : 'Tidak';
      }

      // Packages
      if (options.fields.packages && member.memberPackages) {
        const activePackages = member.memberPackages.filter((p) => p.status === 'ACTIVE');
        data['Total Paket Aktif'] = activePackages.length;
        data['Total Sesi Tersisa'] = activePackages.reduce(
          (sum, p) => sum + (p.totalSessions - p.usedSessions),
          0
        );
        data['Detail Paket'] = activePackages
          .map(
            (p) =>
              `${p.packageCode} (${p.packageType}, ${p.totalSessions - p.usedSessions}/${p.totalSessions} sesi)`
          )
          .join('; ');
      }

      // Sessions
      if (options.fields.sessions && member.encounters) {
        const allSessions = member.encounters.flatMap((e: any) => e.sessions || []);
        data['Total Sesi Terapi'] = allSessions.length;
        data['Sesi Selesai'] = allSessions.filter((s: any) => s.isCompleted).length;
        data['Sesi Terakhir'] = allSessions.length > 0
          ? new Date(allSessions[0].treatmentDate).toLocaleDateString('id-ID')
          : '';
      }

      // Diagnosis
      if (options.fields.diagnosis && member.diagnoses) {
        data['Total Diagnosis'] = member.diagnoses.length;
        data['Diagnosis Terakhir'] = member.diagnoses.length > 0
          ? member.diagnoses[0].diagnosa
          : '';
        data['Kategori Diagnosis'] = member.diagnoses.length > 0
          ? member.diagnoses[0].kategoriDiagnosa || ''
          : '';
      }

      return data;
    });

    return exportData;
  }

  generateCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvRows = [
      headers.join(','), // Header row
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes if contains comma or newline
            const escaped = String(value).replace(/"/g, '""');
            return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  }

  async generateXLSX(data: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Member');

    if (data.length === 0) {
      return Buffer.from('');
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);

    // Add header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => row[header] || '');
      worksheet.addRow(values);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? String(cell.value).length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50); // Max width 50
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
