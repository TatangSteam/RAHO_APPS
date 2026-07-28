import { BranchType, Prisma } from '@prisma/client';

export const PARTNERSHIP_GOODS_SHIPPED_EVENT = 'PARTNERSHIP_GOODS_SHIPPED';

export function isPartnershipBranch(branchType: BranchType): boolean {
  return branchType === BranchType.PARTNERSHIP;
}

export function shouldSyncTreatmentRevenueToZoho(branchType: BranchType): boolean {
  return !isPartnershipBranch(branchType);
}

type PartnershipInvoiceItem = {
  masterProductId: string;
  sku: string | null;
  quantity: Prisma.Decimal;
  pricePerUnit: Prisma.Decimal;
};

type PartnershipShipmentCost = {
  masterProductId: string;
  quantity: Prisma.Decimal;
  totalCost: Prisma.Decimal;
};

export type PartnershipGoodsShippedPayloadInput = {
  partnershipBranchId: string;
  stockRequestId: string;
  stockRequestInvoiceId: string;
  shipmentCode: string;
  invoiceNumber: string;
  revenueAmount: Prisma.Decimal;
  invoiceItems: PartnershipInvoiceItem[];
  shipmentCosts: PartnershipShipmentCost[];
};

export function buildPartnershipGoodsShippedPayload(
  input: PartnershipGoodsShippedPayloadInput,
) {
  const invoiceByProduct = new Map(
    input.invoiceItems.map((item) => [item.masterProductId, item]),
  );
  const costAmount = input.shipmentCosts.reduce(
    (sum, item) => sum.add(item.totalCost),
    new Prisma.Decimal(0),
  );

  const items = input.shipmentCosts.map((cost) => {
    const invoiceItem = invoiceByProduct.get(cost.masterProductId);
    if (!invoiceItem) {
      throw new Error(
        `Invoice item untuk product ${cost.masterProductId} tidak ditemukan.`,
      );
    }
    if (!cost.quantity.isPositive()) {
      throw new Error(
        `Quantity shipment untuk product ${cost.masterProductId} harus positif.`,
      );
    }
    return {
      masterProductId: cost.masterProductId,
      sku: invoiceItem.sku,
      quantity: cost.quantity.toFixed(4),
      unitPrice: invoiceItem.pricePerUnit.toFixed(2),
      unitCost: cost.totalCost.div(cost.quantity).toFixed(4),
      totalCost: cost.totalCost.toFixed(4),
    };
  });

  return {
    partnershipBranchId: input.partnershipBranchId,
    stockRequestId: input.stockRequestId,
    stockRequestInvoiceId: input.stockRequestInvoiceId,
    shipmentCode: input.shipmentCode,
    invoiceNumber: input.invoiceNumber,
    revenueAmount: input.revenueAmount.toFixed(2),
    costAmount: costAmount.toFixed(4),
    grossProfit: input.revenueAmount.sub(costAmount).toFixed(4),
    items,
  };
}
