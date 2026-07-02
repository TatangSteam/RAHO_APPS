import type { Role } from '@/types/auth';

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_MANAGER: 'Admin Manager',
  ADMIN_CABANG: 'Admin Cabang',
  ADMIN_LAYANAN: 'Admin Layanan',
  DOCTOR: 'Dokter',
  NURSE: 'Nakes',
  MEMBER: 'Member',
};

export const ROLE_TEXT_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'text-rose-500 dark:text-rose-400',
  ADMIN_MANAGER: 'text-purple-500 dark:text-purple-400',
  ADMIN_CABANG: 'text-amber-600 dark:text-amber-400',
  ADMIN_LAYANAN: 'text-emerald-500 dark:text-emerald-400',
  DOCTOR: 'text-blue-500 dark:text-blue-400',
  NURSE: 'text-cyan-500 dark:text-cyan-400',
  MEMBER: 'text-slate-500 dark:text-slate-400',
};

export function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function getRoleTextColor(role: Role): string {
  return ROLE_TEXT_COLORS[role];
}
