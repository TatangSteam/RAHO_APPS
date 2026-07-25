import { prisma } from '@lib/prisma';
import { logAudit } from '@utils/auditLog';
import { createWarehouse } from '../inventory-master.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
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
