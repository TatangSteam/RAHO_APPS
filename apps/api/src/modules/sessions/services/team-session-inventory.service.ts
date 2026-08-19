import { createHash, randomUUID } from 'crypto';
import {
  HomecareBagStatus,
  HomecareTeamMemberRole,
  LogisticLocationType,
  LogisticTransactionType,
  Prisma,
} from '@prisma/client';
import { errors } from '@middleware/errorHandler';

type Tx = Prisma.TransactionClient;

export type SessionTeamMaterial = {
  inventoryItemId: string;
  masterProductId: string;
  productName: string;
  baseQuantity: Prisma.Decimal;
  baseUnit: string;
};

type TeamWithBags = Prisma.HomecareTeamGetPayload<{
  include: {
    bags: {
      include: { stocks: true };
    };
  };
}>;

export type TeamStockAllocation = {
  bagId: string;
  bagCode: string;
  masterProductId: string;
  quantity: Prisma.Decimal;
  unit: string;
};

export type ResolvedSessionTeamInventory = {
  team: TeamWithBags;
  allocations: TeamStockAllocation[];
};

function completionCode(prefix: string) {
  return `${prefix}-${randomUUID().toUpperCase()}`;
}

function allocationHash(input: {
  sessionId: string;
  teamId: string;
  allocations: TeamStockAllocation[];
}) {
  const normalized = input.allocations
    .map((row) => ({
      bagId: row.bagId,
      masterProductId: row.masterProductId,
      quantity: row.quantity.toFixed(4),
      unit: row.unit,
    }))
    .sort((left, right) => `${left.bagId}:${left.masterProductId}`.localeCompare(`${right.bagId}:${right.masterProductId}`));
  return createHash('sha256').update(JSON.stringify({
    sessionId: input.sessionId,
    teamId: input.teamId,
    allocations: normalized,
  })).digest('hex');
}

/**
 * A team is selected only when the session Admin Layanan and at least one
 * assigned clinical worker are active members of the same branch team.
 * No match intentionally means branch-stock fallback. Multiple matches are
 * rejected because silently choosing a team would make the stock source
 * non-deterministic.
 */
