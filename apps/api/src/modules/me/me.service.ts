import { prisma } from '@lib/prisma';
import { uploadFile } from '@config/minio';
import { getDiagnosisCategoryList } from '../../utils/diagnosisCategories';


interface MemberDashboardData {
  voucherSisa: number;
  paketAktif: number;
  sesiTerakhir: {
    sessionCode: string;
    treatmentDate: Date;
    infusKe: number;
    pelaksanaan: string;
  } | null;
}

interface MemberSession {
  id: string;
  sessionCode: string;
  treatmentDate: Date;
  infusKe: number;
  pelaksanaan: string;
  isCompleted: boolean;
  packageType: string;
  packageCode: string;
  branchName: string;
  branchCode: string;
}

interface MemberDiagnosis {
  id: string;
  diagnosisCode: string;
  diagnosa: string;
  kategoriDiagnosa: string | null;
  kategoriDiagnosaList: string[];
  createdAt: Date;
  doctorName: string;
}

interface MemberPackage {
  id: string;
  packageCode: string;
  packageType: string;
  totalSessions: number;
  usedSessions: number;
  sisaSessions: number;
  status: string;
  activatedAt: Date | null;
  expiredAt: Date | null;
  finalPrice: number;
  branchName: string;
}

interface MemberProfile {
  userId: string;
  email: string;
  username: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberNo: string;
  nik: string | null;
  dateOfBirth: Date | null;
  age: number | null;
  jenisKelamin: string | null;
  agama: string | null;
  address: string | null;
  voucherCount: number;
  isActive: boolean;
  isDeceased: boolean;
  registrationBranch: {
    name: string;
    branchCode: string;
    city: string;
  } | null;
  memberSince: Date;
}

function calculateAge(dateOfBirth?: Date | null): number | null {
  if (!dateOfBirth) return null;

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = today.getMonth() - dateOfBirth.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

interface MemberInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  paidAt: Date | null;
  paymentMethod: string | null;
  createdAt: Date;
  branchName: string;
  branchCode: string;
  memberName: string;
  memberNo: string;
  memberPhone: string;
  paymentProofUrl: string | null;
  paymentProofFileName: string | null;
  items: {
    description: string;
    quantity: number;
    pricePerUnit: number;
    totalAmount: number;
  }[];
}


// ── Member Dashboard ──────────────────────────────────────────


export async function getMemberDashboardService(memberId: string): Promise<MemberDashboardData> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      voucherCount: true,
      memberPackages: {
        where: { status: 'ACTIVE' },
        select: { id: true },
      },
    },
  });

  if (!member) {
    throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan.' };
  }

  // Get last session from ANY package type
  const lastSession = await prisma.treatmentSession.findFirst({
    where: {
      encounter: {
        memberId,
      },
    },
    orderBy: { treatmentDate: 'desc' },
    select: {
      sessionCode: true,
      treatmentDate: true,
      infusKe: true,
      pelaksanaan: true,
    },
  });

  return {
    voucherSisa: member.voucherCount,
    paketAktif: member.memberPackages.length,
    sesiTerakhir: lastSession
      ? {
          sessionCode: lastSession.sessionCode,
          treatmentDate: lastSession.treatmentDate,
          infusKe: lastSession.infusKe,
          pelaksanaan: lastSession.pelaksanaan,
        }
      : null,
  };
}


// ── Member Sessions ───────────────────────────────────────────


export async function getMemberSessionsService(
  memberId: string,
  page: number,
  limit: number,
): Promise<{ data: MemberSession[]; total: number }> {
  const skip = (page - 1) * limit;

  // Get ALL sessions for this member, regardless of package type
  const [sessions, total] = await Promise.all([
    prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId,
        },
      },
      orderBy: { treatmentDate: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        sessionCode: true,
        treatmentDate: true,
        infusKe: true,
        pelaksanaan: true,
        isCompleted: true,
        branch: {
          select: {
            name: true,
            branchCode: true,
          },
        },
        encounter: {
          select: {
            memberPackage: {
              select: {
                packageType: true,
                packageCode: true,
              },
            },
          },
        },
      },
    }),
    prisma.treatmentSession.count({
      where: {
        encounter: {
          memberId,
        },
      },
    }),
  ]);

  return {
    data: sessions.map((s) => ({
      id: s.id,
      sessionCode: s.sessionCode,
      treatmentDate: s.treatmentDate,
      infusKe: s.infusKe,
      pelaksanaan: s.pelaksanaan,
      isCompleted: s.isCompleted,
      packageType: s.encounter.memberPackage.packageType,
      packageCode: s.encounter.memberPackage.packageCode,
      branchName: s.branch.name,
      branchCode: s.branch.branchCode,
    })),
    total,
  };
}


