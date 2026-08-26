import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';

export const FINANCE_ROLE_TEMPLATE_CODE = 'FINANCE';

/**
 * Finance owns financial controls end-to-end. This policy is based on the IAM
 * template, not email or base role, so additional Finance users inherit it.
 */
export async function isAutonomousFinanceUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roleTemplate: { select: { code: true, isActive: true } },
    },
  });

  if (user?.role === Role.FINANCE_LOGISTICS_CONTROLLER) return true;

  return user?.roleTemplate?.isActive === true && [
    'FINANCE',
    'FINANCE_DUMMY',
    'FINANCE_LOGISTICS_CONTROLLER_DEFAULT',
  ].includes(user.roleTemplate.code);
}
