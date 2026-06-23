import { prisma } from '@lib/prisma';
import { deleteBranchService } from '../branches.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    branch: {
      findUnique: jest.fn(),
    },
    member: {
      count: jest.fn(),
    },
    memberPackage: {
      count: jest.fn(),
    },
    memberAddOn: {
      count: jest.fn(),
    },
    memberNonTherapyPurchase: {
      count: jest.fn(),
    },
    invoice: {
      count: jest.fn(),
    },
    encounter: {
      count: jest.fn(),
    },
    treatmentSession: {
      count: jest.fn(),
    },
    stockRequest: {
      count: jest.fn(),
    },
    stockRequestInvoice: {
      count: jest.fn(),
    },
    shipment: {
      count: jest.fn(),
    },
    branchOverstock: {
      count: jest.fn(),
    },
    stockMutation: {
      count: jest.fn(),
    },
    materialUsage: {
      count: jest.fn(),
    },
    stockRequestItem: {
      count: jest.fn(),
    },
    referralIncentiveRecord: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prismaMock = prisma as any;

const tx = {
  user: {
    updateMany: jest.fn(),
  },
  auditLog: {
    updateMany: jest.fn(),
  },
  staffBranch: {
    deleteMany: jest.fn(),
  },
  managerBranch: {
    deleteMany: jest.fn(),
  },
  branchMemberAccess: {
    deleteMany: jest.fn(),
  },
  referralCode: {
    deleteMany: jest.fn(),
  },
  packagePricing: {
    deleteMany: jest.fn(),
  },
  stockMutation: {
    deleteMany: jest.fn(),
  },
  inventoryItem: {
    deleteMany: jest.fn(),
  },
  branch: {
    delete: jest.fn(),
  },
};

function mockAllBlockerCountsAsZero() {
  prismaMock.member.count.mockResolvedValue(0);
  prismaMock.memberPackage.count.mockResolvedValue(0);
  prismaMock.memberAddOn.count.mockResolvedValue(0);
  prismaMock.memberNonTherapyPurchase.count.mockResolvedValue(0);
  prismaMock.invoice.count.mockResolvedValue(0);
  prismaMock.encounter.count.mockResolvedValue(0);
  prismaMock.treatmentSession.count.mockResolvedValue(0);
  prismaMock.stockRequest.count.mockResolvedValue(0);
  prismaMock.stockRequestInvoice.count.mockResolvedValue(0);
  prismaMock.shipment.count.mockResolvedValue(0);
  prismaMock.branchOverstock.count.mockResolvedValue(0);
  prismaMock.stockMutation.count.mockResolvedValue(0);
  prismaMock.materialUsage.count.mockResolvedValue(0);
  prismaMock.stockRequestItem.count.mockResolvedValue(0);
  prismaMock.referralIncentiveRecord.count.mockResolvedValue(0);
}

describe('deleteBranchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllBlockerCountsAsZero();

    prismaMock.branch.findUnique.mockResolvedValue({
      id: 'branch-1',
      branchCode: '317101',
      name: 'Cabang Test',
    });

    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.auditLog.updateMany.mockResolvedValue({ count: 2 });
    tx.staffBranch.deleteMany.mockResolvedValue({ count: 1 });
    tx.managerBranch.deleteMany.mockResolvedValue({ count: 1 });
    tx.branchMemberAccess.deleteMany.mockResolvedValue({ count: 0 });
    tx.referralCode.deleteMany.mockResolvedValue({ count: 0 });
    tx.packagePricing.deleteMany.mockResolvedValue({ count: 44 });
    tx.stockMutation.deleteMany.mockResolvedValue({ count: 0 });
    tx.inventoryItem.deleteMany.mockResolvedValue({ count: 3 });
    tx.branch.delete.mockResolvedValue({ id: 'branch-1' });

    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx)
    );
  });

  it('rejects permanent deletion when the branch has historical data', async () => {
    prismaMock.member.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    await expect(deleteBranchService('branch-1')).rejects.toMatchObject({
      status: 409,
      code: 'BRANCH_HAS_HISTORICAL_DATA',
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.branch.delete).not.toHaveBeenCalled();
  });

  it('permanently deletes an unused branch and its bootstrap data', async () => {
    const result = await deleteBranchService('branch-1');

    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({
      where: { branchId: 'branch-1' },
      data: { branchId: null },
    });
    expect(tx.packagePricing.deleteMany).toHaveBeenCalledWith({
      where: { branchId: 'branch-1' },
    });
    expect(tx.inventoryItem.deleteMany).toHaveBeenCalledWith({
      where: { branchId: 'branch-1' },
    });
    expect(tx.branch.delete).toHaveBeenCalledWith({
      where: { id: 'branch-1' },
    });
    expect(result).toMatchObject({
      message: 'Cabang berhasil dihapus permanen',
      branch: {
        id: 'branch-1',
        branchCode: '317101',
        name: 'Cabang Test',
      },
    });
  });
});