// ── Member Diagnoses ──────────────────────────────────────────


export async function getMemberDiagnosesService(memberId: string): Promise<MemberDiagnosis[]> {
  const diagnoses = await prisma.diagnosis.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      diagnosisCode: true,
      diagnosa: true,
      kategoriDiagnosa: true,
      kategoriDiagnosaList: true,
      createdAt: true,
      doktorPemeriksa: true,
    },
  });

  // Batch-fetch doctor names agar tidak N+1 query
  const doctorIds = [...new Set(diagnoses.map((d) => d.doktorPemeriksa).filter(Boolean))] as string[];
  const doctors = await prisma.user.findMany({
    where: { id: { in: doctorIds } },
    select: {
      id: true,
      profile: { select: { fullName: true } },
    },
  });
  const doctorMap = new Map(doctors.map((d) => [d.id, d.profile?.fullName ?? 'Dokter']));

  return diagnoses.map((d) => ({
    id: d.id,
    diagnosisCode: d.diagnosisCode,
    diagnosa: d.diagnosa,
    kategoriDiagnosa: d.kategoriDiagnosa,
    kategoriDiagnosaList: getDiagnosisCategoryList(d),
    createdAt: d.createdAt,
    doctorName: d.doktorPemeriksa ? (doctorMap.get(d.doktorPemeriksa) ?? 'Dokter') : 'Tidak diketahui',
  }));
}


// ── Member Packages ───────────────────────────────────────────


export async function getMemberPackagesService(memberId: string): Promise<MemberPackage[]> {
  const packages = await prisma.memberPackage.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      packageCode: true,
      packageType: true,
      totalSessions: true,
      usedSessions: true,
      status: true,
      activatedAt: true,
      expiredAt: true,
      finalPrice: true,
      branch: { select: { name: true } },
    },
  });

  return packages.map((p) => ({
    id: p.id,
    packageCode: p.packageCode,
    packageType: p.packageType,
    totalSessions: p.totalSessions,
    usedSessions: p.usedSessions,
    sisaSessions: p.totalSessions - p.usedSessions,
    status: p.status,
    activatedAt: p.activatedAt,
    expiredAt: p.expiredAt,
    finalPrice: Number(p.finalPrice),
    branchName: p.branch.name,
  }));
}


// ── Member Profile ────────────────────────────────────────────


export async function getMemberProfileService(userId: string): Promise<MemberProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
          avatarUrl: true,
        },
      },
      member: {
        select: {
          memberNo: true,
          nik: true,
          dateOfBirth: true,
          jenisKelamin: true,
          agama: true,
          address: true,
          voucherCount: true,
          isActive: true,
          isDeceased: true,
          registrationBranch: {
            select: { name: true, branchCode: true, city: true },
          },
        },
      },
    },
  });

  if (!user || !user.member) {
    throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Data member tidak ditemukan.' };
  }

  return {
    userId: user.id,
    email: user.email,
    username: user.email,
    fullName: user.profile?.fullName ?? null,
    phone: user.profile?.phone ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    memberNo: user.member.memberNo,
    nik: user.member.nik,
    dateOfBirth: user.member.dateOfBirth,
    age: calculateAge(user.member.dateOfBirth),
    jenisKelamin: user.member.jenisKelamin,
    agama: user.member.agama,
    address: user.member.address,
    voucherCount: user.member.voucherCount,
    isActive: user.member.isActive,
    isDeceased: user.member.isDeceased,
    registrationBranch: user.member.registrationBranch ?? null,
    memberSince: user.createdAt,
  };
}


// ── Member Invoices ───────────────────────────────────────────


