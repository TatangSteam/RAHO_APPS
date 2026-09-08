import { Prisma } from '@prisma/client';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getMissingRequiredScopes } from './zoho.client';
import { isZohoReconnectRequired } from './zoho.error';
import { hasActiveZohoApiConfig } from '@modules/runtime/runtime.service';

export type ZohoRuntimeMode = 'OFF' | 'DRY_RUN' | 'CANARY' | 'LIVE';
export type ZohoRuntimeGate = {
  mode: ZohoRuntimeMode;
  connectionId: string | null;
  canaryBranchIds: string[];
  masterFrozen: boolean;
  source: 'CONTROL' | 'LEGACY_ENV' | 'DISCONNECTED' | 'AUTHORIZATION_INVALID' | 'CONFIGURATION_INVALID';
};

function stringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

async function hasZohoSyncCredentials(): Promise<boolean> {
  return hasActiveZohoApiConfig();
}

async function assertRuntimeReadyForMode(mode: ZohoRuntimeMode): Promise<void> {
  if (mode === 'OFF') return;
  if (!env.ZOHO_SYNC_WORKER_ENABLED) {
    throw new AppError(
      409,
      'ZOHO_WORKER_DISABLED',
      'Worker Zoho belum aktif. Aktifkan ZOHO_SYNC_WORKER_ENABLED lalu restart API sebelum rehearsal atau go-live.',
    );
  }
  if ((mode === 'CANARY' || mode === 'LIVE') && !await hasZohoSyncCredentials()) {
    throw new AppError(
      409,
      'ZOHO_RUNTIME_CONFIG_INCOMPLETE',
      'Client ID, Client Secret, dan token encryption key wajib tersedia sebelum CANARY/LIVE.',
    );
  }
}

export function jakartaBusinessDayWindow(now: Date): {
  start: Date;
  end: Date;
  isBusinessDay: boolean;
} {
  const jakartaOffsetMs = 7 * 60 * 60 * 1_000;
  const jakarta = new Date(now.getTime() + jakartaOffsetMs);
  const day = jakarta.getUTCDay();
  const start = new Date(Date.UTC(
    jakarta.getUTCFullYear(),
    jakarta.getUTCMonth(),
    jakarta.getUTCDate(),
  ) - jakartaOffsetMs);
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1_000),
    isBusinessDay: day >= 1 && day <= 5,
  };
}

export function canBootstrapCanaryFromDryRun(
  mode: 'CANARY' | 'LIVE',
  reconciliationTotalChecked: number,
  canaryDryRunEventCount: number,
): boolean {
  return mode === 'CANARY'
    && reconciliationTotalChecked === 0
    && canaryDryRunEventCount > 0;
}

/**
 * Counts canary events that have already passed a DRY_RUN rehearsal.
 *
 * A rehearsed event becomes PENDING when CANARY is first activated. If the
 * operator subsequently puts synchronization on hold, reactivation must use
 * the immutable attempt history rather than relying only on the current event
 * status. This keeps the rehearsal gate effective without trapping a safe
 * rollback in OFF mode.
 */
export async function countValidatedCanaryEvents(canaryBranchIds: string[]): Promise<number> {
  if (!canaryBranchIds.length) return 0;
  return prisma.integrationEvent.count({
    where: {
      branchId: { in: canaryBranchIds },
      status: { in: ['DRY_RUN', 'PENDING', 'FAILED'] },
      syncAttempts: { some: { status: 'DRY_RUN' } },
    },
  });
}

