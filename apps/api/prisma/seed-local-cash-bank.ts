import { CashBankAccountType, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [creator, cashCoa, branches] = await Promise.all([
    prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN, isActive: true },
      select: { id: true },
    }),
    prisma.account.findUnique({
      where: { code: '1110' },
      select: { id: true, type: true, isActive: true, allowPosting: true },
    }),
    prisma.branch.findMany({
      where: { isActive: true, branchCode: { in: ['HQ', 'PST', 'SBY', 'BDG'] } },
      select: { id: true, branchCode: true, name: true },
      orderBy: { branchCode: 'asc' },
    }),
  ]);

  if (!creator) throw new Error('Super Admin aktif tidak ditemukan.');
  if (!cashCoa || cashCoa.type !== 'ASSET' || !cashCoa.isActive || !cashCoa.allowPosting) {
    throw new Error('COA 1110 (Kas) harus berupa akun aset aktif yang menerima posting.');
  }

  let created = 0;
  for (const branch of branches) {
    const existing = await prisma.cashBankAccount.findFirst({
      where: {
        branchId: branch.id,
        type: CashBankAccountType.CASH,
        isActive: true,
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.cashBankAccount.upsert({
      where: { code: `KAS-${branch.branchCode}` },
      update: { isActive: true },
      create: {
        code: `KAS-${branch.branchCode}`,
        name: `Kas ${branch.name}`,
        type: CashBankAccountType.CASH,
        branchId: branch.id,
        coaAccountId: cashCoa.id,
        currency: 'IDR',
        requiresReference: false,
        createdBy: creator.id,
      },
    });
    created += 1;
  }

  console.log(`Local cash/bank seed selesai: ${created} akun kas dibuat, ${branches.length - created} sudah tersedia.`);
}

main()
  .finally(async () => prisma.$disconnect());
