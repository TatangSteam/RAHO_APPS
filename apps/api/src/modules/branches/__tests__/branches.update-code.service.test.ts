import { prisma } from '@lib/prisma';
import { updateBranchSchema } from '../branches.schema';
import { updateBranchService } from '../branches.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    branch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const prismaMock = prisma as any;
const existingBranch = {
  id: 'branch-1',
  branchCode: 'PST',
  name: 'Cabang Pusat',
};

describe('branch code updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.branch.findUnique.mockResolvedValue(existingBranch);
    prismaMock.branch.update.mockImplementation(({ data }: any) => ({
      ...existingBranch,
      ...data,
    }));
  });

  it('normalizes a manually entered branch code', async () => {
    const input = updateBranchSchema.parse({ branchCode: ' jkt01 ' });
    prismaMock.branch.findUnique
      .mockResolvedValueOnce(existingBranch)
      .mockResolvedValueOnce(null);

    const result = await updateBranchService('branch-1', input, 'SUPER_ADMIN');

    expect(prismaMock.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'branch-1' },
        data: { branchCode: 'JKT01' },
      })
    );
    expect(result.branchCode).toBe('JKT01');
  });

  it('rejects a branch-code change from a non-super-admin', async () => {
    const input = updateBranchSchema.parse({ branchCode: 'JKT01' });

    await expect(
      updateBranchService('branch-1', input, 'ADMIN_MANAGER')
    ).rejects.toMatchObject({ status: 403, code: 'AUTH_FORBIDDEN' });

    expect(prismaMock.branch.update).not.toHaveBeenCalled();
  });

  it('rejects a manually entered code already used by another branch', async () => {
    const input = updateBranchSchema.parse({ branchCode: 'JKT01' });
    prismaMock.branch.findUnique
      .mockResolvedValueOnce(existingBranch)
      .mockResolvedValueOnce({ id: 'branch-2' });

    await expect(
      updateBranchService('branch-1', input, 'SUPER_ADMIN')
    ).rejects.toMatchObject({
      status: 400,
      code: 'BRANCH_CODE_ALREADY_EXISTS',
    });

    expect(prismaMock.branch.update).not.toHaveBeenCalled();
  });

  it('generates the next regional branch code automatically', async () => {
    const input = updateBranchSchema.parse({
      autoGenerateBranchCode: true,
      regencyCode: '31.71',
    });
    prismaMock.branch.findMany.mockResolvedValue([
      { branchCode: '317101' },
      { branchCode: '317102' },
    ]);

    const result = await updateBranchService('branch-1', input, 'SUPER_ADMIN');

    expect(prismaMock.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { branchCode: '317103' },
      })
    );
    expect(result.branchCode).toBe('317103');
  });

  it('requires a regency for automatic generation', () => {
    const result = updateBranchSchema.safeParse({ autoGenerateBranchCode: true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['regencyCode'] }),
        ])
      );
    }
  });
});