export async function getMemberInvoicesService(
  memberId: string,
  page: number,
  limit: number,
): Promise<{ data: MemberInvoice[]; total: number }> {
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        paidAt: true,
        paymentMethod: true,
        createdAt: true,
        branch: { select: { name: true, branchCode: true } },
        items: {
          select: {
            description: true,
            quantity: true,
            pricePerUnit: true,
            totalAmount: true,
          },
        },
        payments: {
          select: {
            proofFileUrl: true,
            proofFileName: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        member: {
          select: {
            memberNo: true,
            user: {
              select: {
                profile: {
                  select: { fullName: true, phone: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.invoice.count({ where: { memberId } }),
  ]);

  return {
    data: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      totalAmount: Number(inv.totalAmount),
      paidAt: inv.paidAt,
      paymentMethod: inv.paymentMethod,
      createdAt: inv.createdAt,
      branchName: inv.branch?.name ?? '—',
      branchCode: inv.branch?.branchCode ?? '',
      memberName: inv.member?.user?.profile?.fullName ?? '',
      memberNo: inv.member?.memberNo ?? '',
      memberPhone: inv.member?.user?.profile?.phone ?? '',
      paymentProofUrl: inv.payments[0]?.proofFileUrl ?? null,
      paymentProofFileName: inv.payments[0]?.proofFileName ?? null,
      items: inv.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        pricePerUnit: Number(item.pricePerUnit),
        totalAmount: Number(item.totalAmount),
      })),
    })),
    total,
  };
}


// ── Member Invoice Detail (Full data for PDF) ─────────────────


interface MemberInvoiceDetail {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberNo?: string;
  branchId: string;
  branchName: string;
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  taxPercent?: number;
  taxAmount?: number;
  totalAmount: number;
  incentive?: {
    totalAmount: number;
    referralCode: string;
    referrerName: string;
    referrerType: string;
    recordCount: number;
  };
  status: string;
  dueDate?: string;
  paidAt?: string;
  cancelledAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNotes?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    itemType: string;
    itemId: string;
    code?: string;
    description: string;
    quantity: number;
    pricePerUnit: number;
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
  }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    paymentReference?: string;
    notes?: string;
    proofFileUrl?: string;
    proofFileName?: string;
    proofFileSize?: number;
    proofMimeType?: string;
    receivedBy: string;
    receivedByName: string;
    receivedAt: string;
  }[];
}


export async function getMemberInvoiceDetailService(
  memberId: string,
  invoiceId: string,
): Promise<MemberInvoiceDetail> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      memberId, // Ensure invoice belongs to this member
    },
    include: {
      member: {
        include: {
          referralCode: true,
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
      branch: true,
      createdByUser: {
        include: {
          profile: true,
        },
      },
      verifiedByUser: {
        include: {
          profile: true,
        },
      },
      items: true,
      payments: {
        include: {
          receivedByUser: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw { status: 404, code: 'INVOICE_NOT_FOUND', message: 'Invoice tidak ditemukan.' };
  }

  // Get incentive information for packages in this invoice
  let incentiveInfo = null;

  // Get package IDs from invoice items
  const packageIds = invoice.items
    .filter((item) => item.itemType === 'PACKAGE')
    .map((item) => item.itemId);

  if (packageIds.length > 0 && invoice.member.referralCode) {
    // Get incentive records for these packages
    const incentiveRecords = await prisma.referralIncentiveRecord.findMany({
      where: {
        memberPackageId: {
          in: packageIds,
        },
      },
      include: {
        referralCode: {
          select: {
            code: true,
            referrerName: true,
            referrerType: true,
          },
        },
      },
    });

    // If there are incentive records, sum them up
    if (incentiveRecords.length > 0) {
      const totalIncentive = incentiveRecords.reduce(
        (sum, record) => sum + Number(record.incentiveAmount),
        0,
      );

      // Use the first record for referral info
      const firstRecord = incentiveRecords[0];

      incentiveInfo = {
        totalAmount: totalIncentive,
        referralCode: firstRecord.referralCode.code,
        referrerName: firstRecord.referralCode.referrerName,
        referrerType: firstRecord.referralCode.referrerType,
        recordCount: incentiveRecords.length,
      };
    }
  }

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    memberId: invoice.memberId,
    memberName: invoice.member.user?.profile?.fullName ?? 'Member',
    memberNo: invoice.member.memberNo,
    branchId: invoice.branchId,
    branchName: invoice.branch.name,

    // Financial
    subtotal: Number(invoice.subtotal),
    discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : undefined,
    discountAmount:
      invoice.discountAmount && Number(invoice.discountAmount) > 0
        ? Number(invoice.discountAmount)
        : undefined,
    discountNote: invoice.discountNote || undefined,
    taxPercent:
      invoice.taxPercent && Number(invoice.taxPercent) > 0 ? Number(invoice.taxPercent) : undefined,
    taxAmount:
      invoice.taxAmount && Number(invoice.taxAmount) > 0 ? Number(invoice.taxAmount) : undefined,
    totalAmount: Number(invoice.totalAmount),

    // Incentive information
    incentive: incentiveInfo ?? undefined,

    // Status
    status: invoice.status,
    dueDate: invoice.dueDate?.toISOString(),
    paidAt: invoice.paidAt?.toISOString(),
    cancelledAt: invoice.cancelledAt?.toISOString(),

    // Metadata
    notes: invoice.notes || undefined,
    createdBy: invoice.createdBy,
    createdByName: invoice.createdByUser?.profile?.fullName ?? 'Admin',
    verifiedBy: invoice.verifiedBy || undefined,
    verifiedByName: invoice.verifiedByUser?.profile?.fullName,
    verifiedAt: invoice.verifiedAt?.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),

    // Relations
    items: invoice.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      itemId: item.itemId,
      code: item.code || undefined,
      description: item.description,
      quantity: item.quantity,
      pricePerUnit: Number(item.pricePerUnit),
      subtotal: Number(item.subtotal),
      discountAmount: Number(item.discountAmount),
      totalAmount: Number(item.totalAmount),
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference || undefined,
      notes: payment.notes || undefined,
      proofFileUrl: payment.proofFileUrl ? `/invoices/payment-proof/${payment.id}` : undefined,
      proofFileName: payment.proofFileName || undefined,
      proofFileSize: payment.proofFileSize || undefined,
      proofMimeType: payment.proofMimeType || undefined,
      receivedBy: payment.receivedBy,
      receivedByName: payment.receivedByUser?.profile?.fullName ?? 'Admin',
      receivedAt: payment.receivedAt.toISOString(),
    })),
  };
}


