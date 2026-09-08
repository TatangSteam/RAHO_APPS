import {
  CollaborationTaskStatus,
  CollaborationTeamRole,
  Prisma,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import type {
  AddMemberInput,
  CreateSubtaskInput,
  CreateTaskInput,
  CreateTeamInput,
  UpdateMemberInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  UpdateTeamInput,
} from './collaboration.schema';

const userSelect = {
  id: true,
  email: true,
  role: true,
  staffCode: true,
  profile: { select: { fullName: true, avatarUrl: true } },
} satisfies Prisma.UserSelect;

const taskInclude = {
  createdBy: { select: userSelect },
  reviewedBy: { select: userSelect },
  assignments: {
    where: { unassignedAt: null },
    include: { user: { select: userSelect } },
  },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: userSelect } },
  },
  subtasks: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      assignments: {
        where: { unassignedAt: null },
        include: { user: { select: userSelect } },
      },
      createdBy: { select: userSelect },
      _count: { select: { comments: true } },
    },
  },
} satisfies Prisma.TeamTaskInclude;

function person(user: any) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    staffCode: user.staffCode,
    fullName: user.profile?.fullName || user.email,
    avatarUrl: user.profile?.avatarUrl || null,
  };
}

function presentTask(task: any) {
  const required = (task.subtasks || []).filter((row: any) => row.isRequired);
  const requiredDone = required.filter((row: any) => ['COMPLETED', 'CANCELLED'].includes(row.status)).length;
  return {
    ...task,
    createdBy: person(task.createdBy),
    reviewedBy: task.reviewedBy ? person(task.reviewedBy) : null,
    assignees: task.assignments.map((row: any) => person(row.user)),
    assignments: undefined,
    comments: (task.comments || []).map((comment: any) => ({
      ...comment,
      author: person(comment.author),
    })),
    subtasks: (task.subtasks || []).map((subtask: any) => ({
      ...subtask,
      createdBy: person(subtask.createdBy),
      assignees: subtask.assignments.map((row: any) => person(row.user)),
      assignments: undefined,
      commentCount: subtask._count?.comments || 0,
      _count: undefined,
    })),
    progress: {
      completed: requiredDone,
      total: required.length,
      percent: required.length === 0 ? (task.status === 'COMPLETED' ? 100 : 0) : Math.round((requiredDone / required.length) * 100),
    },
  };
}

function presentTaskForActor(task: any, actorId: string, restrictSubtasks: boolean) {
  const result = presentTask(task);
  if (!restrictSubtasks || task.parentTaskId) return result;

  result.subtasks = result.subtasks.filter((subtask: any) => (
    subtask.createdBy.id === actorId ||
    subtask.assignees.some((assignee: any) => assignee.id === actorId)
  ));
  const required = result.subtasks.filter((subtask: any) => subtask.isRequired);
  const completed = required.filter((subtask: any) => ['COMPLETED', 'CANCELLED'].includes(subtask.status)).length;
  result.progress = {
    completed,
    total: required.length,
    percent: required.length === 0 ? (result.status === 'COMPLETED' ? 100 : 0) : Math.round((completed / required.length) * 100),
  };
  return result;
}

async function membership(actorId: string, teamId: string) {
  const row = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId: actorId } },
  });
  if (!row || row.status !== 'ACTIVE') throw errors.forbidden('Anda bukan anggota aktif tim ini.');
  return row;
}

async function requireTeamManager(actorId: string, teamId: string) {
  const row = await membership(actorId, teamId);
  if (row.role !== CollaborationTeamRole.OWNER && row.role !== CollaborationTeamRole.LEADER) {
    throw errors.forbidden('Hanya Owner atau Leader yang dapat melakukan aksi ini.');
  }
  return row;
}

async function requireOwner(actorId: string, teamId: string) {
  const row = await membership(actorId, teamId);
  if (row.role !== CollaborationTeamRole.OWNER) throw errors.forbidden('Hanya Owner yang dapat mengatur tim.');
  return row;
}

