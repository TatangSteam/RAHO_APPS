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
  status: string;
  activatedAt: Date | null;
  branchName: string;
}

// ── Member Dashboard ──────────────────────────────────────────

export async function getMemberDashboardService(memberId: string): Promise<MemberDashboardData> {
  // Get member data
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
    throw new Error('Member not found');
  }

  // Get last session
  const lastSession = await prisma.treatmentSession.findFirst({
    where: {
      encounter: { memberId },
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
        encounter: { memberId },
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
        encounter: { memberId },
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
    where: {
      encounter: { memberId },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      diagnosisCode: true,
      diagnosa: true,
      kategoriDiagnosa: true,
      createdAt: true,
      encounter: {
        select: {
          doctorId: true,
        },
      },
    },
  });

  return diagnoses.map((d) => ({
    id: d.id,
    diagnosisCode: d.diagnosisCode,
    diagnosa: d.diagnosa,
    kategoriDiagnosa: d.kategoriDiagnosa,
    createdAt: d.createdAt,
    doctorName: d.encounter?.doctorId ? 'Doctor' : 'Unknown',
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
      branch: { select: { name: true } },
    },
  });

  return packages.map((p) => ({
    id: p.id,
    packageCode: p.packageCode,
    packageType: p.packageType,
    totalSessions: p.totalSessions,
    usedSessions: p.usedSessions,
    status: p.status,
    activatedAt: p.activatedAt,
    branchName: p.branch.name,
  }));
}