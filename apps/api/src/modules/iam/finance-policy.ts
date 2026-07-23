import { prisma } from '@lib/prisma';

export const FINANCE_ROLE_TEMPLATE_CODE = 'FINANCE';

/**
 * Finance owns financial controls end-to-end. This policy is based on the IAM
 * template, not email or base role, so additional Finance users inherit it.
 */
export async function isAutonomousFinanceUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleTemplate: { select: { code: true, isActive: true } } },
  });

  return user?.roleTemplate?.isActive === true &&
    ['FINANCE', 'FINANCE_DUMMY'].includes(user.roleTemplate.code);
}
