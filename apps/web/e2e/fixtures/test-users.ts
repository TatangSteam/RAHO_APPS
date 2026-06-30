export const E2E_ROLES = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
  'ADMIN_CABANG',
  'ADMIN_LAYANAN',
  'DOCTOR',
  'NURSE',
  'MEMBER',
] as const;

export type E2ERole = (typeof E2E_ROLES)[number];

export interface E2EUser {
  role: E2ERole;
  email: string;
  password: string;
  expectedPath: string;
}

export const ROLE_HOME_PATH: Record<E2ERole, string> = {
  SUPER_ADMIN: '/admin/super-admin',
  ADMIN_MANAGER: '/dashboard/admin-manager',
  ADMIN_CABANG: '/dashboard',
  ADMIN_LAYANAN: '/dashboard/admin-layanan',
  DOCTOR: '/dashboard/doctor',
  NURSE: '/dashboard/nurse',
  MEMBER: '/me/dashboard',
};

export function getCredentialEnvNames(role: E2ERole) {
  return {
    email: `E2E_${role}_EMAIL`,
    password: `E2E_${role}_PASSWORD`,
  };
}

export function getTestUser(role: E2ERole): E2EUser | null {
  const env = getCredentialEnvNames(role);
  const email = process.env[env.email];
  const password = process.env[env.password];

  if (!email || !password) return null;

  return {
    role,
    email,
    password,
    expectedPath: ROLE_HOME_PATH[role],
  };
}

export function requireTestUser(role: E2ERole): E2EUser {
  const user = getTestUser(role);
  if (!user) {
    const env = getCredentialEnvNames(role);
    throw new Error(`Missing E2E credentials for ${role}. Set ${env.email} and ${env.password}.`);
  }
  return user;
}

export function missingCredentialMessage(role: E2ERole): string {
  const env = getCredentialEnvNames(role);
  return `Skipped: set ${env.email} and ${env.password} to run this login test.`;
}

export function configuredRoles(): E2ERole[] {
  return E2E_ROLES.filter((role) => Boolean(getTestUser(role)));
}
