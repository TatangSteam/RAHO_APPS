import { prisma } from '@lib/prisma';
import { deleteTask, updateTask } from '../collaboration.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    teamTask: { findFirst: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    teamMembership: { findUnique: jest.fn(), count: jest.fn() },
    taskAssignment: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    taskActivity: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const db = prisma as unknown as {
  teamTask: { findFirst: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
  teamMembership: { findUnique: jest.Mock; count: jest.Mock };
  taskAssignment: { findMany: jest.Mock; updateMany: jest.Mock; update: jest.Mock; create: jest.Mock };
  taskActivity: { create: jest.Mock };
  $transaction: jest.Mock;
};

const person = { id: 'owner-1', email: 'owner@raho.id', role: 'SUPER_ADMIN', profile: { fullName: 'Owner' } };
const task = {
  id: 'task-1', teamId: 'team-1', taskNo: 7, version: 3, parentTaskId: null, dueAt: null,
  team: { status: 'ACTIVE', taskVisibilityPolicy: 'ALL_TEAM_MEMBERS' },
  assignments: [{ userId: 'owner-1' }], subtasks: [], createdBy: person,
};

beforeEach(() => {
  jest.clearAllMocks();
  db.teamTask.findFirst.mockResolvedValue(task);
  db.teamMembership.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
  db.teamMembership.count.mockResolvedValue(1);
  db.$transaction.mockImplementation((callback: (client: typeof db) => Promise<unknown>) => callback(db));
  db.teamTask.updateMany.mockResolvedValue({ count: 1 });
  db.taskAssignment.updateMany.mockResolvedValue({ count: 1 });
  db.taskActivity.create.mockResolvedValue({ id: 'activity-1' });
});

describe('Collaboration CRUD service', () => {
  it('soft-deletes the parent and children and releases every active assignment', async () => {
    await expect(deleteTask('owner-1', 'task-1')).resolves.toEqual({ id: 'task-1', deleted: true });
    expect(db.teamTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { parentTaskId: 'task-1', deletedAt: null },
      data: expect.objectContaining({ status: 'CANCELLED', deletedAt: expect.any(Date) }),
    }));
    expect(db.taskAssignment.updateMany).toHaveBeenCalledWith({
      where: { unassignedAt: null, task: { OR: [{ id: 'task-1' }, { parentTaskId: 'task-1' }] } },
      data: { unassignedAt: expect.any(Date) },
    });
    expect(db.taskActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'TASK_DELETED', taskId: 'task-1' }),
    }));
  });

  it('does not allow Staff to soft-delete another task', async () => {
    db.teamMembership.findUnique.mockResolvedValue({ role: 'STAFF', status: 'ACTIVE' });
    await expect(deleteTask('staff-1', 'task-1')).rejects.toThrow();
    expect(db.teamTask.updateMany).not.toHaveBeenCalled();
  });

  it('preserves assignment rows while changing assignees', async () => {
    db.taskAssignment.findMany.mockResolvedValue([
      { userId: 'owner-1', unassignedAt: null },
      { userId: 'staff-1', unassignedAt: new Date('2026-01-01') },
    ]);
    db.taskAssignment.update.mockResolvedValue({});
    db.teamTask.findUniqueOrThrow.mockResolvedValue({
      ...task, assignments: [{ user: person }], comments: [], subtasks: [], reviewedBy: null,
    });

    await updateTask('owner-1', 'task-1', { version: 3, assigneeIds: ['staff-1'] });
    expect(db.taskAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { taskId: 'task-1', userId: { notIn: ['staff-1'] }, unassignedAt: null },
    }));
    expect(db.taskAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { taskId_userId: { taskId: 'task-1', userId: 'staff-1' } },
      data: expect.objectContaining({ unassignedAt: null, assignedById: 'owner-1' }),
    }));
    expect(db.taskAssignment.create).not.toHaveBeenCalled();
  });
});