async function validateAssignees(tx: Prisma.TransactionClient, teamId: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return uniqueIds;
  const count = await tx.teamMembership.count({
    where: { teamId, userId: { in: uniqueIds }, status: 'ACTIVE' },
  });
  if (count !== uniqueIds.length) throw errors.badRequest('INVALID_ASSIGNEE', 'Assignee harus anggota aktif pada tim yang sama.');
  return uniqueIds;
}

async function addActivity(
  tx: Prisma.TransactionClient,
  teamId: string,
  actorId: string,
  action: string,
  taskId?: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.taskActivity.create({ data: { teamId, actorId, action, taskId, metadata } });
}

export async function createTeam(actorId: string, input: CreateTeamInput) {
  return prisma.$transaction(async (tx) => {
    const team = await tx.collaborationTeam.create({
      data: {
        name: input.name,
        description: input.description || null,
        ownerId: actorId,
        taskVisibilityPolicy: input.taskVisibilityPolicy,
      },
    });
    const owner = await tx.teamMembership.create({
      data: { teamId: team.id, userId: actorId, assignedBy: actorId, role: 'OWNER' },
    });
    const updated = await tx.collaborationTeam.update({
      where: { id: team.id },
      data: { primaryLeaderMembershipId: owner.id },
    });
    await addActivity(tx, team.id, actorId, 'TEAM_CREATED', undefined, { name: team.name });
    return updated;
  });
}

export async function updateTeam(actorId: string, teamId: string, input: UpdateTeamInput) {
  await requireOwner(actorId, teamId);
  return prisma.$transaction(async (tx) => {
    const team = await tx.collaborationTeam.update({
      where: { id: teamId },
      data: {
        ...input,
        description: input.description === undefined ? undefined : input.description || null,
        archivedAt: input.status === 'ARCHIVED' ? new Date() : input.status === 'ACTIVE' ? null : undefined,
      },
    });
    await addActivity(tx, teamId, actorId, 'TEAM_UPDATED', undefined, { fields: Object.keys(input) });
    return team;
  });
}

