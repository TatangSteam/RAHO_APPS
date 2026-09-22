import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { enqueueMasterSafely } from '@modules/zoho/zoho.master.service';
import { createWarehouse, updateMasterProduct } from '../inventory-master.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    masterProduct: { findUnique: jest.fn() },
    unitOfMeasure: { findMany: jest.fn() },
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertPermission: jest.fn(),
  getAccessibleBranchIds: jest.fn(),
}));

jest.mock('@utils/auditLog', () => ({
  buildChangedFields: jest.fn(),
  logAudit: jest.fn(),
}));

jest.mock('@modules/zoho/zoho.master.service', () => ({
  enqueueMasterSafely: jest.fn(),
  enqueueWarehouseLocationsSafely: jest.fn(),
}));

describe('inventory master warehouse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('membuat Lokasi Utama otomatis untuk setiap warehouse baru', async () => {
    const warehouse = {
      id: 'warehouse-2',
      branchId: 'branch-1',
      code: 'SECONDARY',
      name: 'Warehouse Kedua',
      isDefault: false,
      isActive: true,
    };
    const tx = {
      warehouse: {
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue(warehouse),
      },
      stockLocation: {
        create: jest.fn().mockResolvedValue({
          id: 'location-2',
          warehouseId: warehouse.id,
          code: 'DEFAULT',
          name: 'Lokasi Utama',
          isDefault: true,
        }),
      },
    };
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
    );

    const result = await createWarehouse('user-1', {
      branchId: warehouse.branchId,
      code: warehouse.code,
      name: warehouse.name,
      isDefault: false,
    });

    expect(result).toEqual(warehouse);
    expect(tx.stockLocation.create).toHaveBeenCalledWith({
      data: {
        warehouseId: warehouse.id,
        code: 'DEFAULT',
        name: 'Lokasi Utama',
        isDefault: true,
        createdBy: 'user-1',
      },
    });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      branchId: warehouse.branchId,
      resource: 'Warehouse',
      resourceId: warehouse.id,
    }));
  });
});

describe('inventory master purchase cost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists an edited purchase cost as Decimal and queues the master update', async () => {
    const before = {
      id: 'product-1',
      sku: 'PRD-ANN-KNG-001',
      baseUomId: 'uom-bottle',
      usageUomId: 'uom-bottle',
      conversionFactor: new Prisma.Decimal(1),
      tracksBatch: false,
      tracksExpiry: false,
      defaultUnitCost: new Prisma.Decimal(15_000),
    };
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...before, ...data }));
    const tx = {
      masterProduct: { update },
      unitConversion: { upsert: jest.fn().mockResolvedValue({}) },
    };
    (prisma.masterProduct.findUnique as jest.Mock).mockResolvedValue(before);
    (prisma.unitOfMeasure.findMany as jest.Mock).mockResolvedValue([{
      id: 'uom-bottle', code: 'BTL', name: 'Botol', isActive: true,
    }]);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
    );

    const result = await updateMasterProduct('admin-1', 'product-1', {
      defaultUnitCost: '12500',
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1' },
      data: expect.objectContaining({ defaultUnitCost: expect.anything() }),
    }));
    expect(update.mock.calls[0][0].data.defaultUnitCost.toFixed(0)).toBe('12500');
    expect(result.defaultUnitCost.toFixed(0)).toBe('12500');
    expect(enqueueMasterSafely).toHaveBeenCalledWith('MASTER_PRODUCT', 'product-1');
  });
});
