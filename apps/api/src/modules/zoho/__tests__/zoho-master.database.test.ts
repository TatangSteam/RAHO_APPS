import { randomUUID } from 'crypto';
import { prisma } from '@lib/prisma';
import {
  enqueueMaster,
  MASTER_PRODUCT_ITEM_EVENT,
  PACKAGE_PRICING_ITEM_EVENT,
  previewMaster,
} from '../zoho.master.service';

const describeDatabase = process.env.RUN_ZOHO_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Zoho Sprint 4 master database integration', () => {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const uomId = `zoho-uom-${suffix}`;
  const productId = `zoho-product-${suffix}`;
  const pricingId = `zoho-pricing-${suffix}`;
  const partnershipBranchId = `zoho-partnership-${suffix}`;

  beforeAll(async () => {
    await prisma.unitOfMeasure.create({
      data: { id: uomId, code: `ZU${suffix}`, name: `Zoho Unit ${suffix}` },
    });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku: `ZITEM-${suffix}`,
        name: `Zoho Item ${suffix}`,
        category: 'CONSUMABLE',
        unit: `Zoho Unit ${suffix}`,
        baseUnit: `Zoho Unit ${suffix}`,
        usageUnit: `Zoho Unit ${suffix}`,
        baseUomId: uomId,
        usageUomId: uomId,
        conversionFactor: 1,
        tracksBatch: true,
        tracksExpiry: true,
      },
    });
    await prisma.packagePricing.create({
      data: {
        id: pricingId,
        packageType: 'BOOSTER',
        boosterType: 'NO',
        serviceType: 'HC',
        productCode: `ZSERVICE-${suffix}`,
        name: `Zoho Service ${suffix}`,
        totalSessions: 1,
        price: 850_000,
      },
    });
    await prisma.branch.create({
      data: {
        id: partnershipBranchId,
        branchCode: `ZP${suffix}`,
        name: `Zoho Partnership ${suffix}`,
        type: 'PARTNERSHIP',
      },
    });
  });

  afterAll(async () => {
    await prisma.integrationEvent.deleteMany({
      where: {
        OR: [
          { eventType: MASTER_PRODUCT_ITEM_EVENT, aggregateId: productId },
          { eventType: PACKAGE_PRICING_ITEM_EVENT, aggregateId: pricingId },
        ],
      },
    });
    await prisma.zohoEntityMapping.deleteMany({ where: { localEntityId: uomId } });
    await prisma.packagePricing.deleteMany({ where: { id: pricingId } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.branch.deleteMany({ where: { id: partnershipBranchId } });
    await prisma.$disconnect();
  });

  it('creates only one replay-safe event for an inventory item', async () => {
    const first = await enqueueMaster('MASTER_PRODUCT', productId);
    const second = await enqueueMaster('MASTER_PRODUCT', productId);
    if ('skipped' in first || 'skipped' in second) throw new Error('Item tidak boleh dilewati.');
    expect(second.id).toBe(first.id);
    expect(await prisma.integrationEvent.count({
      where: { eventType: MASTER_PRODUCT_ITEM_EVENT, aggregateId: productId },
    })).toBe(1);
  });

  it('keeps batch, expiry, opening stock, and BOM outside the Zoho payload', async () => {
    const preview = await previewMaster('MASTER_PRODUCT', productId);
    const serialized = JSON.stringify(preview.payload);
    expect(serialized).not.toMatch(/opening|initial_stock|batch|expiry|bom/i);
    expect(preview.excludedFields).toEqual(expect.arrayContaining([
      'opening_stock',
      'batch',
      'expiry',
      'treatment_bom',
    ]));
  });

  it('creates a service item event without creating a revenue event', async () => {
    const event = await enqueueMaster('PACKAGE_PRICING', pricingId);
    if ('skipped' in event) throw new Error('Service item tidak boleh dilewati.');
    expect(event.eventType).toBe(PACKAGE_PRICING_ITEM_EVENT);
    expect(JSON.stringify(event.payload)).toContain('"product_type":"service"');
    expect(await prisma.integrationEvent.count({
      where: {
        aggregateId: pricingId,
        eventType: { in: ['INVOICE_FINALIZED', 'TREATMENT_COMPLETED', 'REVENUE_RECOGNIZED'] },
      },
    })).toBe(0);
  });

  it('never creates an internal Zoho Location event for Partnership', async () => {
    const result = await enqueueMaster('BRANCH_LOCATION', partnershipBranchId);
    expect(result).toMatchObject({ skipped: true, entityType: 'BRANCH_LOCATION' });
    expect(await prisma.integrationEvent.count({
      where: { eventType: 'BRANCH_LOCATION_UPSERTED', aggregateId: partnershipBranchId },
    })).toBe(0);
  });
});