// ── Member Session Detail (Read-Only) ─────────────────────────


interface VitalSignData {
  sistol: number | null;
  diastol: number | null;
  hr: number | null;
  saturasi: number | null;
  pi: number | null;
}

interface TherapyPlanSubstanceData {
  name: string;
  amount: number;
  unit: string;
  keterangan?: string;
  isDefault?: boolean;
}

interface TherapyPlanData {
  planCode: string;
  planNumber: number | null;
  setName: string | null;
  setVersion: number | null;
  keterangan: string | null;
  ifa250: number | null;
  ifa500: number | null;
  hho: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  ifaSubstances: TherapyPlanSubstanceData[] | null;
  ifaSubstanceTotalMl: number | null;
}

interface InfusionData {
  ifa250: number | null;
  ifa500: number | null;
  hho: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  deviationNotes: string | null;
  bottleType: string | null;
  jenisCairan: string | null;
  volumeCarrier: number | null;
  jumlahJarum: number | null;
}

interface EvaluationData {
  evaluationCode: string;
  keluhan: string | null;
  rekomendasi: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  generalNotes: string | null;
}

interface MemberSessionDetail {
  session: {
    id: string;
    sessionCode: string;
    treatmentDate: Date;
    infusKe: number;
    pelaksanaan: string;
    isCompleted: boolean;
    packageType: string;
    packageCode: string;
    branchName: string;
    branchCode: string;
  };
  staff: {
    adminLayanan: string | null;
    doctor: string | null;
    nurse: string | null;
  };
  diagnosis: {
    diagnosisCode: string;
    diagnosa: string;
    kategoriDiagnosa: string | null;
    kategoriDiagnosaList: string[];
  } | null;
  therapyPlan: TherapyPlanData | null;
  vitalSignsBefore: VitalSignData | null;
  vitalSignsAfter: VitalSignData | null;
  infusion: InfusionData | null;
  materials: {
    productName: string;
    quantity: number;
    unit: string;
  }[];
  photo: {
    photoUrl: string;
    fileName: string;
  } | null;
  evaluation: EvaluationData | null;
}


function parseVitalSigns(vitalSigns: any[], timing: 'SEBELUM' | 'SESUDAH'): VitalSignData | null {
  const filtered = vitalSigns.filter((v) => v.waktuCatat === timing);
  if (filtered.length === 0) return null;

  const result: VitalSignData = {
    sistol: null,
    diastol: null,
    hr: null,
    saturasi: null,
    pi: null,
  };

  for (const v of filtered) {
    const value = v.value ? Number(v.value) : null;
    switch (v.pencatatan) {
      case 'SISTOL':
        result.sistol = value;
        break;
      case 'DIASTOL':
        result.diastol = value;
        break;
      case 'HR':
        result.hr = value;
        break;
      case 'SATURASI':
        result.saturasi = value;
        break;
      case 'PI':
        result.pi = value;
        break;
    }
  }

  return result;
}


