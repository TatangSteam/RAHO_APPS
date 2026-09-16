import { CollaborationTaskPriority, CollaborationTaskStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { jakartaTimestamp, overdueDays, resolvePeriod } from './ai.period';
import { ListInput, PeriodInput } from './ai.schema';

export type RainUser = { userId: string; fullName: string; role: string; staffCode: string | null };
type Tx = Prisma.TransactionClient;
type Range = ReturnType<typeof resolvePeriod>;
export const envelope = (user: RainUser, asOf: Date) => ({
  contractVersion: 'rain.v1' as const, success: true as const, source: 'erp' as const, isDemo: false,
  asOf: jakartaTimestamp(asOf), user: { id: user.userId, name: user.fullName, role: user.role, staffCode: user.staffCode },
});

// Every query is personal, even for Owner/Super Admin. No mutation of collaboration data.
export function personalWhere(userId: string, range: Range): Prisma.TeamTaskWhereInput {
  return {
    deletedAt: null,
    assignments: { some: { userId, unassignedAt: null } },
    team: { status: 'ACTIVE', memberships: { some: { userId, status: 'ACTIVE' } } },
    AND: [{ OR: [{ parentTaskId: null }, { parentTask: { deletedAt: null } }] }],
    dueAt: { gte: range.start, lt: range.endExclusive },
  };
}

async function readSnapshot<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '7000ms'`;
    return work(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 2000, timeout: 8000 });
}

async function performance(tx: Tx, userId: string, range: Range, asOf: Date) {
  const where = personalWhere(userId, range);
  const groups = await tx.teamTask.groupBy({ by: ['status'], where, _count: { _all: true } });
  const count = (status: CollaborationTaskStatus) => groups.find((group) => group.status === status)?._count._all || 0;
  const totalTasks = groups.reduce((total, group) => total + group._count._all, 0);
  const completed = count('COMPLETED');
  const cancelled = count('CANCELLED');
  const eligibleTasks = totalTasks - cancelled;
  const overdue = await tx.teamTask.count({ where: {
    ...where, dueAt: { gte: range.start, lt: new Date(Math.min(range.endExclusive.getTime(), asOf.getTime())) },
    status: { notIn: ['COMPLETED', 'CANCELLED'] },
  } });
  return {
    totalTasks, eligibleTasks, unfinished: eligibleTasks - completed, completed,
    inProgress: count('IN_PROGRESS'), todo: count('TODO'), submitted: count('SUBMITTED'),
    needsRevision: count('NEEDS_REVISION'), cancelled, overdue,
    completionRate: eligibleTasks === 0 ? null : Math.round(completed / eligibleTasks * 1000) / 10,
  };
}

export async function getMyPerformance(user: RainUser, input: PeriodInput, asOf = new Date()) {
  const range = resolvePeriod(input, asOf);
  const result = await readSnapshot((tx) => performance(tx, user.userId, range, asOf));
  return { ...envelope(user, asOf), period: range.period, performance: result };
}

export async function compareMyPerformance(user: RainUser, a: PeriodInput, b: PeriodInput, asOf = new Date()) {
  const rangeA = resolvePeriod(a, asOf);
  const rangeB = resolvePeriod(b, asOf);
  return readSnapshot(async (tx) => {
    const A = await performance(tx, user.userId, rangeA, asOf);
    const B = await performance(tx, user.userId, rangeB, asOf);
    const equalDuration = rangeA.period.days === rangeB.period.days;
    return {
      ...envelope(user, asOf), periodA: { period: rangeA.period, performance: A }, periodB: { period: rangeB.period, performance: B },
      comparison: {
        direction: 'A_MINUS_B' as const,
        totalTasksDelta: A.totalTasks - B.totalTasks, completedDelta: A.completed - B.completed,
        unfinishedDelta: A.unfinished - B.unfinished, overdueDelta: A.overdue - B.overdue,
        completionRateDeltaPoints: A.completionRate === null || B.completionRate === null ? null
          : Math.round((A.completionRate - B.completionRate) * 10) / 10,
        equalDuration,
        warning: equalDuration ? null : (rangeA.period.toDate || rangeB.period.toDate)
          ? 'Salah satu periode masih berjalan dan durasinya berbeda. Jumlah task tidak dapat dibandingkan langsung.'
          : 'Durasi periode berbeda. Jumlah task tidak dapat dibandingkan langsung.',
      },
    };
  });
}

type TaskRow = {
  id: string; taskNo: number; title: string; status: CollaborationTaskStatus; priority: CollaborationTaskPriority;
  dueAt: Date; completedAt: Date | null; parentTaskId: string | null;
};

export async function getMyTasks(user: RainUser, input: ListInput, overdueOnly = false, asOf = new Date()) {
  const { limit = 10, offset = 0 } = input;
  if (overdueOnly && input.status) throw new AppError(400, 'INVALID_ARGUMENT', 'Endpoint overdue tidak menerima status.');
  const range = resolvePeriod(input, asOf, overdueOnly);
  const where = personalWhere(user.userId, range);
  const status = overdueOnly || input.status === 'OPEN'
    ? { notIn: ['COMPLETED', 'CANCELLED'] as CollaborationTaskStatus[] }
    : input.status;
  const end = overdueOnly ? new Date(Math.min(range.endExclusive.getTime(), asOf.getTime())) : range.endExclusive;
  return readSnapshot(async (tx) => {
    const total = await tx.teamTask.count({ where: { ...where, status, dueAt: { gte: range.start, lt: end } } });
    const statusSql = overdueOnly || input.status === 'OPEN'
      ? Prisma.sql`AND t."status" NOT IN ('COMPLETED', 'CANCELLED')`
      : input.status ? Prisma.sql`AND t."status"::text = ${input.status}` : Prisma.empty;
    // Explicit CASE ordering avoids enum/lexical priority ordering and sorts BEFORE pagination.
    const overdueSort = overdueOnly ? Prisma.empty
      : Prisma.sql`CASE WHEN t."dueAt" < ${asOf} AND t."status" NOT IN ('COMPLETED', 'CANCELLED') THEN 0 ELSE 1 END,`;
    const rows = await tx.$queryRaw<TaskRow[]>(Prisma.sql`
      SELECT t."id", t."taskNo", t."title", t."status", t."priority", t."dueAt", t."completedAt", t."parentTaskId"
      FROM "team_tasks" t
      WHERE t."deletedAt" IS NULL AND t."dueAt" >= ${range.start} AND t."dueAt" < ${end}
        ${statusSql}
        AND (t."parentTaskId" IS NULL OR EXISTS (
          SELECT 1 FROM "team_tasks" p WHERE p."id" = t."parentTaskId" AND p."deletedAt" IS NULL
        ))
        AND EXISTS (SELECT 1 FROM "task_assignments" a
          WHERE a."taskId" = t."id" AND a."userId" = ${user.userId} AND a."unassignedAt" IS NULL)
        AND EXISTS (SELECT 1 FROM "collaboration_teams" team JOIN "team_memberships" m ON m."teamId" = team."id"
          WHERE team."id" = t."teamId" AND team."status" = 'ACTIVE' AND m."userId" = ${user.userId} AND m."status" = 'ACTIVE')
      ORDER BY ${overdueSort} t."dueAt" ASC,
        CASE t."priority" WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        t."createdAt" DESC, t."id" ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return {
      ...envelope(user, asOf), period: range.period, filters: { status: overdueOnly ? 'OPEN' : input.status || 'ALL' },
      tasks: rows.map((row) => {
        const overdue = row.dueAt < asOf && row.status !== 'COMPLETED' && row.status !== 'CANCELLED';
        return {
          ...row, dueAt: jakartaTimestamp(row.dueAt), completedAt: row.completedAt ? jakartaTimestamp(row.completedAt) : null,
          overdue, ...(overdueOnly ? { overdueDays: overdueDays(row.dueAt, asOf) } : {}),
        };
      }),
      pagination: { total, offset, limit,
        nextOffset: offset + rows.length < total && rows.length > 0 ? offset + rows.length : null },
    };
  });
}
