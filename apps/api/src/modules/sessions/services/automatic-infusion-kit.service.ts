import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { buildAutomaticKitMaterialUsageRows } from './session-creation.helpers';

type DbClient = Prisma.TransactionClient | typeof prisma;

const CURRENT_MATERIAL_POLICY_VERSION = 2;
const DEFAULT_INFUSION_KIT_SKU = 'PRD-INF-SET-002';

interface EnsureAutomaticInfusionKitInput {
  sessionId: string;
  branchId: string;
  materialPolicyVersion: number;
  recordedBy: string;
}

/**
 * Backfills mandatory infusion-kit material drafts for current-policy sessions.
 * This keeps sessions created before automatic kit insertion compatible with
 * the same completion rules as newly created sessions.
 */
export async function ensureAutomaticInfusionKitMaterialDrafts(
  client: DbClient,
  input: EnsureAutomaticInfusionKitInput,
): Promise<number> {
  if (input.materialPolicyVersion < CURRENT_MATERIAL_POLICY_VERSION) return 0;

  const kitComponents = await client.productKitComponent.findMany({
    where: {
      kitProduct: { sku: DEFAULT_INFUSION_KIT_SKU, isActive: true },
      componentProduct: { isActive: true },
    },
    include: { componentProduct: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  if (kitComponents.length === 0) {
    throw errors.unprocessable(
      'INFUS_SET_NOT_CONFIGURED',
      'Komponen "Infus Set + Pelengkap" belum dikonfigurasi di inventory. Hubungi administrator.',
    );
  }

  const existingMaterials = await client.materialUsage.findMany({
    where: { treatmentSessionId: input.sessionId },
    select: { inventoryItem: { select: { masterProductId: true } } },
  });
  const existingProductIds = new Set(
    existingMaterials.map((material) => material.inventoryItem.masterProductId),
  );
  const missingComponents = kitComponents.filter(
    (component) => !existingProductIds.has(component.componentProductId),
  );
  if (missingComponents.length === 0) return 0;

  const inventoryItems = await client.inventoryItem.findMany({
    where: {
      branchId: input.branchId,
      masterProductId: { in: missingComponents.map((component) => component.componentProductId) },
    },
    select: { id: true, masterProductId: true },
  });
  const inventoryByProduct = new Map(
    inventoryItems.map((inventoryItem) => [inventoryItem.masterProductId, inventoryItem]),
  );
  const unavailableComponents = missingComponents.filter(
    (component) => !inventoryByProduct.has(component.componentProductId),
  );
  if (unavailableComponents.length > 0) {
    throw errors.unprocessable(
      'INFUS_KIT_NOT_IN_BRANCH_INVENTORY',
      `Komponen "Infus Set + Pelengkap" belum ada di inventory cabang: ${unavailableComponents
        .map((component) => component.componentProduct.name)
        .join(', ')}.`,
    );
  }

  const rows = buildAutomaticKitMaterialUsageRows(
    input.sessionId,
    input.recordedBy,
    missingComponents.map((component) => ({
      inventoryItemId: inventoryByProduct.get(component.componentProductId)!.id,
      quantity: component.quantity,
      unit: component.componentProduct.usageUnit,
      conversionFactor: component.componentProduct.conversionFactor,
    })),
  );

  const result = await client.materialUsage.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}