export async function deleteTeam(actorId: string, teamId: string) {
  await requireOwner(actorId, teamId);
  return prisma.$transaction(async (tx) => {
    const team = await tx.collaborationTeam.update({
      where: { id: teamId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await addActivity(tx, teamId, actorId, 'TEAM_DELETED', undefined, { name: team.name });
    return team;
  });
}

export async function addTeamMember(actorId: string, teamId: string, input: AddMemberInput) {
  await requireOwner(actorId, teamId);
  const user = await prisma.user.findFirst({ where: { id: input.userId, isActive: true, role: { not: 'MEMBER' } }, select: { id: true } });
  if (!user) throw errors.notFound('Akun aktif tidak ditemukan.');
  return prisma.$transaction(async (tx) => {
    const row = await tx.teamMembership.upsert({
      where: { teamId_userId: { teamId, userId: input.userId } },
      create: { teamId, userId: input.userId, assignedBy: actorId, role: input.role },
      update: { role: input.role, status: 'ACTIVE', removedAt: null, assignedBy: actorId, joinedAt: new Date() },
      include: { user: { select: userSelect } },
    });
    await addActivity(tx, teamId, actorId, 'MEMBER_ADDED', undefined, { userId: input.userId, role: input.role });
    return { ...row, user: person(row.user) };
  });
}

export async function updateTeamMember(actorId: string, teamId: string, membershipId: string, input: UpdateMemberInput) {
  await requireOwner(actorId, teamId);
  const target = await prisma.teamMembership.findFirst({ where: { id: membershipId, teamId } });
  if (!target) throw errors.notFound('Keanggotaan tidak ditemukan.');
  if (target.role === 'OWNER') throw errors.badRequest('OWNER_MEMBERSHIP_LOCKED', 'Role Owner tidak dapat diubah dari menu anggota.');
  const team = await prisma.collaborationTeam.findUnique({ where: { id: teamId }, select: { primaryLeaderMembershipId: true } });
  if (team?.primaryLeaderMembershipId === membershipId && input.role === 'STAFF' && input.status !== 'REMOVED') {
    throw errors.badRequest('PRIMARY_LEADER_ROLE_LOCKED', 'Pilih Primary Leader lain sebelum mengubah role Leader ini menjadi Staff.');
  }
  return prisma.$transaction(async (tx) => {
    if (input.status === 'REMOVED') {
      await tx.taskAssignment.updateMany({
        where: { userId: target.userId, unassignedAt: null, task: { teamId } },
        data: { unassignedAt: new Date() },
      });
      if (team?.primaryLeaderMembershipId === membershipId) {
        const owner = await tx.teamMembership.findFirstOrThrow({ where: { teamId, role: 'OWNER', status: 'ACTIVE' }, select: { id: true } });
        await tx.collaborationTeam.update({ where: { id: teamId }, data: { primaryLeaderMembershipId: owner.id } });
      }
    }
    const row = await tx.teamMembership.update({
      where: { id: membershipId },
      data: {
        role: input.role,
        status: input.status,
        removedAt: input.status === 'REMOVED' ? new Date() : input.status === 'ACTIVE' ? null : undefined,
      },
      include: { user: { select: userSelect } },
    });
    await addActivity(tx, teamId, actorId, input.status === 'REMOVED' ? 'MEMBER_REMOVED' : 'MEMBER_UPDATED', undefined, { userId: target.userId, role: row.role });
    return { ...row, user: person(row.user) };
  });
}

export async function setPrimaryLeader(actorId: string, teamId: string, membershipId: string) {
  await requireOwner(actorId, teamId);
  const target = await prisma.teamMembership.findFirst({
    where: { id: membershipId, teamId, status: 'ACTIVE', role: { in: ['OWNER', 'LEADER'] } },
  });
  if (!target) throw errors.badRequest('INVALID_PRIMARY_LEADER', 'Primary Leader harus Owner atau Leader aktif.');
  return prisma.$transaction(async (tx) => {
    const team = await tx.collaborationTeam.update({ where: { id: teamId }, data: { primaryLeaderMembershipId: membershipId } });
    await addActivity(tx, teamId, actorId, 'PRIMARY_LEADER_CHANGED', undefined, { userId: target.userId });
    return team;
  });
}

async function createTaskRecord(
  actorId: string,
  input: CreateTaskInput | CreateSubtaskInput,
  teamId: string,
  parentTaskId?: string,
) {
  await requireTeamManager(actorId, teamId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${teamId}))`;
    const assigneeIds = await validateAssignees(tx, teamId, input.assigneeIds);
    let sortOrder = 0;
    if (parentTaskId) {
      const parent = await tx.teamTask.findFirst({ where: { id: parentTaskId, teamId, parentTaskId: null, deletedAt: null } });
      if (!parent) throw errors.badRequest('INVALID_PARENT_TASK', 'Parent task tidak valid atau sudah merupakan subtask.');
      const subtaskCount = await tx.teamTask.count({ where: { parentTaskId, deletedAt: null } });
      if (subtaskCount >= 50) throw errors.badRequest('SUBTASK_LIMIT_REACHED', 'Maksimal 50 subtask aktif per parent.');
      if (parent.dueAt && input.dueAt && new Date(input.dueAt) > parent.dueAt) {
        throw errors.badRequest('SUBTASK_DUE_AFTER_PARENT', 'Tenggat subtask tidak boleh melewati parent task.');
      }
      sortOrder = subtaskCount;
    }
    const last = await tx.teamTask.aggregate({ where: { teamId }, _max: { taskNo: true } });
    const task = await tx.teamTask.create({
      data: {
        teamId,
        taskNo: (last._max.taskNo || 0) + 1,
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        parentTaskId: parentTaskId || null,
        sortOrder,
        isRequired: input.isRequired,
        createdById: actorId,
        assignments: { create: assigneeIds.map((userId) => ({ userId, assignedById: actorId })) },
      },
      include: taskInclude,
    });
    await addActivity(tx, teamId, actorId, parentTaskId ? 'SUBTASK_CREATED' : 'TASK_CREATED', task.id, { title: task.title, parentTaskId: parentTaskId || null });
    return presentTask(task);
  });
}

export async function createTask(actorId: string, input: CreateTaskInput) {
  return createTaskRecord(actorId, input, input.teamId);
}

export async function createSubtask(actorId: string, parentTaskId: string, input: CreateSubtaskInput) {
  const parent = await prisma.teamTask.findFirst({ where: { id: parentTaskId, deletedAt: null }, select: { teamId: true } });
  if (!parent) throw errors.notFound('Parent task tidak ditemukan.');
  return createTaskRecord(actorId, input, parent.teamId, parentTaskId);
}

async function taskAndMembership(actorId: string, taskId: string) {
  const task = await prisma.teamTask.findFirst({
    where: { id: taskId, deletedAt: null },
    include: {
      team: true,
      assignments: { where: { unassignedAt: null }, select: { userId: true } },
      subtasks: {
        where: { deletedAt: null, assignments: { some: { userId: actorId, unassignedAt: null } } },
        select: { id: true },
      },
    },
  });
  if (!task) throw errors.notFound('Tugas tidak ditemukan.');
  const member = await membership(actorId, task.teamId);
  const isManager = member.role === 'OWNER' || member.role === 'LEADER';
  const isAssignee = task.assignments.some((row) => row.userId === actorId);
  const hasAssignedSubtask = task.subtasks.length > 0;
  if (task.team.taskVisibilityPolicy === 'ASSIGNEE_ONLY' && !isManager && !isAssignee && !hasAssignedSubtask && task.createdById !== actorId) {
    throw errors.forbidden('Tugas ini hanya dapat dilihat assignee dan pengelola tim.');
  }
  return { task, member, isManager, isAssignee };
}

export async function updateTask(actorId: string, taskId: string, input: UpdateTaskInput) {
  const context = await taskAndMembership(actorId, taskId);
  if (!context.isManager) throw errors.forbidden('Hanya Owner atau Leader yang dapat mengubah detail tugas.');
  if (context.task.version !== input.version) throw errors.conflict('TASK_VERSION_CONFLICT', 'Tugas telah berubah. Muat ulang sebelum menyimpan.');
  return prisma.$transaction(async (tx) => {
    const assigneeIds = input.assigneeIds ? await validateAssignees(tx, context.task.teamId, input.assigneeIds) : undefined;
    if (context.task.parentTaskId && input.dueAt) {
      const parent = await tx.teamTask.findUnique({ where: { id: context.task.parentTaskId }, select: { dueAt: true } });
      if (parent?.dueAt && new Date(input.dueAt) > parent.dueAt) throw errors.badRequest('SUBTASK_DUE_AFTER_PARENT', 'Tenggat subtask tidak boleh melewati parent task.');
    }
    if (!context.task.parentTaskId && input.dueAt) {
      const childOutsideDeadline = await tx.teamTask.findFirst({
        where: { parentTaskId: taskId, deletedAt: null, dueAt: { gt: new Date(input.dueAt) } },
        select: { id: true },
      });
      if (childOutsideDeadline) throw errors.badRequest('PARENT_DUE_BEFORE_SUBTASK', 'Tenggat parent tidak boleh lebih awal dari subtask yang sudah ada.');
    }
    if (assigneeIds) {
      await tx.taskAssignment.deleteMany({ where: { taskId } });
      await tx.taskAssignment.createMany({ data: assigneeIds.map((userId) => ({ taskId, userId, assignedById: actorId })) });
    }
    const updatedCount = await tx.teamTask.updateMany({
      where: { id: taskId, version: input.version },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        priority: input.priority,
        dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
        isRequired: input.isRequired,
        version: { increment: 1 },
      },
    });
    if (updatedCount.count !== 1) throw errors.conflict('TASK_VERSION_CONFLICT', 'Tugas telah berubah. Muat ulang sebelum menyimpan.');
    await addActivity(tx, context.task.teamId, actorId, 'TASK_UPDATED', taskId, { fields: Object.keys(input).filter((key) => key !== 'version') });
    const updated = await tx.teamTask.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
    return presentTask(updated);
  });
}

const staffTransitions: Partial<Record<CollaborationTaskStatus, CollaborationTaskStatus[]>> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED'],
  NEEDS_REVISION: ['IN_PROGRESS', 'SUBMITTED'],
};

export async function updateTaskStatus(actorId: string, taskId: string, input: UpdateTaskStatusInput) {
  const context = await taskAndMembership(actorId, taskId);
  if (!context.isManager) {
    if (!context.isAssignee || !(staffTransitions[context.task.status] || []).includes(input.status)) {
      throw errors.forbidden('Perubahan status ini memerlukan Owner atau Leader.');
    }
  }
  if (context.task.version !== input.version) throw errors.conflict('TASK_VERSION_CONFLICT', 'Tugas telah berubah. Muat ulang sebelum menyimpan.');
  if (input.status === 'CANCELLED' && !input.reason) throw errors.badRequest('CANCEL_REASON_REQUIRED', 'Alasan pembatalan wajib diisi.');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${context.task.teamId}))`;
    if (input.status === 'COMPLETED' && !context.task.parentTaskId) {
      const blockers = await tx.teamTask.count({
        where: { parentTaskId: taskId, isRequired: true, deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      });
      if (blockers > 0) throw errors.badRequest('SUBTASKS_INCOMPLETE', 'Selesaikan seluruh subtask wajib sebelum menyelesaikan parent task.');
    }
    if (input.status === 'CANCELLED' && !context.task.parentTaskId) {
      await tx.teamTask.updateMany({
        where: { parentTaskId: taskId, deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: `Parent dibatalkan: ${input.reason}`, version: { increment: 1 } },
      });
    }
    const updatedCount = await tx.teamTask.updateMany({
      where: { id: taskId, version: input.version },
      data: {
        status: input.status,
        reviewedById: ['COMPLETED', 'NEEDS_REVISION'].includes(input.status) ? actorId : undefined,
        completedAt: input.status === 'COMPLETED' ? new Date() : null,
        cancelledAt: input.status === 'CANCELLED' ? new Date() : null,
        cancelReason: input.status === 'CANCELLED' ? input.reason : null,
        version: { increment: 1 },
      },
    });
    if (updatedCount.count !== 1) throw errors.conflict('TASK_VERSION_CONFLICT', 'Tugas telah berubah. Muat ulang sebelum menyimpan.');
    await addActivity(tx, context.task.teamId, actorId, 'TASK_STATUS_CHANGED', taskId, { from: context.task.status, to: input.status, reason: input.reason || null });
    const updated = await tx.teamTask.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
    return presentTask(updated);
  });
}

export async function createComment(actorId: string, taskId: string, content: string) {
  const context = await taskAndMembership(actorId, taskId);
  return prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({
      data: { taskId, authorId: actorId, content },
      include: { author: { select: userSelect } },
    });
    await addActivity(tx, context.task.teamId, actorId, 'COMMENT_ADDED', taskId);
    return { ...comment, author: person(comment.author) };
  });
}

