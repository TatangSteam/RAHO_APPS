import { StockMutationType } from '@prisma/client';

const DEFAULT_NO_IN_IFA250_ML = 2.5;
const MATERIAL_DELTA_EPSILON = 0.0001;

type DoseField =
  | 'ifa250'
  | 'ifa500'
  | 'hho'
  | 'hhoKonsentrat'
  | 'h2'
  | 'no'
  | 'gaso'
  | 'o2'
  | 'o3'
  | 'edta'
  | 'mb'
  | 'h2s'
  | 'kcl'
  | 'jmlNb';

type DoseValues = Record<DoseField, number | null>;

type TherapyPlanLike = Partial<Record<DoseField, unknown>> & {
  id: string;
  ifaSubstances?: unknown;
};

type MaterialDefinition = {
  field: Exclude<DoseField, 'jmlNb'>;
  sku: string;
  namePattern: string;
  unit: string;
};

const MATERIALS: MaterialDefinition[] = [
  { field: 'ifa500', sku: 'PRD-INF-IFA-001', namePattern: 'IFA 500ml', unit: 'Botol' },
  { field: 'ifa250', sku: 'PRD-INF-IFA-002', namePattern: 'IFA + NO 2,5ml', unit: 'Botol' },
  { field: 'hho', sku: 'PRD-NBT-HHO-001', namePattern: 'NB-HHO', unit: 'ml' },
  { field: 'hhoKonsentrat', sku: 'PRD-NBT-HHO-002', namePattern: 'HHO Konsentrat', unit: 'ml' },
  { field: 'h2', sku: 'PRD-NBT-CH2-001', namePattern: 'H2', unit: 'ml' },
  { field: 'no', sku: 'PRD-NBT-CNO-001', namePattern: 'NB NO', unit: 'ml' },
  { field: 'gaso', sku: 'PRD-NBT-CGT-001', namePattern: 'NB Gasotransmitter', unit: 'ml' },
  { field: 'o3', sku: 'PRD-NBT-CO3-001', namePattern: 'Ozone', unit: 'ml' },
  { field: 'o2', sku: 'PRD-NBT-CO2-001', namePattern: 'O2', unit: 'ml' },
  { field: 'edta', sku: 'PRD-NBT-EDT-001', namePattern: 'EDTA', unit: 'ml' },
  { field: 'mb', sku: 'PRD-NBT-CMB-001', namePattern: 'NB Methyln Blue', unit: 'ml' },
  { field: 'h2s', sku: 'PRD-NBT-H2S-001', namePattern: 'Cairan H2S', unit: 'ml' },
  { field: 'kcl', sku: 'PRD-NBT-KCL-001', namePattern: 'KCL', unit: 'ml' },
];

function toPositiveNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function toDoseValue(value: unknown): number | null {
  const numericValue = toPositiveNumber(value);
  return numericValue > 0 ? Number(numericValue.toFixed(2)) : null;
}

function normalizeSubstanceName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getNoMlPerIfa250Bottle(ifaSubstances: unknown): number {
  if (!Array.isArray(ifaSubstances)) {
    return DEFAULT_NO_IN_IFA250_ML;
  }

  const noSubstance = ifaSubstances.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const raw = item as Record<string, unknown>;
    const unit = String(raw.unit || 'ml').trim().toLowerCase();

    return normalizeSubstanceName(raw.name) === 'no' && unit === 'ml';
  }) as Record<string, unknown> | undefined;

  return toPositiveNumber(noSubstance?.amount) || DEFAULT_NO_IN_IFA250_ML;
}

function getPlannedActualNoMl(
  planNoMl: unknown,
  actualIfa250Bottles: unknown,
  ifaSubstances: unknown
): number {
  const plannedNo = toPositiveNumber(planNoMl);
  const ifa250Bottles = toPositiveNumber(actualIfa250Bottles);
  const includedInIfa = ifa250Bottles > 0
    ? getNoMlPerIfa250Bottle(ifaSubstances) * ifa250Bottles
    : 0;

  return Number(Math.max(plannedNo - includedInIfa, 0).toFixed(2));
}

function buildActualDosesFromPlan(plan: TherapyPlanLike): DoseValues {
  const ifa250 = toDoseValue(plan.ifa250);

  return {
    ifa250,
    ifa500: toDoseValue(plan.ifa500),
    hho: toDoseValue(plan.hho),
    hhoKonsentrat: toDoseValue(plan.hhoKonsentrat),
    h2: toDoseValue(plan.h2),
    no: toDoseValue(getPlannedActualNoMl(plan.no, ifa250, plan.ifaSubstances)),
    gaso: toDoseValue(plan.gaso),
    o2: toDoseValue(plan.o2),
    o3: toDoseValue(plan.o3),
    edta: toDoseValue(plan.edta),
    mb: toDoseValue(plan.mb),
    h2s: toDoseValue(plan.h2s),
    kcl: toDoseValue(plan.kcl),
    jmlNb: toDoseValue(plan.jmlNb),
  };
}