export async function getZohoRuntimeGate(): Promise<ZohoRuntimeGate> {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) {
    return { mode: 'OFF', connectionId: null, canaryBranchIds: [], masterFrozen: false, source: 'DISCONNECTED' };
  }
  if (
    connection.scopeVersion < env.ZOHO_REQUIRED_SCOPE_VERSION
    || getMissingRequiredScopes(connection.scopes).length > 0
    || isZohoReconnectRequired(connection.lastError)
  ) {
    return {
      mode: 'OFF',
      connectionId: connection.id,
      canaryBranchIds: [],
      masterFrozen: false,
      source: 'AUTHORIZATION_INVALID',
    };
  }
  const control = await prisma.zohoGoLiveControl.findUnique({
    where: { zohoConnectionId: connection.id },
  });
  if (!control) {
    if (!env.ZOHO_SYNC_WORKER_ENABLED) {
      return {
        mode: 'OFF',
        connectionId: connection.id,
        canaryBranchIds: [],
        masterFrozen: false,
        source: 'LEGACY_ENV',
      };
    }
    if (!env.ZOHO_SYNC_DRY_RUN && !await hasZohoSyncCredentials()) {
      return {
        mode: 'OFF',
        connectionId: connection.id,
        canaryBranchIds: [],
        masterFrozen: false,
        source: 'CONFIGURATION_INVALID',
      };
    }
    return {
      // Tanpa control record, worker hanya boleh rehearsal. LIVE wajib melalui
      // configureGoLiveControl + approval/reconciliation/canary yang eksplisit.
      mode: 'DRY_RUN',
      connectionId: connection.id,
      canaryBranchIds: [],
      masterFrozen: false,
      source: 'LEGACY_ENV',
    };
  }
  const mode = ['OFF', 'DRY_RUN', 'CANARY', 'LIVE'].includes(control.mode)
    ? control.mode as ZohoRuntimeMode
    : 'OFF';
  if (mode !== 'OFF' && !env.ZOHO_SYNC_WORKER_ENABLED) {
    return {
      mode: 'OFF',
      connectionId: connection.id,
      canaryBranchIds: stringArray(control.canaryBranchIds),
      masterFrozen: control.masterFrozen,
      source: 'CONFIGURATION_INVALID',
    };
  }
  if ((mode === 'CANARY' || mode === 'LIVE') && !await hasZohoSyncCredentials()) {
    return {
      mode: 'OFF',
      connectionId: connection.id,
      canaryBranchIds: stringArray(control.canaryBranchIds),
      masterFrozen: control.masterFrozen,
      source: 'CONFIGURATION_INVALID',
    };
  }
  return {
    mode,
    connectionId: connection.id,
    canaryBranchIds: stringArray(control.canaryBranchIds),
    masterFrozen: control.masterFrozen,
    source: 'CONTROL',
  };
}

export async function getGoLiveControl() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) {
    return {
      connected: false,
      control: null,
      runtime: await getZohoRuntimeGate(),
      localErpIndependent: true,
    };
  }
  const control = await prisma.zohoGoLiveControl.findUnique({
    where: { zohoConnectionId: connection.id },
  });
  const canaryBranchIds = stringArray(control?.canaryBranchIds);
  const canaryMemberIds = canaryBranchIds.length
    ? (await prisma.member.findMany({
      where: { registrationBranchId: { in: canaryBranchIds } },
      select: { id: true },
    })).map((member) => member.id)
    : [];
  const [eventStatuses, activeMemberMappings, pendingMemberReviews, nonCanaryPendingHeld, latestReconciliation] = await Promise.all([
    prisma.integrationEvent.groupBy({
      by: ['status'],
      where: { branchId: { in: canaryBranchIds } },
      _count: { _all: true },
    }),
    prisma.zohoEntityMapping.count({
      where: {
        zohoConnectionId: connection.id,
        entityType: 'MEMBER',
        localEntityId: { in: canaryMemberIds },
        status: 'ACTIVE',
      },
    }),
    prisma.zohoMappingReview.count({
      where: {
        zohoConnectionId: connection.id,
        entityType: 'MEMBER',
        localEntityId: { in: canaryMemberIds },
        status: 'PENDING',
      },
    }),
    prisma.integrationEvent.count({
      where: {
        status: 'PENDING',
        OR: canaryBranchIds.length
          ? [{ branchId: null }, { branchId: { notIn: canaryBranchIds } }]
          : undefined,
      },
    }),
    prisma.zohoReconciliationRun.findFirst({
      where: { zohoConnectionId: connection.id, runType: 'FULL' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        totalChecked: true,
        matchedCount: true,
        exceptionCount: true,
        errorCount: true,
        finishedAt: true,
      },
    }),
  ]);
  return {
    connected: true,
    organizationId: connection.organizationId,
    organizationName: connection.organizationName,
    control,
    runtime: await getZohoRuntimeGate(),
    localErpIndependent: true,
    syncSummary: {
      canaryEventStatuses: Object.fromEntries(
        eventStatuses.map((entry) => [entry.status, entry._count._all]),
      ),
      activeMemberMappings,
      pendingMemberReviews,
      nonCanaryPendingHeld,
      latestReconciliation,
    },
  };
}

async function activeConnection() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho belum terhubung; ERP lokal tetap dapat digunakan.');
  return connection;
}

