import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_INFUSION_KIT_SKU = 'PRD-INF-SET-002';

export async function resolveInfusionKitAvailability(
  branchId: string,
  client: DbClient = prisma,
) {
  const kitProduct = await client.masterProduct.findFirst({
    where: { sku: DEFAULT_INFUSION_KIT_SKU, isActive: true },
    include: {
      kitComponents: {
        where: { componentProduct: { isActive: true } },
        include: { componentProduct: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!kitProduct || kitProduct.kitComponents.length === 0) {
    return {
      configured: false as const,
      kitProduct,
      available: false,
      availableSessionCount: 0,
      components: [],
    };
  }

  const inventoryItems = await client.inventoryItem.findMany({
    where: {
      branchId,
      masterProductId: {
        in: kitProduct.kitComponents.map((component) => component.componentProductId),
      },
    },
    include: { balances: true },
  });
  const inventoryByProduct = new Map(
    inventoryItems.map((item) => [item.masterProductId, item]),
  );

  const components = kitProduct.kitComponents.map((component) => {
    const inventoryItem = inventoryByProduct.get(component.componentProductId) ?? null;
    const conversionFactor = component.componentProduct.conversionFactor;
    const requiredBaseQuantity = component.quantity.div(conversionFactor);
    const availableBaseQuantity = inventoryItem
      ? inventoryItem.balances.reduce(
          (sum, balance) => sum
            .add(balance.onHandQty)
            .sub(balance.reservedQty)
            .sub(balance.quarantineQty),
          new Prisma.Decimal(0),
        )
      : new Prisma.Decimal(0);
    const availableSessionCount = requiredBaseQuantity.greaterThan(0)
      ? availableBaseQuantity.div(requiredBaseQuantity).floor().toNumber()
      : 0;

    return {
      component,
      inventoryItem,
      requiredBaseQuantity,
      availableBaseQuantity,
      availableUsageQuantity: availableBaseQuantity.mul(conversionFactor),
      availableSessionCount,
      isAvailable: Boolean(inventoryItem)
        && availableBaseQuantity.greaterThanOrEqualTo(requiredBaseQuantity),
    };
  });

  const availableSessionCount = Math.min(
    ...components.map((component) => component.availableSessionCount),
  );

  return {
    configured: true as const,
    kitProduct,
    available: components.every((component) => component.isAvailable),
    availableSessionCount,
    components,
  };
}

export function serializeInfusionKitAvailability(
  result: Awaited<ReturnType<typeof resolveInfusionKitAvailability>>,
) {
  return {
    configured: result.configured,
    available: result.available,
    availableSessionCount: result.availableSessionCount,
    kit: result.kitProduct
      ? {
          id: result.kitProduct.id,
          sku: result.kitProduct.sku,
          name: result.kitProduct.name,
        }
      : null,
    components: result.components.map((item) => ({
      productId: item.component.componentProduct.id,
      sku: item.component.componentProduct.sku,
      name: item.component.componentProduct.name,
      inventoryItemId: item.inventoryItem?.id ?? null,
      requiredUsageQuantity: item.component.quantity.toFixed(4),
      usageUnit: item.component.componentProduct.usageUnit,
      availableBaseQuantity: item.availableBaseQuantity.toFixed(4),
      availableUsageQuantity: item.availableUsageQuantity.toFixed(4),
      availableSessionCount: item.availableSessionCount,
      isAvailable: item.isAvailable,
      reason: !item.inventoryItem
        ? 'NOT_IN_BRANCH_INVENTORY'
        : item.isAvailable
          ? null
          : 'INSUFFICIENT_STOCK',
    })),
  };
}
