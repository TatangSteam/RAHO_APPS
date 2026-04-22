import { prisma } from '@lib/prisma';

interface StaffDashboardData {
  sesiHariIni: number;
  memberAktif: number;
}

interface AdminCabangDashboardData {
  memberAktif: number;
  sesiHariIni: number;
  sesiBulanIni: number;
  stokKritis: number;
  paketPendingVerifikasi: number;
}

interface AdminManagerDashboardData {
  totalMemberAktif: number;
  totalSesiBulanIni: number;
  totalPaketAktif: number;
  chartSesiPerCabang: Array<{ branchCode: string; branchName: string; sesiBulanIni: number }>;
}

interface SuperAdminDashboardData extends AdminManagerDashboardData {
  stockRequestPending: number;
  auditLogTerbaru: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string;
    userName: string;
    createdAt: Date;
  }>;
}

// ── Staff Dashboard (ADMIN_LAYANAN, DOCTOR, NURSE) ───────────────────────

export async function getStaffDashboardService(
  branchId: string,
): Promise<StaffDashboardData> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // Sesi hari ini di cabang ini
  const sesiHariIni = await prisma.treatmentSession.count({
    where: {
      branchId,
      treatmentDate: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  // Member aktif yang punya akses ke cabang ini
  const memberAktif = await prisma.member.count({
    where: {
      isActive: true,
      OR: [
        { registrationBranchId: branchId },
        { branchAccesses: { some: { branchId } } },
      ],
    },
  });

  return { sesiHariIni, memberAktif };
}

// ── Admin Cabang Dashboard ──────────────────────────────────────────────

export async function getAdminCabangDashboardService(
  branchId: string,
): Promise<AdminCabangDashboardData> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Parallel queries for efficiency
  const [
    memberAktif,
    sesiHariIni,
    sesiBulanIni,
    stokKritis,
    paketPendingVerifikasi,
  ] = await Promise.all([
    // Member aktif
    prisma.member.count({
      where: {
        isActive: true,
        OR: [
          { registrationBranchId: branchId },
          { branchAccesses: { some: { branchId } } },
        ],
      },
    }),

    // Sesi hari ini
    prisma.treatmentSession.count({
      where: {
        branchId,
        treatmentDate: { gte: startOfDay, lt: endOfDay },
      },
    }),

    // Sesi bulan ini
    prisma.treatmentSession.count({
      where: {
        branchId,
        treatmentDate: { gte: startOfMonth, lt: endOfMonth },
      },
    }),

    // Stok kritis (stock < minThreshold)
    prisma.inventoryItem.count({
      where: {
        branchId,
        stock: { lt: prisma.inventoryItem.fields.minThreshold },
      },
    }),

    // Paket pending verifikasi
    prisma.memberPackage.count({
      where: {
        branchId,
        status: 'PENDING_PAYMENT',
      },
    }),
  ]);

  return {
    memberAktif,
    sesiHariIni,
    sesiBulanIni,
    stokKritis,
    paketPendingVerifikasi,
  };
}

// ── Admin Manager Dashboard (Agregat Semua Cabang) ──────────────────────

export async function getAdminManagerDashboardService(): Promise<AdminManagerDashboardData> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Parallel queries
  const [totalMemberAktif, totalSesiBulanIni, totalPaketAktif, branches] = await Promise.all([
    // Total member aktif
    prisma.member.count({
      where: { isActive: true },
    }),

    // Total sesi bulan ini (semua cabang)
    prisma.treatmentSession.count({
      where: {
        treatmentDate: { gte: startOfMonth, lt: endOfMonth },
      },
    }),

    // Total paket aktif
    prisma.memberPackage.count({
      where: { status: 'ACTIVE' },
    }),

    // Ambil semua cabang untuk chart
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, branchCode: true, name: true },
    }),
  ]);

  // Hitung sesi per cabang
  const chartSesiPerCabang = await Promise.all(
    branches.map(async (branch) => {
      const sesiBulanIni = await prisma.treatmentSession.count({
        where: {
          branchId: branch.id,
          treatmentDate: { gte: startOfMonth, lt: endOfMonth },
        },
      });
      return {
        branchCode: branch.branchCode,
        branchName: branch.name,
        sesiBulanIni,
      };
    }),
  );

  return {
    totalMemberAktif,
    totalSesiBulanIni,
    totalPaketAktif,
    chartSesiPerCabang,
  };
}

// ── Super Admin Dashboard ───────────────────────────────────────────────

export async function getSuperAdminDashboardService(): Promise<SuperAdminDashboardData> {
  // Get manager dashboard data first
  const managerData = await getAdminManagerDashboardService();

  // Additional Super Admin data
  const [stockRequestPending, auditLogs] = await Promise.all([
    // Stock request pending
    prisma.stockRequest.count({
      where: { status: 'PENDING' },
    }),

    // 10 audit log terbaru
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        createdAt: true,
        user: {
          select: {
            profile: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  return {
    ...managerData,
    stockRequestPending,
    auditLogTerbaru: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      userName: log.user.profile?.fullName ?? 'Unknown',
      createdAt: log.createdAt,
    })),
  };
}