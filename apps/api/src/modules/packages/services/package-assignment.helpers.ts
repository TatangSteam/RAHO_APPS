import type { AssignPackageInput } from '../packages.schema';

export type AddOnAssignmentInput = AssignPackageInput['addOns'][number];

export interface NormalizedAddOnAssignment extends AddOnAssignmentInput {
  inventorySku?: string;
  inventoryQuantityPerUnit?: number;
}

type AddOnCatalogItem = Omit<NormalizedAddOnAssignment, 'quantity'> & {
  aliases?: readonly string[];
};

const ADD_ON_CATALOG: readonly AddOnCatalogItem[] = [
  { type: 'AIR_NANO', name: 'Air Nano Kuning 600ml 1 Botol', code: 'PRD-ANN-KNG-001', price: 15_000, inventorySku: 'PRD-ANN-KNG-001', inventoryQuantityPerUnit: 1, aliases: ['ARN-CK-V06-BT'] },
  { type: 'AIR_NANO', name: 'Air Nano Biru 600ml 1 Botol', code: 'PRD-ANN-BRU-001', price: 15_000, inventorySku: 'PRD-ANN-BRU-001', inventoryQuantityPerUnit: 1, aliases: ['ARN-CB-V06-BT'] },
  { type: 'AIR_NANO', name: 'Air Nano Hijau 600ml 1 Botol', code: 'PRD-ANN-HJU-001', price: 15_000, inventorySku: 'PRD-ANN-HJU-001', inventoryQuantityPerUnit: 1, aliases: ['ARN-CH-V06-BT'] },
  { type: 'AIR_NANO', name: 'Air Nano Kuning 1500ml 1 Botol', code: 'PRD-ANN-KNG-002', price: 35_000, inventorySku: 'PRD-ANN-KNG-002', inventoryQuantityPerUnit: 1, aliases: ['ARN-CK-V15-BT'] },
  { type: 'AIR_NANO', name: 'Air Nano Biru 1500ml 1 Botol', code: 'PRD-ANN-BRU-002', price: 35_000, inventorySku: 'PRD-ANN-BRU-002', inventoryQuantityPerUnit: 1, aliases: ['ARN-CB-V15-BT'] },
  { type: 'AIR_NANO', name: 'Air Nano Hijau 1500ml 1 Botol', code: 'PRD-ANN-HJU-002', price: 35_000, inventorySku: 'PRD-ANN-HJU-002', inventoryQuantityPerUnit: 1, aliases: ['ARN-CH-V15-BT'] },
  { type: 'AIR_NANO', name: 'Air Nano Kuning 600ml 1 Dus', code: 'PRD-ANN-KNG-003', price: 360_000, inventorySku: 'PRD-ANN-KNG-001', inventoryQuantityPerUnit: 24, aliases: ['ARN-CK-V06-DS'] },
  { type: 'AIR_NANO', name: 'Air Nano Biru 600ml 1 Dus', code: 'PRD-ANN-BRU-003', price: 360_000, inventorySku: 'PRD-ANN-BRU-001', inventoryQuantityPerUnit: 24, aliases: ['ARN-CB-V06-DS'] },
  { type: 'AIR_NANO', name: 'Air Nano Hijau 600ml 1 Dus', code: 'PRD-ANN-HJU-003', price: 360_000, inventorySku: 'PRD-ANN-HJU-001', inventoryQuantityPerUnit: 24, aliases: ['ARN-CH-V06-DS'] },
  { type: 'AIR_NANO', name: 'Air Nano Kuning 1500ml 1 Dus', code: 'PRD-ANN-KNG-004', price: 420_000, inventorySku: 'PRD-ANN-KNG-002', inventoryQuantityPerUnit: 12, aliases: ['ARN-CK-V15-DS'] },
  { type: 'AIR_NANO', name: 'Air Nano Biru 1500ml 1 Dus', code: 'PRD-ANN-BRU-004', price: 420_000, inventorySku: 'PRD-ANN-BRU-002', inventoryQuantityPerUnit: 12, aliases: ['ARN-CB-V15-DS'] },
  { type: 'AIR_NANO', name: 'Air Nano Hijau 1500ml 1 Dus', code: 'PRD-ANN-HJU-004', price: 420_000, inventorySku: 'PRD-ANN-HJU-002', inventoryQuantityPerUnit: 12, aliases: ['ARN-CH-V15-DS'] },
  { type: 'ROKOK_KENKOU', name: 'Rokok Kenkou 1 Bungkus', code: 'PRD-CON-RKK-001', price: 20_000, inventorySku: 'PRD-CON-RKK-001', inventoryQuantityPerUnit: 1, aliases: ['RKK-KK-BK'] },
  { type: 'KONSULTASI_GIZI', name: 'Konsultasi Gizi', code: 'KG-001', price: 0 },
  { type: 'KONSULTASI_PSIKOLOG', name: 'Konsultasi Psikolog', code: 'KP-001', price: 0 },
  { type: 'LAINNYA', name: 'Lainnya', code: 'LAIN-001', price: 0 },
];