export async function resolveSessionTeamInventory(
  tx: Tx,
  input: {
    sessionId: string;
    branchId: string;
    adminLayananId: string;
    clinicalUserIds: string[];
    materials: SessionTeamMaterial[];
  },
): Promise<ResolvedSessionTeamInventory | null> {
  // Compatibility path for an existing multi-bag usage recorded before the
  // session-completion integration was enabled. It is accepted only when its
  // product quantities exactly match the current Material Usage draft.
  const recorded = await tx.homecareMultiBagUsage.findUnique({
    where: { treatmentSessionId: input.sessionId },
  });
  if (recorded?.status === 'COMPLETED') {
    const usageIds = Array.isArray(recorded.usageIds)
      ? recorded.usageIds.filter((id): id is string => typeof id === 'string')
      : [];
    const [team, usages] = await Promise.all([
      tx.homecareTeam.findUnique({
        where: { id: recorded.teamId },
        include: {
          bags: {
            where: { isActive: true, status: HomecareBagStatus.ACTIVE },
            include: { stocks: true },
            orderBy: [{ bagCode: 'asc' }, { id: 'asc' }],
          },
        },
      }),
      tx.homecareBagUsage.findMany({
        where: { id: { in: usageIds } },
        include: { bag: { select: { bagCode: true } }, items: true },
      }),
    ]);
    if (!team || recorded.branchId !== input.branchId) {
      throw errors.conflict('SESSION_TEAM_USAGE_SCOPE_INVALID', 'Catatan pemakaian Inventory Tim lama tidak sesuai dengan branch sesi.');
    }
    const expectedByProduct = new Map<string, Prisma.Decimal>();
    for (const material of input.materials.filter((row) => row.baseQuantity.greaterThan(0))) {
      expectedByProduct.set(
        material.masterProductId,
        (expectedByProduct.get(material.masterProductId) ?? new Prisma.Decimal(0)).add(material.baseQuantity),
      );
    }
    const recordedByProduct = new Map<string, Prisma.Decimal>();
    const allocations: TeamStockAllocation[] = [];
    for (const usage of usages) {
      for (const item of usage.items) {
        recordedByProduct.set(
          item.masterProductId,
          (recordedByProduct.get(item.masterProductId) ?? new Prisma.Decimal(0)).add(item.quantity),
        );
        allocations.push({
          bagId: usage.bagId,
          bagCode: usage.bag.bagCode,
          masterProductId: item.masterProductId,
          quantity: item.quantity,
          unit: item.unit || '',
        });
      }
    }
    const productIds = new Set([...expectedByProduct.keys(), ...recordedByProduct.keys()]);
    const matches = [...productIds].every((productId) => (
      (expectedByProduct.get(productId) ?? new Prisma.Decimal(0))
        .equals(recordedByProduct.get(productId) ?? new Prisma.Decimal(0))
    ));
    if (!matches) {
      throw errors.conflict(
        'SESSION_TEAM_USAGE_MATERIAL_MISMATCH',
        'Pemakaian tas yang sudah dicatat tidak sama dengan Material Usage sesi. Koreksi data sebelum menyelesaikan sesi agar stok tidak terpotong ganda.',
      );
    }
    return { team, allocations };
  }

  const clinicalUserIds = [...new Set(input.clinicalUserIds.filter(Boolean))];
  if (clinicalUserIds.length === 0) return null;

  const teams = await tx.homecareTeam.findMany({
    where: {
      branchId: input.branchId,
      isActive: true,
      AND: [
        {
          members: {
            some: {
              userId: input.adminLayananId,
              role: HomecareTeamMemberRole.ADMIN_LAYANAN,
              isActive: true,
            },
          },
        },
        {
          members: {
            some: {
              userId: { in: clinicalUserIds },
              role: { in: [HomecareTeamMemberRole.DOCTOR, HomecareTeamMemberRole.NURSE] },
              isActive: true,
            },
          },
        },
      ],
    },
    include: {
      bags: {
        where: { isActive: true, status: HomecareBagStatus.ACTIVE },
        include: { stocks: true },
        orderBy: [{ bagCode: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ teamCode: 'asc' }, { id: 'asc' }],
    take: 2,
  });

  if (teams.length === 0) return null;
  if (teams.length > 1) {
    throw errors.conflict(
      'SESSION_INVENTORY_TEAM_AMBIGUOUS',
      'Admin Layanan dan nakes sesi terhubung ke lebih dari satu Inventory Tim. Nonaktifkan assignment ganda sebelum menyelesaikan sesi.',
    );
  }

  const team = teams[0];
  if (team.bags.length === 0) {
    throw errors.unprocessable(
      'SESSION_INVENTORY_TEAM_BAG_MISSING',
      `Inventory Tim ${team.name} belum memiliki tas aktif. Sesi tidak dialihkan ke stok cabang karena tim sudah ter-assign.`,
    );
  }

  const allocations: TeamStockAllocation[] = [];
  for (const material of input.materials.filter((row) => row.baseQuantity.greaterThan(0))) {
    let remaining = material.baseQuantity;
    for (const bag of team.bags) {
      const bagStock = bag.stocks.find((stock) => stock.masterProductId === material.masterProductId);
      if (!bagStock || bagStock.stock.lessThanOrEqualTo(0)) continue;
      const quantity = Prisma.Decimal.min(remaining, bagStock.stock);
      if (quantity.greaterThan(0)) {
        allocations.push({
          bagId: bag.id,
          bagCode: bag.bagCode,
          masterProductId: material.masterProductId,
          quantity,
          unit: material.baseUnit,
        });
        remaining = remaining.sub(quantity);
      }
      if (remaining.equals(0)) break;
    }
    if (remaining.greaterThan(0)) {
      throw errors.unprocessable(
        'SESSION_TEAM_STOCK_INSUFFICIENT',
        `Stok Inventory Tim ${team.name} untuk ${material.productName} tidak cukup. Kekurangan ${remaining.toFixed(4)} ${material.baseUnit}.`,
      );
    }
  }

  return { team, allocations };
}

export async function consumeSessionTeamInventory(
  tx: Tx,
  input: {
    sessionId: string;
    sessionCode: string;
    branchId: string;
    actorUserId: string;
    completedAt: Date;
    completionAttemptKey?: string;
    resolved: ResolvedSessionTeamInventory;
  },
) {
  const existing = await tx.homecareMultiBagUsage.findUnique({
    where: { treatmentSessionId: input.sessionId },
  });
  if (existing && existing.status !== 'CANCELLED') return existing;

  const stockRows = await tx.homecareBagStock.findMany({
    where: {
      OR: input.resolved.allocations.map((row) => ({
        bagId: row.bagId,
        masterProductId: row.masterProductId,
      })),
    },
  });
  const stockIds = stockRows.map((row) => row.id).sort();
  if (stockIds.length > 0) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "homecare_bag_stocks"
      WHERE "id" IN (${Prisma.join(stockIds)}) ORDER BY "id" FOR UPDATE
    `);
  }
  const stockByKey = new Map(stockRows.map((row) => [`${row.bagId}:${row.masterProductId}`, row]));

  const payloadHash = allocationHash({
    sessionId: input.sessionId,
    teamId: input.resolved.team.id,
    allocations: input.resolved.allocations,
  });
  const groupData = {
    payloadHash,
    teamId: input.resolved.team.id,
    branchId: input.branchId,
    status: 'COMPLETED' as const,
    usageIds: [],
    bagCount: new Set(input.resolved.allocations.map((row) => row.bagId)).size,
    totalItemLines: input.resolved.allocations.length,
    notes: `Pemakaian Inventory Tim otomatis untuk sesi ${input.sessionCode}.`,
    completedBy: input.actorUserId,
    completedAt: input.completedAt,
  };
  const group = existing
    ? await tx.homecareMultiBagUsage.update({
        where: { id: existing.id },
        data: groupData,
      })
    : await tx.homecareMultiBagUsage.create({
        data: {
          completionNumber: completionCode('TIM'),
          idempotencyKey: input.completionAttemptKey
            ? `TREATMENT-TEAM-INVENTORY-${input.sessionId}-${input.completionAttemptKey}`
            : `TREATMENT-TEAM-INVENTORY-${input.sessionId}`,
          treatmentSessionId: input.sessionId,
          ...groupData,
        },
      });

  const allocationsByBag = new Map<string, TeamStockAllocation[]>();
  for (const allocation of input.resolved.allocations) {
    const rows = allocationsByBag.get(allocation.bagId) ?? [];
    rows.push(allocation);
    allocationsByBag.set(allocation.bagId, rows);
  }

  const usageIds: string[] = [];
  for (const bag of input.resolved.team.bags.filter((row) => allocationsByBag.has(row.id))) {
    const allocations = allocationsByBag.get(bag.id)!;
    const usage = await tx.homecareBagUsage.create({
      data: {
        usageCode: completionCode('TBU'),
        bagId: bag.id,
        teamId: input.resolved.team.id,
        treatmentSessionId: input.sessionId,
        multiBagUsageId: group.id,
        usedBy: input.actorUserId,
        status: 'COMPLETED',
        usageDate: input.completedAt,
        notes: `Pemakaian otomatis sesi ${input.sessionCode}.`,
        items: {
          create: allocations.map((row) => ({
            masterProductId: row.masterProductId,
            quantity: row.quantity,
            unit: row.unit,
            notes: `Sumber stok: ${bag.bagCode}`,
          })),
        },
      },
    });
    usageIds.push(usage.id);

    for (const allocation of allocations) {
      const key = `${allocation.bagId}:${allocation.masterProductId}`;
      const stock = stockByKey.get(key);
      if (!stock) {
        throw errors.unprocessable('SESSION_TEAM_STOCK_MISSING', 'Stok produk pada tas Inventory Tim tidak ditemukan.');
      }
      const changed = await tx.homecareBagStock.updateMany({
        where: { id: stock.id, stock: { gte: allocation.quantity } },
        data: { stock: { decrement: allocation.quantity } },
      });
      if (changed.count !== 1) {
        throw errors.unprocessable('SESSION_TEAM_STOCK_CHANGED', 'Stok Inventory Tim berubah atau tidak mencukupi saat sesi diselesaikan.');
      }
      await tx.logisticStockMutation.create({
        data: {
          mutationCode: completionCode('LGM'),
          locationType: LogisticLocationType.HOMECARE_BAG,
          locationId: allocation.bagId,
          homecareBagId: allocation.bagId,
          masterProductId: allocation.masterProductId,
          type: LogisticTransactionType.BAG_USAGE,
          quantity: allocation.quantity,
          stockBefore: stock.stock,
          stockAfter: stock.stock.sub(allocation.quantity),
          referenceType: 'TREATMENT_TEAM_INVENTORY',
          referenceId: group.id,
          notes: `Pemakaian otomatis sesi ${input.sessionCode}.`,
          createdBy: input.actorUserId,
        },
      });
      stock.stock = stock.stock.sub(allocation.quantity);
    }
  }

  return tx.homecareMultiBagUsage.update({
    where: { id: group.id },
    data: { usageIds },
  });
}

export async function restoreSessionTeamInventory(
  tx: Tx,
  input: {
    completionId: string;
    sessionCode: string;
    actorUserId: string;
    reason: string;
  },
) {
  const completion = await tx.homecareMultiBagUsage.findUnique({ where: { id: input.completionId } });
  if (!completion || completion.status === 'CANCELLED') return;
  const usageIds = Array.isArray(completion.usageIds)
    ? completion.usageIds.filter((id): id is string => typeof id === 'string')
    : [];
  const usages = await tx.homecareBagUsage.findMany({
    where: { id: { in: usageIds } },
    include: { items: true },
  });

  for (const usage of usages) {
    for (const item of usage.items) {
      const existingStock = await tx.homecareBagStock.findUnique({
        where: { bagId_masterProductId: { bagId: usage.bagId, masterProductId: item.masterProductId } },
      });
      const stockBefore = existingStock?.stock ?? new Prisma.Decimal(0);
      await tx.homecareBagStock.upsert({
        where: { bagId_masterProductId: { bagId: usage.bagId, masterProductId: item.masterProductId } },
        create: {
          bagId: usage.bagId,
          masterProductId: item.masterProductId,
          stock: item.quantity,
          minThreshold: 0,
        },
        update: { stock: { increment: item.quantity } },
      });
      await tx.logisticStockMutation.create({
        data: {
          mutationCode: completionCode('LGM'),
          locationType: LogisticLocationType.HOMECARE_BAG,
          locationId: usage.bagId,
          homecareBagId: usage.bagId,
          masterProductId: item.masterProductId,
          type: LogisticTransactionType.BAG_RETURN,
          quantity: item.quantity,
          stockBefore,
          stockAfter: stockBefore.add(item.quantity),
          referenceType: 'TREATMENT_TEAM_INVENTORY_REVERSAL',
          referenceId: completion.id,
          notes: `Pembatalan sesi ${input.sessionCode}: ${input.reason}`,
          createdBy: input.actorUserId,
        },
      });
    }
    await tx.homecareBagUsage.update({ where: { id: usage.id }, data: { status: 'CANCELLED' } });
  }
  await tx.homecareMultiBagUsage.update({
    where: { id: completion.id },
    data: { status: 'CANCELLED' },
  });
}
