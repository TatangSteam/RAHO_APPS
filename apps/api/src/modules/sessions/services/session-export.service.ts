// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';

export interface SessionExportOptions {
  fields: Record<string, boolean>;
  format: 'csv' | 'json' | 'xlsx';
  filters?: {
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    pelaksanaan?: string;
    doctorId?: string;
    nurseId?: string;
    memberId?: string;
  };
  groupBy?: 'date' | 'member' | 'doctor' | 'none';
}

// Helper function to get vital sign value
function getVitalValue(vitalSigns: any[], pencatatan: string, waktuCatat: string): string {
  if (!vitalSigns) return '-';
  const vital = vitalSigns.find((v: any) => v.pencatatan === pencatatan && v.waktuCatat === waktuCatat);
  return vital ? `${vital.value} ${vital.unit || ''}`.trim() : '-';
}

export class SessionExportService {
  // Field mapping for export
  private getFieldMapping(): Record<string, { label: string; getter: (session: any) => any }> {
    return {
      sessionCode: { label: 'Kode Sesi', getter: (s) => s.sessionCode },
      treatmentDate: { label: 'Tanggal Terapi', getter: (s) => new Date(s.treatmentDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) },
      treatmentTime: { label: 'Waktu Terapi', getter: (s) => new Date(s.treatmentDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
      status: { label: 'Status', getter: (s) => s.isCompleted ? 'Selesai' : 'Belum Selesai' },
      pelaksanaan: { label: 'Tipe Pelaksanaan', getter: (s) => s.pelaksanaan === 'ON_SITE' ? 'On Site' : 'Home Care' },
      infusKe: { label: 'Infus Ke', getter: (s) => s.infusKe },
      branchName: { label: 'Nama Cabang', getter: (s) => s.branch?.name || '-' },
      branchCode: { label: 'Kode Cabang', getter: (s) => s.branch?.branchCode || '-' },
      boosterType: { label: 'Tipe Booster', getter: (s) => s.boosterPackage?.boosterType || '-' },
      memberNo: { label: 'No. Member', getter: (s) => s.encounter?.member?.memberNo || '-' },
      memberName: { label: 'Nama Member', getter: (s) => s.encounter?.member?.user?.profile?.fullName || '-' },
      memberPhone: { label: 'Telepon Member', getter: (s) => s.encounter?.member?.user?.profile?.phone || '-' },
      memberEmail: { label: 'Email Member', getter: (s) => s.encounter?.member?.user?.email || '-' },
      packageCode: { label: 'Kode Paket', getter: (s) => s.encounter?.memberPackage?.packageCode || '-' },
      adminLayanan: { label: 'Admin Layanan', getter: (s) => s.adminLayanan?.profile?.fullName || '-' },
      doctorName: { label: 'Nama Dokter Utama', getter: (s) => s.doctor?.profile?.fullName || '-' },
      doctorCode: { label: 'Kode Dokter', getter: (s) => s.doctor?.staffCode || '-' },
      nurseName: { label: 'Nama Nakes Utama', getter: (s) => s.nurse?.profile?.fullName || '-' },
      nurseCode: { label: 'Kode Nakes', getter: (s) => s.nurse?.staffCode || '-' },
      allDoctors: { label: 'Semua Dokter', getter: (s) => s.sessionDoctors?.map((sd: any) => sd.doctor?.profile?.fullName || '').join(', ') || '-' },
      allNurses: { label: 'Semua Nakes', getter: (s) => s.sessionNurses?.map((sn: any) => sn.nurse?.profile?.fullName || '').join(', ') || '-' },
      sistolBefore: { label: 'Sistol (Sebelum)', getter: (s) => getVitalValue(s.vitalSigns, 'SISTOL', 'SEBELUM') },
      diastolBefore: { label: 'Diastol (Sebelum)', getter: (s) => getVitalValue(s.vitalSigns, 'DIASTOL', 'SEBELUM') },
      hrBefore: { label: 'Heart Rate (Sebelum)', getter: (s) => getVitalValue(s.vitalSigns, 'HR', 'SEBELUM') },
      saturasiBefore: { label: 'Saturasi O2 (Sebelum)', getter: (s) => getVitalValue(s.vitalSigns, 'SATURASI', 'SEBELUM') },
      piBefore: { label: 'PI (Sebelum)', getter: (s) => getVitalValue(s.vitalSigns, 'PI', 'SEBELUM') },
      sistolAfter: { label: 'Sistol (Sesudah)', getter: (s) => getVitalValue(s.vitalSigns, 'SISTOL', 'SESUDAH') },
      diastolAfter: { label: 'Diastol (Sesudah)', getter: (s) => getVitalValue(s.vitalSigns, 'DIASTOL', 'SESUDAH') },
      hrAfter: { label: 'Heart Rate (Sesudah)', getter: (s) => getVitalValue(s.vitalSigns, 'HR', 'SESUDAH') },
      saturasiAfter: { label: 'Saturasi O2 (Sesudah)', getter: (s) => getVitalValue(s.vitalSigns, 'SATURASI', 'SESUDAH') },
      piAfter: { label: 'PI (Sesudah)', getter: (s) => getVitalValue(s.vitalSigns, 'PI', 'SESUDAH') },
      planIfa: { label: 'Plan - IFA', getter: (s) => s.therapyPlan?.ifa ?? '-' },
      planHho: { label: 'Plan - HHO', getter: (s) => s.therapyPlan?.hho ?? '-' },
      planH2: { label: 'Plan - H2', getter: (s) => s.therapyPlan?.h2 ?? '-' },
      planNo: { label: 'Plan - NO', getter: (s) => s.therapyPlan?.no ?? '-' },
      planGaso: { label: 'Plan - GASO', getter: (s) => s.therapyPlan?.gaso ?? '-' },
      planO2: { label: 'Plan - O2', getter: (s) => s.therapyPlan?.o2 ?? '-' },
      planO3: { label: 'Plan - O3', getter: (s) => s.therapyPlan?.o3 ?? '-' },
      planEdta: { label: 'Plan - EDTA', getter: (s) => s.therapyPlan?.edta ?? '-' },
      planMb: { label: 'Plan - MB', getter: (s) => s.therapyPlan?.mb ?? '-' },
      planH2s: { label: 'Plan - H2S', getter: (s) => s.therapyPlan?.h2s ?? '-' },
      planKcl: { label: 'Plan - KCL', getter: (s) => s.therapyPlan?.kcl ?? '-' },
      planJmlNb: { label: 'Plan - JML NB', getter: (s) => s.therapyPlan?.jmlNb ?? '-' },
      planKeterangan: { label: 'Plan - Keterangan', getter: (s) => s.therapyPlan?.keterangan ?? '-' },
      aktualIfa: { label: 'Aktual - IFA', getter: (s) => s.infusion?.ifa ?? '-' },
      aktualHho: { label: 'Aktual - HHO', getter: (s) => s.infusion?.hho ?? '-' },
      aktualH2: { label: 'Aktual - H2', getter: (s) => s.infusion?.h2 ?? '-' },
      aktualNo: { label: 'Aktual - NO', getter: (s) => s.infusion?.no ?? '-' },
      aktualGaso: { label: 'Aktual - GASO', getter: (s) => s.infusion?.gaso ?? '-' },
      aktualO2: { label: 'Aktual - O2', getter: (s) => s.infusion?.o2 ?? '-' },
      aktualO3: { label: 'Aktual - O3', getter: (s) => s.infusion?.o3 ?? '-' },
      aktualEdta: { label: 'Aktual - EDTA', getter: (s) => s.infusion?.edta ?? '-' },
      aktualMb: { label: 'Aktual - MB', getter: (s) => s.infusion?.mb ?? '-' },
      aktualH2s: { label: 'Aktual - H2S', getter: (s) => s.infusion?.h2s ?? '-' },
      aktualKcl: { label: 'Aktual - KCL', getter: (s) => s.infusion?.kcl ?? '-' },
      aktualJmlNb: { label: 'Aktual - JML NB', getter: (s) => s.infusion?.jmlNb ?? '-' },
      bottleType: { label: 'Jenis Botol', getter: (s) => s.infusion?.bottleType ?? '-' },
      jenisCairan: { label: 'Jenis Cairan', getter: (s) => s.infusion?.jenisCairan ?? '-' },
      volumeCarrier: { label: 'Volume Carrier', getter: (s) => s.infusion?.volumeCarrier ?? '-' },
      jumlahJarum: { label: 'Jumlah Jarum', getter: (s) => s.infusion?.jumlahJarum ?? '-' },
      deviationNotes: { label: 'Catatan Deviasi', getter: (s) => s.infusion?.deviationNotes ?? '-' },
      materialsSummary: { label: 'Ringkasan Material', getter: (s) => s.materials?.map((m: any) => `${m.inventoryItem?.masterProduct?.name || 'Unknown'}: ${m.quantity} ${m.unit}`).join('; ') || '-' },
      subjective: { label: 'Subjective', getter: (s) => s.evaluation?.subjective ?? '-' },
      objective: { label: 'Objective', getter: (s) => s.evaluation?.objective ?? '-' },
      assessment: { label: 'Assessment', getter: (s) => s.evaluation?.assessment ?? '-' },
      plan: { label: 'Plan', getter: (s) => s.evaluation?.plan ?? '-' },
      generalNotes: { label: 'Catatan Umum', getter: (s) => s.evaluation?.generalNotes ?? '-' },
    };
  }

  async exportSessions(
    userId: string,
    role: Role,
    branchId: string | null,
    options: SessionExportOptions
  ) {
    // Build where clause based on role
    const where: any = {};

    if (role === Role.SUPER_ADMIN || role === Role.ADMIN_MANAGER) {
      // Can see all sessions
    } else if (role === Role.ADMIN_CABANG || role === Role.ADMIN_LAYANAN) {
      // Branch staff can only see sessions from their branch
      if (!branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Branch ID diperlukan' };
      }
      where.branchId = branchId;
    } else if (role === Role.DOCTOR) {
      where.doctorId = userId;
    } else if (role === Role.NURSE) {
      where.nurseId = userId;
    }

    // Apply filters
    if (options.filters) {
      if (options.filters.dateFrom || options.filters.dateTo) {
        where.treatmentDate = {};
        if (options.filters.dateFrom) {
          where.treatmentDate.gte = new Date(options.filters.dateFrom);
        }
        if (options.filters.dateTo) {
          where.treatmentDate.lte = new Date(options.filters.dateTo);
        }
      }

      if (options.filters.status) {
        where.isCompleted = options.filters.status === 'completed';
      }

      if (options.filters.pelaksanaan) {
        where.pelaksanaan = options.filters.pelaksanaan;
      }

      if (options.filters.doctorId) {
        where.doctorId = options.filters.doctorId;
      }

      if (options.filters.nurseId) {
        where.nurseId = options.filters.nurseId;
      }

      // Branch filter for SUPER_ADMIN and ADMIN_MANAGER
      if (options.filters.branchId && (role === Role.SUPER_ADMIN || role === Role.ADMIN_MANAGER)) {
        where.branchId = options.filters.branchId;
      }

      if (options.filters.memberId) {
        where.encounter = {
          memberId: options.filters.memberId,
          memberPackage: {
            packageType: 'BASIC', // Only export BASIC packages
          },
        };
      } else {
        // If no memberId filter, still filter by BASIC packages
        where.encounter = {
          memberPackage: {
            packageType: 'BASIC',
          },
        };
      }
    } else {
      // If no filters at all, still filter by BASIC packages
      where.encounter = {
        memberPackage: {
          packageType: 'BASIC',
        },
      };
    }

    // Fetch sessions with selected data
    const sessions = await prisma.treatmentSession.findMany({
      where,
      include: {
        encounter: {
          include: {
            member: {
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
            memberPackage: true,
          },
        },
        branch: true,
        adminLayanan: {
          include: {
            profile: true,
          },
        },
        doctor: {
          include: {
            profile: true,
          },
        },
        nurse: {
          include: {
            profile: true,
          },
        },
        // Include multiple doctors and nurses
        sessionDoctors: {
          include: {
            doctor: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        sessionNurses: {
          include: {
            nurse: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        boosterPackage: true,
        therapyPlan: true,
        vitalSigns: true,
        infusion: true,
        materials: {
          include: {
            inventoryItem: {
              include: {
                masterProduct: true,
              },
            },
          },
        },
        evaluation: true,
      },
      orderBy: { treatmentDate: 'desc' },
    });

    // Get field mapping
    const fieldMapping = this.getFieldMapping();
    
    // Get selected fields in order
    const fieldOrder = [
      'sessionCode', 'treatmentDate', 'treatmentTime', 'status', 'pelaksanaan', 'infusKe', 'branchName', 'branchCode', 'boosterType',
      'memberNo', 'memberName', 'memberPhone', 'memberEmail', 'packageCode',
      'adminLayanan', 'doctorName', 'doctorCode', 'nurseName', 'nurseCode', 'allDoctors', 'allNurses',
      'sistolBefore', 'diastolBefore', 'hrBefore', 'saturasiBefore', 'piBefore',
      'sistolAfter', 'diastolAfter', 'hrAfter', 'saturasiAfter', 'piAfter',
      'planIfa', 'planHho', 'planH2', 'planNo', 'planGaso', 'planO2', 'planO3', 'planEdta', 'planMb', 'planH2s', 'planKcl', 'planJmlNb', 'planKeterangan',
      'aktualIfa', 'aktualHho', 'aktualH2', 'aktualNo', 'aktualGaso', 'aktualO2', 'aktualO3', 'aktualEdta', 'aktualMb', 'aktualH2s', 'aktualKcl', 'aktualJmlNb', 'bottleType', 'jenisCairan', 'volumeCarrier', 'jumlahJarum', 'deviationNotes',
      'materialsSummary',
      'subjective', 'objective', 'assessment', 'plan', 'generalNotes',
    ];
    
    const selectedFields = fieldOrder.filter(key => options.fields[key] && fieldMapping[key]);

    // Transform data based on selected fields
    const exportData = sessions.map((session) => {
      const data: any = {};
      
      selectedFields.forEach(fieldKey => {
        const mapping = fieldMapping[fieldKey];
        if (mapping) {
          data[mapping.label] = mapping.getter(session);
        }
      });

      return data;
    });

    return exportData;
  }

  private groupData(exportData: any[], sessions: any[], groupBy: string) {
    return exportData;
  }

  generateCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || '';
            const escaped = String(value).replace(/"/g, '""');
            return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
          })
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  }

  async generateXLSX(data: any[], groupBy?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Sesi Terapi');

    if (data.length === 0) {
      return Buffer.from('');
    }

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
      column.width = Math.min(maxLength + 2, 50);
    });

    // Add borders
    worksheet.eachRow((row) => {
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

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