function buildActualDosesFromInfusion(infusion: Partial<Record<DoseField, unknown>>): DoseValues {
  return {
    ifa250: toDoseValue(infusion.ifa250),
    ifa500: toDoseValue(infusion.ifa500),
    hho: toDoseValue(infusion.hho),
    hhoKonsentrat: toDoseValue(infusion.hhoKonsentrat),
    h2: toDoseValue(infusion.h2),
    no: toDoseValue(infusion.no),
    gaso: toDoseValue(infusion.gaso),
    o2: toDoseValue(infusion.o2),
    o3: toDoseValue(infusion.o3),
    edta: toDoseValue(infusion.edta),
    mb: toDoseValue(infusion.mb),
    h2s: toDoseValue(infusion.h2s),
    kcl: toDoseValue(infusion.kcl),
    jmlNb: toDoseValue(infusion.jmlNb),
  };
}

async function findInventoryItem(tx: any, branchId: string, material: MaterialDefinition) {
  const bySku = await tx.inventoryItem.findFirst({
    where: {
      branchId,
      masterProduct: {
        sku: material.sku,
        isActive: true,
      },
    },
    include: { masterProduct: true },
  });

  if (bySku) return bySku;

  return tx.inventoryItem.findFirst({
    where: {
      branchId,
      masterProduct: {
        name: {
          contains: material.namePattern,
          mode: 'insensitive',
        },
        isActive: true,
      },
    },
    include: { masterProduct: true },
  });
}

function getMaterialQuantity(doses: DoseValues, material: MaterialDefinition): number {
  return toPositiveNumber(doses[material.field]);
}

export async function syncSessionInfusionToTherapyPlan(
  tx: any,
  params: {
    sessionId: string;
    therapyPlan: TherapyPlanLike;
    userId: string;
  }
) {
  const session = await tx.treatmentSession.findUnique({
    where: { id: params.sessionId },
    select: {
      id: true,
      branchId: true,
      sessionCode: true,
      infusion: true,
    },
  });

  if (!session?.infusion) {
    return { synced: false, adjustedMaterials: 0 };
  }

  const oldDoses = buildActualDosesFromInfusion(session.infusion);
  const newDoses = buildActualDosesFromPlan(params.therapyPlan);
  let adjustedMaterials = 0;

  for (const material of MATERIALS) {
    const oldUsageQuantity = getMaterialQuantity(oldDoses, material);
    const newUsageQuantity = getMaterialQuantity(newDoses, material);
    const deltaUsageQuantity = Number((newUsageQuantity - oldUsageQuantity).toFixed(4));

    if (Math.abs(deltaUsageQuantity) < MATERIAL_DELTA_EPSILON) {
      continue;
    }

    const inventoryItem = await findInventoryItem(tx, session.branchId, material);
    if (!inventoryItem) {
      continue;
    }

    const conversionFactor = Number(inventoryItem.masterProduct.conversionFactor) || 1;
    const deltaBaseQuantity = deltaUsageQuantity / conversionFactor;
    const stockBefore = Number(inventoryItem.stock);
    const stockAfter = stockBefore - deltaBaseQuantity;

    if (stockAfter < 0) {
      const availableUsageUnit = stockBefore * conversionFactor;
      throw {
        status: 409,
        code: 'STOCK_INSUFFICIENT',
        message: `Stok ${inventoryItem.masterProduct.name} tidak mencukupi untuk penyesuaian therapy plan. Tersedia: ${stockBefore.toFixed(2)} ${inventoryItem.masterProduct.baseUnit} (${availableUsageUnit.toFixed(0)} ${inventoryItem.masterProduct.usageUnit})`,
      };
    }

    await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { stock: stockAfter },
    });

    await tx.stockMutation.create({
      data: {
        inventoryItemId: inventoryItem.id,
        type: deltaBaseQuantity > 0 ? StockMutationType.USED : StockMutationType.ADJUSTMENT,
        quantity: Math.abs(deltaBaseQuantity),
        stockBefore,
        stockAfter,
        referenceType: 'InfusionExecution',
        referenceId: session.infusion.id,
        notes:
          deltaUsageQuantity > 0
            ? `Penambahan penggunaan karena therapy plan sesi ${session.sessionCode} diedit: +${deltaUsageQuantity.toFixed(2)} ${inventoryItem.masterProduct.usageUnit} (${Math.abs(deltaBaseQuantity).toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`
            : `Pengembalian stok karena therapy plan sesi ${session.sessionCode} diedit: ${deltaUsageQuantity.toFixed(2)} ${inventoryItem.masterProduct.usageUnit} (${Math.abs(deltaBaseQuantity).toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`,
        createdBy: params.userId,
      },
    });

    const existingUsage = await tx.materialUsage.findFirst({
      where: {
        treatmentSessionId: params.sessionId,
        inventoryItemId: inventoryItem.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (newUsageQuantity > 0) {
      if (existingUsage) {
        await tx.materialUsage.update({
          where: { id: existingUsage.id },
          data: {
            quantity: newUsageQuantity,
            unit: inventoryItem.masterProduct.usageUnit,
            recordedBy: params.userId,
          },
        });
      } else {
        await tx.materialUsage.create({
          data: {
            treatmentSessionId: params.sessionId,
            inventoryItemId: inventoryItem.id,
            quantity: newUsageQuantity,
            unit: inventoryItem.masterProduct.usageUnit,
            recordedBy: params.userId,
          },
        });
      }
    } else if (existingUsage) {
      await tx.materialUsage.delete({
        where: { id: existingUsage.id },
      });
    }

    adjustedMaterials += 1;
  }

  await tx.infusionExecution.update({
    where: { id: session.infusion.id },
    data: {
      therapyPlanId: params.therapyPlan.id,
      ...newDoses,
    },
  });

  return { synced: true, adjustedMaterials };
}
