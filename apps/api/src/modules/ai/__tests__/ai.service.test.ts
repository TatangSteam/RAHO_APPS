import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { compareMyPerformance, getMyPerformance, getMyTasks, personalWhere } from '../ai.service';
import { resolvePeriod } from '../ai.period';
import { planChat, chat } from '../ai.chat';

jest.mock('@lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
const user = { userId: 'logged-in-user', fullName: 'James', role: 'ADMIN_LAYANAN', staffCode: 'MSO001' };
const now = new Date('2026-09-16T07:30:00Z');
const tx = { $executeRaw: jest.fn(), $queryRaw: jest.fn(), teamTask: { groupBy: jest.fn(), count: jest.fn() } };
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation((work) => work(tx));
  tx.$executeRaw.mockResolvedValue(0);
  tx.teamTask.groupBy.mockResolvedValue([]);
  tx.teamTask.count.mockResolvedValue(0);
  tx.$queryRaw.mockResolvedValue([]);
});
describe('RAIN personal read services', () => {
  it('always requires active assignment, active membership/team and nondeleted task/parent', () => {
    expect(personalWhere(user.userId, resolvePeriod({ period: 'today' }, now))).toMatchObject({
      deletedAt: null, assignments: { some: { userId: user.userId, unassignedAt: null } },
      team: { status: 'ACTIVE', memberships: { some: { userId: user.userId, status: 'ACTIVE' } } },
      AND: [{ OR: [{ parentTaskId: null }, { parentTask: { deletedAt: null } }] }],
      dueAt: { gte: new Date('2026-09-15T17:00:00Z'), lt: new Date('2026-09-16T17:00:00Z') },
    });
  });
  it('calculates all statuses, cancellation exclusion and one-decimal completion rate', async () => {
    tx.teamTask.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { _all: 5 } }, { status: 'CANCELLED', _count: { _all: 1 } },
      { status: 'IN_PROGRESS', _count: { _all: 1 } }, { status: 'NEEDS_REVISION', _count: { _all: 1 } },
    ]);
    tx.teamTask.count.mockResolvedValue(1);
    const result = await getMyPerformance(user, { period: 'today' }, now);
    expect(result.performance).toEqual({ totalTasks: 8, eligibleTasks: 7, completed: 5, cancelled: 1, unfinished: 2,
      inProgress: 1, needsRevision: 1, todo: 0, submitted: 0, overdue: 1, completionRate: 71.4 });
    expect(tx.teamTask.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      dueAt: { gte: new Date('2026-09-15T17:00:00Z'), lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] },
    }) }));
    expect(result.user.id).toBe(user.userId);
    expect(tx.$executeRaw.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'RepeatableRead', timeout: 8000 }));
  });
  it('returns success/null completion for empty or all-cancelled cohorts', async () => {
    expect((await getMyPerformance(user, { period: 'today' }, now)).performance.completionRate).toBeNull();
    tx.teamTask.groupBy.mockResolvedValue([{ status: 'CANCELLED', _count: { _all: 3 } }]);
    expect((await getMyPerformance(user, { period: 'today' }, now)).performance).toMatchObject({ eligibleTasks: 0, unfinished: 0, completionRate: null });
  });
  it('compares A minus B, null-safe rates, with unequal duration warning and one asOf', async () => {
    tx.teamTask.groupBy.mockResolvedValueOnce([{ status: 'COMPLETED', _count: { _all: 2 } }]).mockResolvedValueOnce([]);
    const result = await compareMyPerformance(user, { period: 'this_week' }, { period: 'last_week' }, now);
    expect(result.comparison).toMatchObject({ direction: 'A_MINUS_B', completedDelta: 2, completionRateDeltaPoints: null, equalDuration: false, warning: expect.any(String) });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('calculates a rounded percentage POINT difference, not relative growth', async () => {
    tx.teamTask.groupBy.mockResolvedValueOnce([{ status: 'COMPLETED', _count: { _all: 14 } }, { status: 'TODO', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ status: 'COMPLETED', _count: { _all: 18 } }, { status: 'TODO', _count: { _all: 8 } }]);
    const result = await compareMyPerformance(user, { period: 'today' }, { period: 'yesterday' }, now);
    expect(result.comparison).toMatchObject({ completionRateDeltaPoints: 13.2, completedDelta: -4, equalDuration: true, warning: null });
  });
  it('orders safely in SQL before pagination and preserves task/subtask identity', async () => {
    tx.teamTask.count.mockResolvedValue(24);
    tx.$queryRaw.mockResolvedValue([{ id: 'task-1', taskNo: 27, title: 'Periksa', status: 'TODO', priority: 'HIGH', dueAt: new Date('2026-09-16T03:00:00Z'), completedAt: null, parentTaskId: 'parent-1' }]);
    const result = await getMyTasks(user, { period: 'this_week', status: 'OPEN', limit: 1, offset: 10 }, false, now);
    expect(result.pagination).toEqual({ total: 24, limit: 1, offset: 10, nextOffset: 11 });
    expect(result.tasks[0]).toMatchObject({ overdue: true, parentTaskId: 'parent-1' });
    const sql = tx.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.text).toContain('ORDER BY CASE');
    expect(sql.text).toContain("WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1");
    expect(sql.text.indexOf('ORDER BY')).toBeLessThan(sql.text.indexOf('LIMIT'));
    expect(sql.values).toContain(user.userId);
    expect(sql.text).not.toContain(user.userId);
    expect(sql.text).toContain('a."unassignedAt" IS NULL');
    expect(sql.text).toContain('m."status" = \'ACTIVE\'');
  });
  it('returns empty arrays as success and rolls overdue over exactly 90 local dates', async () => {
    const result = await getMyTasks(user, { limit: 10, offset: 0 }, true, now);
    expect(result).toMatchObject({ success: true, tasks: [], period: { type: 'rolling_90_days', days: 90 }, pagination: { total: 0, nextOffset: null } });
    expect(tx.teamTask.count.mock.calls[0][0].where.status).toEqual({ notIn: ['COMPLETED', 'CANCELLED'] });
  });
  it('rejects invalid dates before opening a database transaction', async () => {
    await expect(getMyPerformance(user, { period: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' }, now)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
describe('RAIN read-only rule-based chat', () => {
  it.each(['Kinerja hari ini', 'Gimana performa gue minggu ini?', 'Hari ini gue punya berapa task?'])('recognizes performance: %s', (text) => {
    expect(planChat(text).intent).toBe('performance');
  });
  it('recognizes list, revision, comparison, custom dates and scoped continuation', () => {
    expect(planChat('Task perlu revisi')).toMatchObject({ intent: 'tasks', input: { status: 'NEEDS_REVISION', period: 'today' } });
    expect(planChat('Task belum selesai minggu ini')).toMatchObject({ intent: 'tasks', input: { status: 'OPEN', period: 'this_week' } });
    expect(planChat('Bandingkan minggu ini dengan minggu lalu')).toMatchObject({ intent: 'compare', a: { period: 'this_week' }, b: { period: 'last_week' } });
    expect(planChat('Kinerja 2026-09-01 sampai 2026-09-15')).toMatchObject({ intent: 'performance', period: { period: 'custom', startDate: '2026-09-01', endDate: '2026-09-15' } });
    expect(planChat('Task terlambat')).toMatchObject({ intent: 'overdue', input: { period: undefined } });
    const context = { intent: 'tasks' as const, period: 'today' as const, limit: 10, offset: 10 };
    expect(planChat('lanjut', context)).toMatchObject({ intent: 'tasks', input: context });
  });
  it.each(['Hapus task saya', 'Ubah status task', 'Bandingkan minggu ini', 'Daftar task besok', 'Halo', 'lanjut'])('does not invent support for %s', (text) => {
    expect(planChat(text).intent).toBe('help');
  });
  it('explains server-calculated zero/null results without claiming failure', async () => {
    const response = await chat(user, 'Kinerja hari ini', undefined, now);
    expect(response.reply).toContain('Tidak ada task yang wajib');
    expect(response.mode).toBe('rules');
    expect(response.reply).not.toContain('Completion rate 0');
  });
  it('never falls back to demo/business numbers on database failure', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('database unavailable'));
    await expect(chat(user, 'Kinerja hari ini', undefined, now)).rejects.toThrow('database unavailable');
  });
});
