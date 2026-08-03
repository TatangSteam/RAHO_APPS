import type { AssignPackageInput } from '../packages.schema';

export type AddOnAssignmentInput = AssignPackageInput['addOns'][number];

type AddOnCatalogItem = Omit<AddOnAssignmentInput, 'quantity'>;

const ADD_ON_CATALOG = [
  { type: 'AIR_NANO', name: 'Air Nano Kuning 600ml 1 Botol', code: 'ARN-CK-V06-BT', price: 15_000 },
  { type: 'AIR_NANO', name: 'Air Nano Biru 600ml 1 Botol', code: 'ARN-CB-V06-BT', price: 15_000 },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 600ml 1 Botol', code: 'ARN-CH-V06-BT', price: 15_000 },
  { type: 'AIR_NANO', name: 'Air Nano Kuning 1500ml 1 Botol', code: 'ARN-CK-V15-BT', price: 35_000 },
  { type: 'AIR_NANO', name: 'Air Nano Biru 1500ml 1 Botol', code: 'ARN-CB-V15-BT', price: 35_000 },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 1500ml 1 Botol', code: 'ARN-CH-V15-BT', price: 35_000 },
  { type: 'AIR_NANO', name: 'Air Nano Kuning 600ml 1 Dus', code: 'ARN-CK-V06-DS', price: 360_000 },
  { type: 'AIR_NANO', name: 'Air Nano Biru 600ml 1 Dus', code: 'ARN-CB-V06-DS', price: 360_000 },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 600ml 1 Dus', code: 'ARN-CH-V06-DS', price: 360_000 },
  { type: 'AIR_NANO', name: 'Air Nano Kuning 1500ml 1 Dus', code: 'ARN-CK-V15-DS', price: 420_000 },
  { type: 'AIR_NANO', name: 'Air Nano Biru 1500ml 1 Dus', code: 'ARN-CB-V15-DS', price: 420_000 },
  { type: 'AIR_NANO', name: 'Air Nano Hijau H2S 1500ml 1 Dus', code: 'ARN-CH-V15-DS', price: 420_000 },
  { type: 'ROKOK_KENKOU', name: 'Rokok Kenkou 1 Bungkus', code: 'RKK-KK-BK', price: 20_000 },
  { type: 'KONSULTASI_GIZI', name: 'Konsultasi Gizi', code: 'KG-001', price: 0 },
  { type: 'KONSULTASI_PSIKOLOG', name: 'Konsultasi Psikolog', code: 'KP-001', price: 0 },
  { type: 'LAINNYA', name: 'Lainnya', code: 'LAIN-001', price: 0 },
] as const satisfies readonly AddOnCatalogItem[];

const ADD_ON_BY_CODE = new Map<string, AddOnCatalogItem>(
  ADD_ON_CATALOG.map((item) => [item.code, item]),
);

/**
 * Resolve add-on metadata and prices from the server-owned catalog. Client
 * values are display hints only and must never determine finance totals.
 */
export function normalizeAddOnAssignments(
  addOns: readonly AddOnAssignmentInput[],
): AddOnAssignmentInput[] {
  const normalizedByCode = new Map<string, AddOnAssignmentInput>();

  for (const addOn of addOns) {
    const catalogItem = ADD_ON_BY_CODE.get(addOn.code);

    if (!catalogItem || catalogItem.type !== addOn.type) {
      throw new InvalidAddOnError(addOn.code);
    }

    const current = normalizedByCode.get(addOn.code);
    normalizedByCode.set(
      addOn.code,
      {
        ...catalogItem,
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
