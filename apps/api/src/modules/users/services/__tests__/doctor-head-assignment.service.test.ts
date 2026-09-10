import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  createDoctorHeadBranchAssignmentsService,
  deleteDoctorHeadAssignmentService,
  updateDoctorHeadAssignmentService,
} from '../doctor-head-assignment.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    doctorHeadAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    branch: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({ getAccessibleBranchIds: jest.fn() }));

const mockPrisma = prisma as any;
const superAdmin = { role: Role.SUPER_ADMIN, userId: 'super-admin', branchId: null };

describe('Doctor Head assignment management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'doctor-1' });
    mockPrisma.branch.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) => (
      Promise.resolve(where.id.in.map((id) => ({ id })))
    ));
    mockPrisma.doctorHeadAssignment.findMany.mockResolvedValue([]);
    mockPrisma.doctorHeadAssignment.findFirst.mockResolvedValue(null);
    mockPrisma.doctorHeadAssignment.findUnique.mockResolvedValue({
      id: 'assignment-1', isActive: true, effectiveFrom: new Date('2099-01-01'), effectiveUntil: null,
    });
    mockPrisma.doctorHeadAssignment.create.mockImplementation(({ data }: { data: { branchId: string } }) => Promise.resolve({ id: `assignment-${data.branchId}`, ...data }));
    mockPrisma.doctorHeadAssignment.update.mockResolvedValue({ id: 'assignment-1' });
    mockPrisma.doctorHeadAssignment.delete.mockResolvedValue({ id: 'assignment-1' });
    mockPrisma.$transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it('lets Super Admin assign one doctor to multiple branches atomically', async () => {
    const result = await createDoctorHeadBranchAssignmentsService({
      doctorHeadUserId: 'doctor-1',
      branchIds: ['branch-1', 'branch-2'],
      effectiveFrom: '2026-09-01',
    }, superAdmin);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'doctor-1', role: Role.DOCTOR, isActive: true }),
    }));
    expect(mockPrisma.doctorHeadAssignment.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it('lets Super Admin edit an assignment and excludes that row from overlap checking', async () => {
    await updateDoctorHeadAssignmentService('assignment-1', {
      doctorHeadUserId: 'doctor-1',
      branchId: 'branch-1',
      effectiveFrom: '2026-09-01',
      notes: 'Dokter Head area barat',
    }, superAdmin);
    expect(mockPrisma.doctorHeadAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: 'assignment-1' } }),
    }));
    expect(mockPrisma.doctorHeadAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notes: 'Dokter Head area barat' }),
    }));
  });

  it('lets Super Admin permanently delete an assignment regardless of its period', async () => {
    await deleteDoctorHeadAssignmentService('assignment-1', superAdmin);
    expect(mockPrisma.doctorHeadAssignment.delete).toHaveBeenCalledWith({ where: { id: 'assignment-1' } });
    expect(mockPrisma.doctorHeadAssignment.update).not.toHaveBeenCalled();
  });

  it('rejects add, edit, and delete from non-Super Admin accounts', async () => {
    const manager = { role: Role.ADMIN_MANAGER, userId: 'manager-1', branchId: null };
    await expect(createDoctorHeadBranchAssignmentsService({
      doctorHeadUserId: 'doctor-1', branchIds: ['branch-1'], effectiveFrom: '2026-09-01',
    }, manager)).rejects.toMatchObject({ status: 403 });
    await expect(updateDoctorHeadAssignmentService('assignment-1', {
      doctorHeadUserId: 'doctor-1', branchId: 'branch-1', effectiveFrom: '2026-09-01',
    }, manager)).rejects.toMatchObject({ status: 403 });
    await expect(deleteDoctorHeadAssignmentService('assignment-1', manager)).rejects.toMatchObject({ status: 403 });
  });
});
