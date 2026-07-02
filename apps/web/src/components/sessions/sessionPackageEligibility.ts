import type { MemberPackage } from '@/types/member';

export const DEBT_SESSION_LIMIT = 2;

const DEBT_PACKAGE_STATUSES: readonly MemberPackage['status'][] = [
  'PENDING_PAYMENT',
  'WAITING_VERIFICATION',
];

export function isDebtPackageStatus(status: MemberPackage['status']): boolean {
  return DEBT_PACKAGE_STATUSES.includes(status);
}

export function getDebtRemainingSessions(
  memberPackage: MemberPackage,
  outstandingDebtSessions: number,
): number {
  return Math.max(
    0,
    Math.min(memberPackage.remainingSessions, DEBT_SESSION_LIMIT - outstandingDebtSessions),
  );
}

export function isDebtEligiblePackage(
  memberPackage: MemberPackage,
  outstandingDebtSessions: number,
): boolean {
  return (
    memberPackage.packageType === 'BASIC' &&
    isDebtPackageStatus(memberPackage.status) &&
    getDebtRemainingSessions(memberPackage, outstandingDebtSessions) > 0
  );
}

export function isPackageUsableForSession(
  memberPackage: MemberPackage,
  outstandingDebtSessions: number,
): boolean {
  if (memberPackage.packageType === 'BOOSTER') {
    return memberPackage.status === 'ACTIVE' && memberPackage.remainingSessions > 0;
  }

  return (
    (memberPackage.status === 'ACTIVE' && memberPackage.remainingSessions > 0) ||
    isDebtEligiblePackage(memberPackage, outstandingDebtSessions)
  );
}