export async function configureGoLiveControl(input: {
  actorUserId: string;
  masterFrozen?: boolean;
  canaryBranchIds?: string[];
  canaryCustomerId?: string | null;
  canaryVendorId?: string | null;
  notes?: string | null;
}) {
  const connection = await activeConnection();
  if (input.canaryBranchIds?.length) {
    const branches = await prisma.branch.findMany({
      where: {
        id: { in: input.canaryBranchIds },
        isActive: true,
        branchCode: { not: 'EXT' },
      },
      select: { id: true, type: true },
    });
    if (branches.length !== new Set(input.canaryBranchIds).size) {
      throw new AppError(422, 'ZOHO_CANARY_BRANCH_INVALID', 'Salah satu cabang canary tidak aktif, merupakan cabang sistem, atau tidak ditemukan.');
    }
  }
  return prisma.zohoGoLiveControl.upsert({
    where: { zohoConnectionId: connection.id },
    create: {
      zohoConnectionId: connection.id,
      mode: 'OFF',
      masterFrozen: input.masterFrozen ?? false,
      canaryBranchIds: input.canaryBranchIds || [],
      canaryCustomerId: input.canaryCustomerId,
      canaryVendorId: input.canaryVendorId,
      notes: input.notes,
      updatedById: input.actorUserId,
    },
    update: {
      ...(input.masterFrozen == null ? {} : { masterFrozen: input.masterFrozen }),
      ...(input.canaryBranchIds == null ? {} : { canaryBranchIds: input.canaryBranchIds }),
      ...(input.canaryCustomerId === undefined ? {} : { canaryCustomerId: input.canaryCustomerId }),
      ...(input.canaryVendorId === undefined ? {} : { canaryVendorId: input.canaryVendorId }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      financeApprovedAt: null,
      financeApprovedById: null,
      logisticsApprovedAt: null,
      logisticsApprovedById: null,
      mismatchFreeBusinessDays: 0,
      lastMismatchFreeBusinessDayAt: null,
      updatedById: input.actorUserId,
    },
  });
}

export async function approveGoLive(
  actorUserId: string,
  area: 'FINANCE' | 'LOGISTICS',
) {
  const connection = await activeConnection();
  const control = await prisma.zohoGoLiveControl.findUnique({
    where: { zohoConnectionId: connection.id },
  });
  if (!control) throw new AppError(409, 'ZOHO_GO_LIVE_NOT_CONFIGURED', 'Konfigurasi cutover belum dibuat.');
  return prisma.zohoGoLiveControl.update({
    where: { id: control.id },
    data: area === 'FINANCE'
      ? { financeApprovedAt: new Date(), financeApprovedById: actorUserId, updatedById: actorUserId }
      : { logisticsApprovedAt: new Date(), logisticsApprovedById: actorUserId, updatedById: actorUserId },
  });
}

async function assertPromotionReady(mode: 'CANARY' | 'LIVE', control: {
  financeApprovedAt: Date | null;
  logisticsApprovedAt: Date | null;
  canaryBranchIds: Prisma.JsonValue | null;
  mismatchFreeBusinessDays: number;
}, connectionId: string) {
  if (!control.financeApprovedAt || !control.logisticsApprovedAt) {
    throw new AppError(409, 'ZOHO_GO_LIVE_APPROVAL_REQUIRED', 'Approval Finance dan Logistik wajib lengkap.');
  }
  if (mode === 'CANARY' && !stringArray(control.canaryBranchIds).length) {
    throw new AppError(409, 'ZOHO_CANARY_SCOPE_REQUIRED', 'Minimal satu cabang canary wajib dipilih.');
  }
  const latest = await prisma.zohoReconciliationRun.findFirst({
    where: { zohoConnectionId: connectionId, runType: 'FULL', status: 'COMPLETED' },
    orderBy: { finishedAt: 'desc' },
  });
  if (!latest) throw new AppError(409, 'ZOHO_RECONCILIATION_REQUIRED', 'Reconciliation lengkap wajib dijalankan sebelum promosi.');
  const canaryBranchIds = stringArray(control.canaryBranchIds);
  const canaryDryRunEventCount = mode === 'CANARY' && latest.totalChecked === 0
    ? await countValidatedCanaryEvents(canaryBranchIds)
    : 0;
  if (
    latest.totalChecked === 0
    && !canBootstrapCanaryFromDryRun(mode, latest.totalChecked, canaryDryRunEventCount)
  ) {
    throw new AppError(
      409,
      'ZOHO_RECONCILIATION_EMPTY',
      mode === 'CANARY'
        ? 'Reconciliation masih kosong dan belum ada event DRY_RUN untuk cabang canary.'
        : 'Reconciliation pasca-canary belum memeriksa data apa pun.',
    );
  }
  const unresolved = await prisma.zohoReconciliationResult.count({
    where: {
      runId: latest.id,
      resolvedAt: null,
      severity: { in: ['HIGH', 'CRITICAL'] },
      status: { not: 'MATCHED' },
    },
  });
  if (unresolved) {
    throw new AppError(409, 'ZOHO_MATERIAL_MISMATCH_OPEN', `${unresolved} exception material belum diselesaikan.`);
  }
  const deadLetters = await prisma.integrationEvent.count({ where: { status: 'DEAD_LETTER' } });
  if (deadLetters) {
    throw new AppError(409, 'ZOHO_DEAD_LETTER_OPEN', `${deadLetters} dead-letter belum diselesaikan.`);
  }
  if (mode === 'LIVE' && control.mismatchFreeBusinessDays < 5) {
    throw new AppError(409, 'ZOHO_CANARY_OBSERVATION_INCOMPLETE', 'Canary wajib bebas mismatch selama lima hari kerja.');
  }
}

export async function setGoLiveMode(actorUserId: string, mode: ZohoRuntimeMode) {
  const connection = await activeConnection();
  const control = await prisma.zohoGoLiveControl.findUnique({
    where: { zohoConnectionId: connection.id },
  });
  if (!control) throw new AppError(409, 'ZOHO_GO_LIVE_NOT_CONFIGURED', 'Konfigurasi cutover belum dibuat.');
  await assertRuntimeReadyForMode(mode);
  if (mode === 'CANARY' || mode === 'LIVE') {
    await assertPromotionReady(mode, control, connection.id);
  }
  return prisma.$transaction(async (tx) => {
    if (mode === 'CANARY' || mode === 'LIVE') {
      // DRY_RUN hanya rehearsal. Event harus kembali antre agar tetap dikirim saat
      // CANARY/LIVE, dan rehearsal tidak boleh menghabiskan jatah retry nyata.
      await tx.integrationEvent.updateMany({
        where: mode === 'CANARY'
          ? {
            branchId: { in: stringArray(control.canaryBranchIds) },
            status: { in: ['DRY_RUN', 'FAILED'] },
            syncAttempts: { some: { status: 'DRY_RUN' } },
          }
          : { status: 'DRY_RUN' },
        data: {
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
          processedAt: null,
          deadLetteredAt: null,
          lastError: null,
          lockedBy: null,
          leaseUntil: null,
        },
      });
    }
    return tx.zohoGoLiveControl.update({
      where: { id: control.id },
      data: {
        mode,
        ...(mode === 'CANARY' ? { masterFrozen: false } : {}),
        lastRehearsalAt: mode === 'DRY_RUN' ? new Date() : control.lastRehearsalAt,
        ...(mode === 'CANARY'
          ? { mismatchFreeBusinessDays: 0, lastMismatchFreeBusinessDayAt: null }
          : {}),
        updatedById: actorUserId,
      },
    });
  });
}

export async function rollbackGoLive(
  actorUserId: string,
  reason: string,
) {
  const connection = await activeConnection();
  const control = await prisma.zohoGoLiveControl.findUnique({
    where: { zohoConnectionId: connection.id },
  });
  if (!control) throw new AppError(409, 'ZOHO_GO_LIVE_NOT_CONFIGURED', 'Konfigurasi cutover belum dibuat.');
  return prisma.zohoGoLiveControl.update({
    where: { id: control.id },
    data: {
      mode: 'OFF',
      lastRollbackAt: new Date(),
      rollbackReason: reason,
      updatedById: actorUserId,
    },
  });
}

export async function recordMismatchFreeBusinessDay(actorUserId: string) {
  const connection = await activeConnection();
  const control = await prisma.zohoGoLiveControl.findUnique({
    where: { zohoConnectionId: connection.id },
  });
  if (!control || control.mode !== 'CANARY') {
    throw new AppError(409, 'ZOHO_CANARY_NOT_ACTIVE', 'Pencatatan hanya tersedia saat CANARY aktif.');
  }
  const latest = await prisma.zohoReconciliationRun.findFirst({
    where: { zohoConnectionId: connection.id, runType: 'FULL', status: 'COMPLETED' },
    orderBy: { finishedAt: 'desc' },
  });
  if (!latest || latest.exceptionCount > 0) {
    throw new AppError(409, 'ZOHO_CANARY_MISMATCH_FOUND', 'Hari bebas mismatch tidak dapat dicatat.');
  }
  const now = new Date();
  const day = jakartaBusinessDayWindow(now);
  if (!day.isBusinessDay) {
    throw new AppError(409, 'ZOHO_CANARY_BUSINESS_DAY_REQUIRED', 'Observasi canary hanya dapat dicatat pada hari kerja Jakarta.');
  }
  const updated = await prisma.zohoGoLiveControl.updateMany({
    where: {
      id: control.id,
      OR: [
        { lastMismatchFreeBusinessDayAt: null },
        { lastMismatchFreeBusinessDayAt: { lt: day.start } },
        { lastMismatchFreeBusinessDayAt: { gte: day.end } },
      ],
    },
    data: {
      mismatchFreeBusinessDays: { increment: 1 },
      lastMismatchFreeBusinessDayAt: now,
      updatedById: actorUserId,
    },
  });
  if (!updated.count) {
    throw new AppError(409, 'ZOHO_CANARY_DAY_ALREADY_RECORDED', 'Hari kerja ini sudah dicatat untuk observasi canary.');
  }
  return prisma.zohoGoLiveControl.findUniqueOrThrow({ where: { id: control.id } });
}
