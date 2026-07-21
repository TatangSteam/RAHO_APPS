import { PermissionEffect, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';
import {
  assertBranchAccess,
  assertCanGrantPermissions,
  assertNotSelf,
  assertTargetInActorScope,
  getAccessibleBranchIds,
  getEffectivePermissionCodes,
  getUserBranchIds,
} from './authorization.service';
import type {
  AssignUserRoleTemplateInput,
  CreateRoleTemplateInput,
  ReplaceUserBranchScopeInput,
  ReplaceUserOverridesInput,
  UpdateRoleTemplateInput,
} from './iam.schema';

const permissionSelect = {
  id: true,
  code: true,
  name: true,
  module: true,
  description: true,
  isSensitive: true,
  isActive: true,
} as const;

async function resolvePermissions(codes: string[]) {
  const uniqueCodes = Array.from(new Set(codes));
  const permissions = await prisma.permission.findMany({
    where: { code: { in: uniqueCodes }, isActive: true },
    select: permissionSelect,
  });
  const found = new Set(permissions.map((permission) => permission.code));
  const missing = uniqueCodes.filter((code) => !found.has(code));
  if (missing.length) throw errors.badRequest('PERMISSION_NOT_FOUND', `Permission tidak ditemukan: ${missing.join(', ')}.`);
  return permissions;
}

export async function assignUserRoleTemplateService(
  actorUserId: string,
  targetUserId: string,
  input: AssignUserRoleTemplateInput,
) {
  assertNotSelf(actorUserId, targetUserId, 'mengubah role template');
  await assertTargetInActorScope(actorUserId, targetUserId);

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, roleTemplateId: true },
  });
  if (!target) throw errors.notFound('User tidak ditemukan.');

  const template = input.roleTemplateId
    ? await prisma.roleTemplate.findUnique({
        where: { id: input.roleTemplateId },
        include: { permissions: { include: { permission: { select: { code: true } } } } },
      })
    : null;
  if (input.roleTemplateId && (!template || !template.isActive)) {
    throw errors.badRequest('ROLE_TEMPLATE_NOT_FOUND', 'Role template tidak ditemukan atau tidak aktif.');
  }
  if (template) {
    await assertCanGrantPermissions(actorUserId, template.permissions.map((item) => item.permission.code));
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { roleTemplateId: input.roleTemplateId },
    select: {
      id: true,
      email: true,
      role: true,
      roleTemplate: { select: { id: true, code: true, name: true } },
    },
  });
  await logAudit({
    userId: actorUserId,
    action: 'UPDATE',
    module: 'IAM',
    resource: 'UserRoleTemplate',
    resourceId: targetUserId,
    entityType: 'User',
    entityId: targetUserId,
    beforeData: { roleTemplateId: target.roleTemplateId },
    afterData: { roleTemplateId: input.roleTemplateId },
    description: 'Role template user diperbarui.',
  });
  return updated;
}

export async function listPermissionsService() {
  return prisma.permission.findMany({
    select: permissionSelect,
    orderBy: [{ module: 'asc' }, { code: 'asc' }],
  });
}