const ADD_ON_BY_CODE = new Map<string, AddOnCatalogItem>(
  ADD_ON_CATALOG.flatMap((item) => [
    [item.code, item] as const,
    ...(item.aliases || []).map((alias) => [alias, item] as const),
  ]),
);

/**
 * Resolve add-on metadata and prices from the server-owned catalog. Client
 * values are display hints only and must never determine finance totals.
 */
export function normalizeAddOnAssignments(
  addOns: readonly AddOnAssignmentInput[],
): NormalizedAddOnAssignment[] {
  const normalizedByCode = new Map<string, NormalizedAddOnAssignment>();

  for (const addOn of addOns) {
    const catalogItem = ADD_ON_BY_CODE.get(addOn.code);

    if (!catalogItem || catalogItem.type !== addOn.type) {
      throw new InvalidAddOnError(addOn.code);
    }

    const current = normalizedByCode.get(catalogItem.code);
    normalizedByCode.set(
      catalogItem.code,
      {
        type: catalogItem.type,
        name: catalogItem.name,
        code: catalogItem.code,
        price: catalogItem.price,
        inventorySku: catalogItem.inventorySku,
        inventoryQuantityPerUnit: catalogItem.inventoryQuantityPerUnit,
        quantity: (current?.quantity || 0) + addOn.quantity,
      },
    );
  }

  return Array.from(normalizedByCode.values());
}

export class InvalidAddOnError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_ADD_ON';

  constructor(addOnCode: string) {
    super(`Add-on ${addOnCode} tidak valid`);
    this.name = 'InvalidAddOnError';
  }
}

export interface PurchaseDiscountResult {
  percentAmount: number;
  fixedAmount: number;
  totalDiscountAmount: number;
}

export function calculatePurchaseDiscount(
  subtotal: number,
  discountPercent = 0,
  discountAmount = 0,
): PurchaseDiscountResult {
  const safeSubtotal = Math.max(0, Math.round(subtotal));
  const percentAmount = Math.round((safeSubtotal * discountPercent) / 100);
  const fixedAmount = Math.round(discountAmount);
  const totalDiscountAmount = Math.min(safeSubtotal, percentAmount + fixedAmount);

  return {
    percentAmount,
    fixedAmount,
    totalDiscountAmount,
  };
}

interface PackageDiscountAllocation {
  packageSubtotal: number;
  purchaseSubtotal: number;
  purchaseDiscount: number;
  remainingDiscount: number;
  isLastPackage: boolean;
  hasAddOns: boolean;
}

export function allocatePackageDiscount({
  packageSubtotal,
  purchaseSubtotal,
  purchaseDiscount,
  remainingDiscount,
  isLastPackage,
  hasAddOns,
}: PackageDiscountAllocation): number {
  if (purchaseDiscount <= 0 || purchaseSubtotal <= 0 || packageSubtotal <= 0) {
    return 0;
  }

  const allocatedDiscount = isLastPackage && !hasAddOns
    ? remainingDiscount
    : Math.round((packageSubtotal / purchaseSubtotal) * purchaseDiscount);

  return Math.min(packageSubtotal, Math.max(0, allocatedDiscount));
}
