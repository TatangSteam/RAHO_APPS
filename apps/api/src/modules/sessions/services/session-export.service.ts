// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';

export interface SessionExportOptions {
  fields: {
    basicInfo?: boolean;
    memberInfo?: boolean;
    staffInfo?: boolean;
    vitalSigns?: boolean;
    therapyPlan?: boolean;
    infusion?: boolean;
    materials?: boolean;
    evaluation?: boolean;
  };
  format: 'csv' | 'json' | 'xlsx';
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string; // completed, pending
    pelaksanaan?: string; // ON_SITE, HOME_CARE
    doctorId?: string;
    memberId?: string;
  };
  groupBy?: 'date' | 'member' | 'doctor' | 'none';
}

export class SessionExportService {
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
        boosterPackage: options.fields.basicInfo ? true : false,
        therapyPlan: options.fields.therapyPlan ? true : false,
        vitalSigns: options.fields.vitalSigns ? true : false,
        infusion: options.fields.infusion ? true : false,
        materials: options.fields.materials
          ? {
              include: {
                inventoryItem: {
                  include: {
                    masterProduct: true,
                  },
                },
              },
            }
          : false,
        evaluation: options.fields.evaluation ? true : false,
      },
      orderBy: { treatmentDate: 'desc' },
    });

    // Transform data based on selected fields
    const exportData = sessions.map((session) => {
      const data: any = {};

      // Basic Info
      if (options.fields.basicInfo) {
        data['Kode Sesi'] = session.sessionCode;
        data['Tanggal Terapi'] = new Date(session.treatmentDate).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        data['Infus Ke'] = session.infusKe;
        data['Pelaksanaan'] = session.pelaksanaan === 'ON_SITE' ? 'On Site' : 'Home Care';
        data['Status'] = session.isCompleted ? 'Selesai' : 'Pending';
        data['Cabang'] = session.branch.name;
        data['Booster'] = session.boosterPackage
          ? `${session.boosterPackage.packageCode} (${session.boosterPackage.boosterType})`
          : '-';
      }

      // Member Info
      if (options.fields.memberInfo) {
        data['No. Member'] = session.encounter.member.memberNo;
        data['Nama Member'] = session.encounter.member.user.profile?.fullName || '';
        data['Telepon Member'] = session.encounter.member.user.profile?.phone || '';
        data['Paket'] = session.encounter.memberPackage.packageCode;
      }

      // Staff Info
      if (options.fields.staffInfo) {
        data['Admin Layanan'] = session.adminLayanan.profile?.fullName || '';
        data['Dokter Utama'] = session.doctor.profile?.fullName || '';
        
        // Add all doctors (including additional)
        if (session.sessionDoctors && session.sessionDoctors.length > 0) {
          const allDoctors = session.sessionDoctors
            .map((sd: any) => {
              const name = sd.doctor.profile?.fullName || '';
              return sd.isPrimary ? `${name} (Utama)` : name;
            })
            .join(', ');
          data['Semua Dokter'] = allDoctors;
        }
        
        data['Nakes Utama'] = session.nurse.profile?.fullName || '';
        
        // Add all nurses (including additional)
        if (session.sessionNurses && session.sessionNurses.length > 0) {
          const allNurses = session.sessionNurses
            .map((sn: any) => {
              const name = sn.nurse.profile?.fullName || '';
              return sn.isPrimary ? `${name} (Utama)` : name;
            })
            .join(', ');
          data['Semua Nakes'] = allNurses;
        }
      }

      // Vital Signs
      if (options.fields.vitalSigns && session.vitalSigns) {
        const vitalBefore = session.vitalSigns.filter((v) => v.waktuCatat === 'SEBELUM');
        const vitalAfter = session.vitalSigns.filter((v) => v.waktuCatat === 'SESUDAH');

        vitalBefore.forEach((v) => {
          data[`${v.pencatatan} (Sebelum)`] = `${v.value} ${v.unit || ''}`;
        });

        vitalAfter.forEach((v) => {
          data[`${v.pencatatan} (Sesudah)`] = `${v.value} ${v.unit || ''}`;
        });
      }

      // Therapy Plan
      if (options.fields.therapyPlan && session.therapyPlan) {
        const plan = session.therapyPlan;
        data['Plan - IFA'] = plan.ifa || '-';
        data['Plan - HHO'] = plan.hho || '-';
        data['Plan - H2'] = plan.h2 || '-';
        data['Plan - NO'] = plan.no || '-';
        data['Plan - GASO'] = plan.gaso || '-';
        data['Plan - O2'] = plan.o2 || '-';
        data['Plan - O3'] = plan.o3 || '-';
        data['Plan - EDTA'] = plan.edta || '-';
        data['Plan - MB'] = plan.mb || '-';
        data['Plan - H2S'] = plan.h2s || '-';
        data['Plan - KCL'] = plan.kcl || '-';
        data['Plan - JML NB'] = plan.jmlNb || '-';
      }

      // Infusion
      if (options.fields.infusion && session.infusion) {
        const inf = session.infusion;
        data['Aktual - IFA'] = inf.ifa || '-';
        data['Aktual - HHO'] = inf.hho || '-';
        data['Aktual - H2'] = inf.h2 || '-';
        data['Aktual - NO'] = inf.no || '-';
        data['Aktual - GASO'] = inf.gaso || '-';
        data['Aktual - O2'] = inf.o2 || '-';
        data['Aktual - O3'] = inf.o3 || '-';
        data['Aktual - EDTA'] = inf.edta || '-';
        data['Aktual - MB'] = inf.mb || '-';
        data['Aktual - H2S'] = inf.h2s || '-';
        data['Aktual - KCL'] = inf.kcl || '-';
        data['Aktual - JML NB'] = inf.jmlNb || '-';
        data['Jenis Botol'] = inf.bottleType || '-';
        data['Jenis Cairan'] = inf.jenisCairan || '-';
        data['Volume Carrier'] = inf.volumeCarrier || '-';
        data['Jumlah Jarum'] = inf.jumlahJarum || '-';
        data['Catatan Deviasi'] = inf.deviationNotes || '-';
      }

      // Materials
      if (options.fields.materials && session.materials) {
        const materialSummary = session.materials
          .map((m: any) => {
            const productName = m.inventoryItem?.masterProduct?.name || 'Unknown';
            return `${productName}: ${m.quantity} ${m.unit}`;
          })
          .join('; ');
        data['Material Digunakan'] = materialSummary || '-';
      }

      // Evaluation
      if (options.fields.evaluation && session.evaluation) {
        data['Subjective'] = session.evaluation.subjective || '-';
        data['Objective'] = session.evaluation.objective || '-';
        data['Assessment'] = session.evaluation.assessment || '-';
        data['Plan'] = session.evaluation.plan || '-';
        data['Catatan Umum'] = session.evaluation.generalNotes || '-';
      }

      return data;
    });

    // Apply grouping if specified
    if (options.groupBy && options.groupBy !== 'none') {
      return this.groupData(exportData, sessions, options.groupBy);
    }

    return exportData;
  }

  private groupData(exportData: any[], sessions: any[], groupBy: string) {
    // For now, return ungrouped data
    // Grouping will be handled in Excel with subtotals
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