export async function getTaskDetail(actorId: string, taskId: string) {
  const context = await taskAndMembership(actorId, taskId);
  const task = await prisma.teamTask.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) throw errors.notFound('Tugas tidak ditemukan.');
  return presentTaskForActor(
    task,
    actorId,
    context.member.role === 'STAFF' && context.task.team.taskVisibilityPolicy === 'ASSIGNEE_ONLY',
  );
}

export async function getBootstrap(actorId: string, query: { teamId?: string; status?: string; search?: string }) {
  const status = query.status || 'ALL';
  const search = query.search || '';
  const memberships = await prisma.teamMembership.findMany({
    where: { userId: actorId, status: 'ACTIVE', team: { status: 'ACTIVE' } },
    include: {
      team: {
        include: {
          primaryLeader: { include: { user: { select: userSelect } } },
          memberships: {
            where: { status: 'ACTIVE' },
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            include: { user: { select: userSelect } },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
  const teams = memberships.map((row) => ({
    ...row.team,
    myRole: row.role,
    primaryLeader: row.team.primaryLeader ? person(row.team.primaryLeader.user) : null,
    memberships: row.team.memberships.map((member) => ({ ...member, user: person(member.user) })),
  }));
  const selectedTeam = teams.find((team) => team.id === query.teamId) || teams[0] || null;
  const restrictTasks = selectedTeam?.taskVisibilityPolicy === 'ASSIGNEE_ONLY' && selectedTeam.myRole === 'STAFF';
  const taskWhere: Prisma.TeamTaskWhereInput = selectedTeam ? {
    teamId: selectedTeam.id,
    parentTaskId: null,
    deletedAt: null,
    ...(status !== 'ALL' ? { status: status as CollaborationTaskStatus } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
  } : { id: '__no_team__' };
  if (restrictTasks) {
    taskWhere.AND = [{
      OR: [
        { createdById: actorId },
        { assignments: { some: { userId: actorId, unassignedAt: null } } },
        { subtasks: { some: { assignments: { some: { userId: actorId, unassignedAt: null } } } } },
      ],
    }];
  }
  const activityWhere: Prisma.TaskActivityWhereInput | null = selectedTeam ? {
    teamId: selectedTeam.id,
    ...(restrictTasks ? {
      OR: [
        { taskId: null },
        { task: { createdById: actorId } },
        { task: { assignments: { some: { userId: actorId, unassignedAt: null } } } },
        { task: { subtasks: { some: { assignments: { some: { userId: actorId, unassignedAt: null } } } } } },
      ],
    } : {}),
  } : null;
  const [tasks, activities, users] = await Promise.all([
    prisma.teamTask.findMany({ where: taskWhere, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], include: taskInclude }),
    activityWhere ? prisma.taskActivity.findMany({
      where: activityWhere,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: userSelect }, task: { select: { id: true, taskNo: true, title: true } } },
    }) : Promise.resolve([]),
    selectedTeam?.myRole === 'OWNER'
      ? prisma.user.findMany({ where: { isActive: true, role: { not: 'MEMBER' } }, orderBy: { profile: { fullName: 'asc' } }, select: userSelect })
      : Promise.resolve([]),
  ]);
  const presentedTasks = tasks.map((task) => presentTaskForActor(task, actorId, restrictTasks));
  const flatTasks = presentedTasks.flatMap((task) => [task, ...task.subtasks]);
  const now = Date.now();
  const done = (status: string) => ['COMPLETED', 'CANCELLED'].includes(status);
  return {
    teams,
    selectedTeamId: selectedTeam?.id || null,
    tasks: presentedTasks,
    users: users.map(person),
    activities: activities.map((activity: any) => ({ ...activity, actor: person(activity.actor) })),
    stats: {
      total: flatTasks.length,
      todo: flatTasks.filter((task) => task.status === 'TODO').length,
      inProgress: flatTasks.filter((task) => task.status === 'IN_PROGRESS').length,
      submitted: flatTasks.filter((task) => task.status === 'SUBMITTED').length,
      completed: flatTasks.filter((task) => task.status === 'COMPLETED').length,
      overdue: flatTasks.filter((task) => task.dueAt && !done(task.status) && new Date(task.dueAt).getTime() < now).length,
    },
  };
}