export async function getMemberSessionDetailService(
  memberId: string,
  sessionId: string,
): Promise<MemberSessionDetail> {
  // Verify session belongs to this member
  const session = await prisma.treatmentSession.findFirst({
    where: {
      id: sessionId,
      encounter: {
        memberId,
      },
    },
    include: {
      branch: {
        select: { name: true, branchCode: true },
      },
      encounter: {
        include: {
          memberPackage: {
            select: { packageType: true, packageCode: true },
          },
          diagnoses: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      adminLayanan: {
        include: { profile: { select: { fullName: true } } },
      },
      doctor: {
        include: { profile: { select: { fullName: true } } },
      },
      nurse: {
        include: { profile: { select: { fullName: true } } },
      },
      therapyPlan: {
        include: {
          therapyPlanSet: true,
        },
      },
      vitalSigns: true,
      infusion: true,
      materials: {
        include: {
          inventoryItem: {
            include: { masterProduct: { select: { name: true, unit: true } } },
          },
        },
      },
      photo: true,
      evaluation: true,
    },
  });

  if (!session) {
    throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi terapi tidak ditemukan.' };
  }

  const diagnosis = session.encounter.diagnoses[0] ?? null;

  return {
    session: {
      id: session.id,
      sessionCode: session.sessionCode,
      treatmentDate: session.treatmentDate,
      infusKe: session.infusKe,
      pelaksanaan: session.pelaksanaan,
      isCompleted: session.isCompleted,
      packageType: session.encounter.memberPackage.packageType,
      packageCode: session.encounter.memberPackage.packageCode,
      branchName: session.branch.name,
      branchCode: session.branch.branchCode,
    },
    staff: {
      adminLayanan: session.adminLayanan?.profile?.fullName ?? null,
      doctor: session.doctor?.profile?.fullName ?? null,
      nurse: session.nurse?.profile?.fullName ?? null,
    },
    diagnosis: diagnosis
      ? {
          diagnosisCode: diagnosis.diagnosisCode,
          diagnosa: diagnosis.diagnosa,
          kategoriDiagnosa: diagnosis.kategoriDiagnosa,
          kategoriDiagnosaList: getDiagnosisCategoryList(diagnosis),
        }
      : null,
    therapyPlan: session.therapyPlan
      ? {
          planCode: session.therapyPlan.planCode,
          planNumber: session.therapyPlan.planNumber,
          setName: session.therapyPlan.therapyPlanSet?.name ?? null,
          setVersion: session.therapyPlan.therapyPlanSet?.version ?? session.therapyPlan.version ?? null,
          keterangan: session.therapyPlan.keterangan,
          ifa250: session.therapyPlan.ifa250 ? Number(session.therapyPlan.ifa250) : null,
          ifa500: session.therapyPlan.ifa500 ? Number(session.therapyPlan.ifa500) : null,
          hho: session.therapyPlan.hho ? Number(session.therapyPlan.hho) : null,
          h2: session.therapyPlan.h2 ? Number(session.therapyPlan.h2) : null,
          no: session.therapyPlan.no ? Number(session.therapyPlan.no) : null,
          gaso: session.therapyPlan.gaso ? Number(session.therapyPlan.gaso) : null,
          o2: session.therapyPlan.o2 ? Number(session.therapyPlan.o2) : null,
          o3: session.therapyPlan.o3 ? Number(session.therapyPlan.o3) : null,
          edta: session.therapyPlan.edta ? Number(session.therapyPlan.edta) : null,
          mb: session.therapyPlan.mb ? Number(session.therapyPlan.mb) : null,
          h2s: session.therapyPlan.h2s ? Number(session.therapyPlan.h2s) : null,
          kcl: session.therapyPlan.kcl ? Number(session.therapyPlan.kcl) : null,
          jmlNb: session.therapyPlan.jmlNb ? Number(session.therapyPlan.jmlNb) : null,
          ifaSubstances: Array.isArray(session.therapyPlan.ifaSubstances)
            ? (session.therapyPlan.ifaSubstances as unknown as TherapyPlanSubstanceData[])
            : null,
          ifaSubstanceTotalMl: session.therapyPlan.ifaSubstanceTotalMl != null
            ? Number(session.therapyPlan.ifaSubstanceTotalMl)
            : null,
        }
      : null,
    vitalSignsBefore: parseVitalSigns(session.vitalSigns, 'SEBELUM'),
    vitalSignsAfter: parseVitalSigns(session.vitalSigns, 'SESUDAH'),
    infusion: session.infusion
      ? {
          ifa250: session.infusion.ifa250 ? Number(session.infusion.ifa250) : null,
          ifa500: session.infusion.ifa500 ? Number(session.infusion.ifa500) : null,
          hho: session.infusion.hho ? Number(session.infusion.hho) : null,
          h2: session.infusion.h2 ? Number(session.infusion.h2) : null,
          no: session.infusion.no ? Number(session.infusion.no) : null,
          gaso: session.infusion.gaso ? Number(session.infusion.gaso) : null,
          o2: session.infusion.o2 ? Number(session.infusion.o2) : null,
          o3: session.infusion.o3 ? Number(session.infusion.o3) : null,
          edta: session.infusion.edta ? Number(session.infusion.edta) : null,
          mb: session.infusion.mb ? Number(session.infusion.mb) : null,
          h2s: session.infusion.h2s ? Number(session.infusion.h2s) : null,
          kcl: session.infusion.kcl ? Number(session.infusion.kcl) : null,
          jmlNb: session.infusion.jmlNb ? Number(session.infusion.jmlNb) : null,
          deviationNotes: session.infusion.deviationNotes,
          bottleType: session.infusion.bottleType,
          jenisCairan: session.infusion.jenisCairan,
          volumeCarrier: session.infusion.volumeCarrier ? Number(session.infusion.volumeCarrier) : null,
          jumlahJarum: session.infusion.jumlahJarum,
        }
      : null,
    materials: session.materials.map((m) => ({
      productName: m.inventoryItem?.masterProduct?.name ?? 'Unknown',
      quantity: Number(m.quantity),
      unit: m.inventoryItem?.masterProduct?.unit ?? 'pcs',
    })),
    photo: session.photo
      ? {
          photoUrl: session.photo.fileUrl,
          fileName: session.photo.fileName,
        }
      : null,
    evaluation: session.evaluation
      ? {
          evaluationCode: session.evaluation.evaluationCode,
          keluhan: session.evaluation.keluhan,
          rekomendasi: session.evaluation.rekomendasi,
          subjective: session.evaluation.subjective,
          objective: session.evaluation.objective,
          assessment: session.evaluation.assessment,
          plan: session.evaluation.plan,
          generalNotes: session.evaluation.generalNotes,
        }
      : null,
  };
}


// ── Upload Payment Proof ──────────────────────────────────────


export async function uploadPaymentProofService(
  memberId: string, 
  packageId: string, 
  file: Express.Multer.File
): Promise<{ message: string; packageCode: string; status: string }> {
  
  // 1. Validate package belongs to member and is in correct status
  const memberPackage = await prisma.memberPackage.findFirst({
    where: {
      id: packageId,
      memberId,
      status: 'PENDING_PAYMENT'
    },
    select: {
      id: true,
      packageCode: true,
      packageType: true,
      finalPrice: true,
      member: {
        select: {
          id: true,
          user: {
            select: {
              profile: { select: { fullName: true } }
            }
          }
        }
      }
    }
  });

  if (!memberPackage) {
    throw {
      status: 404,
      code: 'PACKAGE_NOT_FOUND',
      message: 'Paket tidak ditemukan atau tidak dalam status pending payment'
    };
  }

  // 2. Upload file to MinIO
  const timestamp = Date.now();
  const fileExtension = file.originalname.split('.').pop();
  const key = `uploads/payment-proofs/${memberPackage.member.id}/${timestamp}.${fileExtension}`;

  let fileUrl: string;
  try {
    const uploadResult = await uploadFile(file.buffer, key, file.mimetype);
    fileUrl = uploadResult.url;
  } catch (error) {
    throw {
      status: 500,
      code: 'FILE_UPLOAD_FAILED',
      message: 'Gagal mengupload file bukti pembayaran'
    };
  }

  // 3. Update package status to WAITING_VERIFICATION and save file info
  await prisma.memberPackage.update({
    where: { id: packageId },
    data: {
      status: 'WAITING_VERIFICATION',
      paymentProofUrl: fileUrl,
      paymentProofFileName: file.originalname,
      paymentProofFileSize: file.size,
      paymentProofMimeType: file.mimetype,
    }
  });

  // NOTE: Invoice status stays PENDING_PAYMENT until admin verifies/rejects
  // Invoice will be updated when admin calls verify or reject endpoint

  return {
    message: 'Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.',
    packageCode: memberPackage.packageCode,
    status: 'WAITING_VERIFICATION'
  };
}
