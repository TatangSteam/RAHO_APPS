import { PermissionEffect, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError, errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';
import { PERMISSIONS, PermissionCode } from './permission-catalog';

export interface AuthorizationActor {
  userId: string;
  role: string;
  branchId: string | null;
  permissions?: string[];
  accessibleBranchIds?: string[] | null;
}

async function getTemplatePermissionCodes(userId: string, role: Role): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roleTemplate: {
        select: {
          isActive: true,
          permissions: {
            where: { permission: { isActive: true } },
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  const explicitTemplate = user?.roleTemplate;
  if (explicitTemplate?.isActive) {
    return explicitTemplate.permissions.map((item) => item.permission.code);
  }

  const defaultTemplate = await prisma.roleTemplate.findUnique({
    where: { baseRole: role },
    select: {
      isActive: true,
      permissions: {
        where: { permission: { isActive: true } },
        select: { permission: { select: { code: true } } },
      },
    },
  });

  if (!defaultTemplate?.isActive) return [];
  return defaultTemplate.permissions.map((item) => item.permission.code);
}

export async function getEffectivePermissionCodes(
  userId: string,
  branchId?: string | null,
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (!user?.isActive) return [];

  const effective = new Set(await getTemplatePermissionCodes(userId, user.role));
  const now = new Date();
  const overrides = await prisma.userPermissionOverride.findMany({
    where: {
      userId,
      permission: { isActive: true },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      scopeKey: { in: branchId ? ['GLOBAL', branchId] : ['GLOBAL'] },
    },
    select: {
      effect: true,
      scopeKey: true,
      permission: { select: { code: true } },
    },
    orderBy: { scopeKey: 'asc' },
  });

  // Global override is applied first; a branch-specific override is the final decision.
  overrides
    .sort((a, b) => Number(a.scopeKey !== 'GLOBAL') - Number(b.scopeKey !== 'GLOBAL'))
    .forEach((override) => {
      if (override.effect === PermissionEffect.ALLOW) effective.add(override.permission.code);
      else effective.delete(override.permission.code);
    });

  return Array.from(effective).sort();
}

export async function hasPermission(
  userId: string,
  permission: PermissionCode | string,
  branchId?: string | null,
): Promise<boolean> {
  const permissions = await getEffectivePermissionCodes(userId, branchId);
  return permissions.includes(permission);
}

export async function assertPermission(
  userId: string,
  permission: PermissionCode | string,
  branchId?: string | null,
): Promise<void> {
  if (!(await hasPermission(userId, permission, branchId))) {
    throw errors.forbidden(`Permission ${permission} diperlukan.`);
  }
}

export async function getAccessibleBranchIds(userId: string): Promise<string[] | null> {
  if (await hasPermission(userId, PERMISSIONS.BRANCH_ACCESS_ALL)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      branchId: true,
      branch: { select: { isActive: true } },
      managedBranches: {
        where: { branch: { isActive: true } },
        select: { branchId: true },
      },
      staffBranches: {
        where: { branch: { isActive: true } },
        select: { branchId: true },
      },
    },
  });

  if (!user) return [];
  const ids = new Set<string>();
  if (user.branchId && user.branch?.isActive) ids.add(user.branchId);
  user.managedBranches.forEach((item) => ids.add(item.branchId));
  user.staffBranches.forEach((item) => ids.add(item.branchId));
  return Array.from(ids);
}

export async function assertBranchAccess(userId: string, branchId: string): Promise<void> {
  const branchIds = await getAccessibleBranchIds(userId);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw errors.forbidden('Anda tidak memiliki akses ke cabang ini.');
  }
}

export async function getUserBranchIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      branchId: true,
      managedBranches: { select: { branchId: true } },
      staffBranches: { select: { branchId: true } },
    },
  });
  if (!user) throw errors.notFound('User tidak ditemukan.');
  return Array.from(new Set([
    ...(user.branchId ? [user.branchId] : []),
    ...user.managedBranches.map((item) => item.branchId),
    ...user.staffBranches.map((item) => item.branchId),
  ]));
}

export async function assertTargetInActorScope(actorUserId: string, targetUserId: string): Promise<void> {
  const [actorBranches, targetBranches] = await Promise.all([
    getAccessibleBranchIds(actorUserId),
    getUserBranchIds(targetUserId),
  ]);
  if (actorBranches === null) return;
  if (targetBranches.length === 0 || !targetBranches.some((branchId) => actorBranches.includes(branchId))) {
    throw errors.forbidden('User target berada di luar branch scope Anda.');
  }
}

export async function assertNotSelf(actorUserId: string, targetUserId: string, action: string): Promise<void> {
  if (actorUserId === targetUserId) {
    await logAudit({
      userId: actorUserId,
      action: 'ACCESS_DENIED',
      module: 'IAM',
      resource: 'SecurityEvent',
      resourceId: targetUserId,
      entityType: 'User',
      entityId: targetUserId,
      description: `Self-escalation ditolak: ${action}.`,
      metadata: {
        eventType: 'SELF_ESCALATION_DENIED',
        attemptedAction: action,
        targetUserId,
      },
    });
    throw errors.forbidden(`Anda tidak dapat ${action} akun sendiri.`);
  }
}

export async function assertCanGrantPermissions(
  actorUserId: string,
  permissionCodes: string[],
  branchId?: string | null,
): Promise<void> {
  const actorPermissions = new Set(await getEffectivePermissionCodes(actorUserId, branchId));
  const unauthorized = permissionCodes.filter((code) => !actorPermissions.has(code));
  if (unauthorized.length > 0) {
    throw errors.forbidden(`Anda tidak dapat memberikan permission yang tidak dimiliki: ${unauthorized.join(', ')}.`);
  }
}

export async function assertCanAssignBaseRole(actorUserId: string, targetRole: Role): Promise<void> {
  const template = await prisma.roleTemplate.findUnique({
    where: { baseRole: targetRole },
    select: {
      permissions: {
        where: { permission: { isActive: true } },
        select: { permission: { select: { code: true } } },
      },
    },
  });
  if (!template) throw errors.badRequest('ROLE_TEMPLATE_NOT_FOUND', `Template default untuk role ${targetRole} belum tersedia.`);
  await assertCanGrantPermissions(actorUserId, template.permissions.map((item) => item.permission.code));
}

export async function getAuthorizationContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, branchId: true, roleTemplateId: true, isActive: true },
  });
  if (!user?.isActive) throw new AppError(401, 'AUTH_USER_INACTIVE', 'Akun tidak aktif atau tidak ditemukan.');

  const [permissions, accessibleBranchIds] = await Promise.all([
    getEffectivePermissionCodes(user.id),
    getAccessibleBranchIds(user.id),
  ]);

  return { ...user, permissions, accessibleBranchIds };
}
