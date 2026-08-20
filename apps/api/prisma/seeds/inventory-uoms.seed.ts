import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

function legacyUomIdentity(name: string) {
  const normalizedName = name.trim();
  const hash = createHash('md5').update(normalizedName.toLowerCase()).digest('hex');

  return {
    id: `uom_${hash.slice(0, 20)}`,
    code: `UOM_${hash.slice(0, 12).toUpperCase()}`,
    name: normalizedName,
  };
}

/** Ensure legacy product unit strings have relational UOM data. */
export async function backfillProductUoms(prisma: PrismaClient): Promise<number> {
  const products = await prisma.masterProduct.findMany({
    select: { id: true, baseUnit: true, usageUnit: true, conversionFactor: true },
  });

  const identities = new Map<string, ReturnType<typeof legacyUomIdentity>>();
  for (const product of products) {
    for (const unitName of [product.baseUnit, product.usageUnit]) {
      if (!unitName?.trim()) continue;
      const identity = legacyUomIdentity(unitName);
      if (!identities.has(identity.name.toLowerCase())) {
        identities.set(identity.name.toLowerCase(), identity);
      }
    }
  }

  for (const identity of identities.values()) {
    await prisma.unitOfMeasure.upsert({
      where: { code: identity.code },
      update: { name: identity.name },
      create: { ...identity, category: 'LEGACY' },
    });
  }

  const uoms = await prisma.unitOfMeasure.findMany({
    where: { code: { in: [...identities.values()].map((identity) => identity.code) } },
    select: { id: true, code: true },
  });
  const uomIdByCode = new Map(uoms.map((uom) => [uom.code, uom.id]));

  for (const product of products) {
    const baseUomId = uomIdByCode.get(legacyUomIdentity(product.baseUnit).code);
    const usageUomId = uomIdByCode.get(legacyUomIdentity(product.usageUnit).code);
    if (!baseUomId || !usageUomId) continue;

    await prisma.masterProduct.update({
      where: { id: product.id },
      data: { baseUomId, usageUomId },
    });
    await prisma.unitConversion.upsert({
      where: {
        masterProductId_fromUomId_toUomId: {
          masterProductId: product.id,
          fromUomId: baseUomId,
          toUomId: usageUomId,
        },
      },
      update: { factor: product.conversionFactor, isActive: true },
      create: {
        masterProductId: product.id,
        fromUomId: baseUomId,
        toUomId: usageUomId,
        factor: product.conversionFactor,
      },
    });
  }

  return identities.size;
}
