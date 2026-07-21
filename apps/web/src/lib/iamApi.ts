import { api } from '@/lib/api';

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string | null;
  isSensitive: boolean;
  isActive: boolean;
}

export interface RoleTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: Array<{ permission: Permission }>;
  _count?: { users: number };
}

export interface UserAccess {
  id: string;
  email: string;
  role: string;
  roleTemplateId: string | null;
  roleTemplate: { id: string; code: string; name: string } | null;
  effectivePermissions: string[];
  accessibleBranchIds: string[] | null;
  permissionOverrides: Array<{
    permission: Permission;
    effect: 'ALLOW' | 'DENY';
    branchId: string | null;
    reason: string;
  }>;
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const iamApi = {
  async permissions() {
    return unwrap<Permission[]>(await api.get('/iam/permissions'));
  },
  async roleTemplates() {
    return unwrap<RoleTemplate[]>(await api.get('/iam/role-templates'));
  },
  async replaceTemplatePermissions(id: string, permissionCodes: string[]) {
    return unwrap(await api.put(`/iam/role-templates/${id}/permissions`, { permissionCodes }));
  },
  async userAccess(userId: string) {
    return unwrap<UserAccess>(await api.get(`/iam/users/${userId}/access`));
  },
  async assignRoleTemplate(userId: string, roleTemplateId: string | null) {
    return unwrap(await api.put(`/iam/users/${userId}/role-template`, { roleTemplateId }));
  },
  async replaceUserBranches(userId: string, branchIds: string[], primaryBranchId?: string | null) {
    return unwrap<UserAccess>(await api.put(`/iam/users/${userId}/branches`, { branchIds, primaryBranchId }));
  },
  async replaceUserOverrides(
    userId: string,
    overrides: Array<{ permissionCode: string; effect: 'ALLOW' | 'DENY'; reason: string }>,
  ) {
    return unwrap<UserAccess>(await api.put(`/iam/users/${userId}/overrides`, { overrides }));
  },
};
