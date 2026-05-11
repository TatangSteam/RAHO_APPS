import { prisma } from '@lib/prisma';


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
}

interface MemberDiagnosis {
  id: string;
  diagnosisCode: string;
  diagnosa: string;
  kategoriDiagnosa: string | null;
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
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberNo: string;
  nik: string | null;
  dateOfBirth: Date | null;
  jenisKelamin: string | null;
  address: string | null;
  voucherCount: number;
  isActive: boolean;
  registrationBranch: {
    name: string;
    branchCode: string;
    city: string;
  } | null;
  memberSince: Date;
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

  const lastSession = await prisma.treatmentSession.findFirst({
    where: {
      encounter: {
        memberId,
        memberPackage: {
          packageType: 'BASIC',
        },
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

  const [sessions, total] = await Promise.all([
    prisma.treatmentSession.findMany({
      where: {
        encounter: {
          memberId,
          memberPackage: {
            packageType: 'BASIC',
          },
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
      },
    }),
    prisma.treatmentSession.count({
      where: {
        encounter: {
          memberId,
          memberPackage: {
            packageType: 'BASIC',
          },
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
          address: true,
          voucherCount: true,
          isActive: true,
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
    fullName: user.profile?.fullName ?? null,
    phone: user.profile?.phone ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    memberNo: user.member.memberNo,
    nik: user.member.nik,
    dateOfBirth: user.member.dateOfBirth,
    jenisKelamin: user.member.jenisKelamin,
    address: user.member.address,
    voucherCount: user.member.voucherCount,
    isActive: user.member.isActive,
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
        branch: { select: { name: true } },
        items: {
          select: {
            description: true,
            quantity: true,
            pricePerUnit: true,
            totalAmount: true,
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