export async function listRoleTemplatesService() {
  return prisma.roleTemplate.findMany({
    include: {
      permissions: {
        include: { permission: { select: permissionSelect } },
        orderBy: { permission: { code: 'asc' } },
      },
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
}

export async function createRoleTemplateService(actorUserId: string, input: CreateRoleTemplateInput) {
  await assertCanGrantPermissions(actorUserId, input.permissionCodes);
  const permissions = await resolvePermissions(input.permissionCodes);
  const created = await prisma.roleTemplate.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
    include: { permissions: { include: { permission: { select: permissionSelect } } } },
  });
  await logAudit({
    userId: actorUserId,
    action: 'CREATE',
    module: 'IAM',
    resource: 'RoleTemplate',
    resourceId: created.id,
    entityType: 'RoleTemplate',
    entityId: created.id,
    entityCode: created.code,
    afterData: created,
    description: `Role template ${created.code} dibuat.`,
  });
  return created;
}

export async function updateRoleTemplateService(actorUserId: string, id: string, input: UpdateRoleTemplateInput) {
  const before = await prisma.roleTemplate.findUnique({ where: { id } });
  if (!before) throw errors.notFound('Role template tidak ditemukan.');
  const updated = await prisma.roleTemplate.update({ where: { id }, data: input });
  await logAudit({
    userId: actorUserId,
    action: 'UPDATE',
    module: 'IAM',
    resource: 'RoleTemplate',
    resourceId: id,
    entityCode: updated.code,
    beforeData: before,
    afterData: updated,
    description: `Role template ${updated.code} diperbarui.`,
  });
  return updated;
}

export async function replaceRoleTemplatePermissionsService(actorUserId: string, id: string, codes: string[]) {
  await assertCanGrantPermissions(actorUserId, codes);
  const [template, permissions] = await Promise.all([
    prisma.roleTemplate.findUnique({
      where: { id },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    }),
    resolvePermissions(codes),
  ]);
  if (!template) throw errors.notFound('Role template tidak ditemukan.');
  const beforeCodes = template.permissions.map((item) => item.permission.code).sort();
  await prisma.$transaction(async (tx) => {
    await tx.roleTemplatePermission.deleteMany({ where: { roleTemplateId: id } });
    if (permissions.length) {
      await tx.roleTemplatePermission.createMany({
        data: permissions.map((permission) => ({ roleTemplateId: id, permissionId: permission.id })),
      });
    }
  });
  const afterCodes = permissions.map((permission) => permission.code).sort();
  await logAudit({
    userId: actorUserId,
    action: 'UPDATE',
    module: 'IAM',
    resource: 'RoleTemplatePermission',
    resourceId: id,
    entityCode: template.code,
    beforeData: { permissionCodes: beforeCodes },
    afterData: { permissionCodes: afterCodes },
    description: `Permission role template ${template.code} diperbarui.`,
  });
  return { id, code: template.code, permissionCodes: afterCodes };
}

export async function getUserAccessService(actorUserId: string, targetUserId: string) {
  await assertTargetInActorScope(actorUserId, targetUserId);
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      role: true,
      roleTemplateId: true,
      roleTemplate: { select: { id: true, code: true, name: true } },
      permissionOverrides: {
        include: {
          permission: { select: permissionSelect },
          branch: { select: { id: true, branchCode: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!user) throw errors.notFound('User tidak ditemukan.');
  const [effectivePermissions, branchIds] = await Promise.all([
    getEffectivePermissionCodes(targetUserId),
    getAccessibleBranchIds(targetUserId),
  ]);
  return { ...user, effectivePermissions, accessibleBranchIds: branchIds };
}

export async function replaceUserOverridesService(
  actorUserId: string,
  targetUserId: string,
  input: ReplaceUserOverridesInput,
) {
  assertNotSelf(actorUserId, targetUserId, 'mengubah permission');
  await assertTargetInActorScope(actorUserId, targetUserId);

  const codes = input.overrides.map((override) => override.permissionCode);
  const permissions = await resolvePermissions(codes);
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission]));
  for (const override of input.overrides) {
    await assertCanGrantPermissions(actorUserId, [override.permissionCode], override.branchId);
    if (override.branchId) {
      await assertBranchAccess(actorUserId, override.branchId);
      const targetBranches = await getUserBranchIds(targetUserId);
      if (!targetBranches.includes(override.branchId)) {
        throw errors.badRequest('TARGET_BRANCH_SCOPE_INVALID', 'Override cabang harus berada dalam branch scope user target.');
      }
    }
  }

  const before = await prisma.userPermissionOverride.findMany({
    where: { userId: targetUserId },
    include: { permission: { select: { code: true } } },
  });
  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { userId: targetUserId } });
    for (const override of input.overrides) {
      const permission = permissionByCode.get(override.permissionCode)!;
      await tx.userPermissionOverride.create({
        data: {
          userId: targetUserId,
          permissionId: permission.id,
          effect: override.effect as PermissionEffect,
          branchId: override.branchId || null,
          scopeKey: override.branchId || 'GLOBAL',
          reason: override.reason,
          validUntil: override.validUntil ? new Date(override.validUntil) : null,
          createdBy: actorUserId,
        },
      });
    }
  });
  await logAudit({
    userId: actorUserId,
    action: 'UPDATE',
    module: 'IAM',
    resource: 'UserPermissionOverride',
    resourceId: targetUserId,
    entityType: 'User',
    entityId: targetUserId,
    beforeData: before.map((item) => ({ code: item.permission.code, effect: item.effect, scopeKey: item.scopeKey })),
    afterData: input.overrides,
    description: 'User permission override diperbarui.',
  });
  return getUserAccessService(actorUserId, targetUserId);
}

export async function replaceUserBranchScopeService(
  actorUserId: string,
  targetUserId: string,
  input: ReplaceUserBranchScopeInput,
) {
  assertNotSelf(actorUserId, targetUserId, 'mengubah branch scope');
  await assertTargetInActorScope(actorUserId, targetUserId);
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, branchId: true } });
  if (!target) throw errors.notFound('User tidak ditemukan.');
  if (target.role === Role.MEMBER || target.role === Role.SUPER_ADMIN) {
    throw errors.badRequest('BRANCH_SCOPE_NOT_APPLICABLE', 'Branch scope tidak dapat diubah untuk role ini.');
  }
  for (const branchId of input.branchIds) await assertBranchAccess(actorUserId, branchId);
  const branches = await prisma.branch.findMany({ where: { id: { in: input.branchIds }, isActive: true }, select: { id: true } });
  if (branches.length !== input.branchIds.length) throw errors.badRequest('BRANCH_NOT_FOUND', 'Satu atau lebih cabang tidak ditemukan atau tidak aktif.');

  const before = await getUserBranchIds(targetUserId);
  await prisma.$transaction(async (tx) => {
    if (target.role === Role.ADMIN_MANAGER) {
      await tx.managerBranch.deleteMany({ where: { userId: targetUserId } });
      if (input.branchIds.length) await tx.managerBranch.createMany({ data: input.branchIds.map((branchId) => ({ userId: targetUserId, branchId })) });
    } else {
      await tx.staffBranch.deleteMany({ where: { userId: targetUserId } });
      if (input.branchIds.length) await tx.staffBranch.createMany({ data: input.branchIds.map((branchId) => ({ userId: targetUserId, branchId })) });
      await tx.user.update({
        where: { id: targetUserId },
        data: { branchId: input.primaryBranchId ?? input.branchIds[0] ?? null },
      });
    }
  });
  await logAudit({
    userId: actorUserId,
    action: 'UPDATE',
    module: 'IAM',
    resource: 'UserBranchScope',
    resourceId: targetUserId,
    entityType: 'User',
    entityId: targetUserId,
    beforeData: { branchIds: before, primaryBranchId: target.branchId },
    afterData: input,
    description: 'Branch scope user diperbarui.',
  });
  return getUserAccessService(actorUserId, targetUserId);
}
