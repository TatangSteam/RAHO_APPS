import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  createOpeningBalance,
  postOpeningBalance,
  rejectOpeningBalance,
  submitOpeningBalance,
  updateOpeningBalance,
} from '../opening-balance.service';

const describeDatabase = process.env.RUN_FINANCE_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('opening balance autonomous Finance integration', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 12);
  const financeId = `ob_finance_${runId}`;
  const branchId = `ob_branch_${runId}`;
  const periodId = `ob_period_${runId}`;
  let openingId = '';

  const lines = [
    { type: 'GENERAL' as const, accountCode: '1110', description: 'Saldo awal kas', debit: '1000.00', credit: '0' },
    { type: 'GENERAL' as const, accountCode: '3100', description: 'Modal saldo awal', debit: '0', credit: '1000.00' },
  ];

  beforeAll(async () => {
    const financeTemplate = await prisma.roleTemplate.findUniqueOrThrow({ where: { code: 'FINANCE_DUMMY' } });
    await prisma.user.create({
      data: {
        id: financeId,
        email: `ob-finance-${runId}@example.test`,
        password: 'test-only',
        role: Role.SUPER_ADMIN,
        roleTemplateId: financeTemplate.id,
      },
    });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `OB${runId.slice(0, 6)}`, name: `Opening ${runId}` },
    });
    await prisma.user.update({ where: { id: financeId }, data: { branchId } });
    await prisma.accountingPeriod.create({
      data: {
        id: periodId,
        name: `Opening period ${runId}`,
        fiscalYear: 2026,
        periodNo: 7,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T23:59:59.999Z'),
        branchId,
        scopeKey: branchId,
        createdBy: financeId,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ branchId }, { userId: financeId }] } });
    if (openingId) await prisma.openingBalance.deleteMany({ where: { id: openingId } });
    const journals = await prisma.journalEntry.findMany({ where: { branchId }, select: { id: true } });
    const journalIds = journals.map((journal) => journal.id);
    await prisma.journalSourceLink.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    await prisma.journalSequence.deleteMany({ where: { scopeKey: branchId } });
    await prisma.accountingPeriod.deleteMany({ where: { id: periodId } });
    await prisma.user.deleteMany({ where: { id: financeId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  it('rejects imbalance then supports self-reject, edit, resubmit, post, and retry', async () => {
    await expect(createOpeningBalance(financeId, {
      postingKey: `OB-INVALID-${runId}`,
      branchId,
      balanceDate: new Date('2026-07-27T00:00:00.000Z'),
      description: 'Opening tidak balanced',
      lines: [
        lines[0],
        { ...lines[1], credit: '999.00' },
      ],
    })).rejects.toMatchObject({ code: 'OPENING_NOT_BALANCED' });
    expect(await prisma.openingBalance.count({ where: { postingKey: `OB-INVALID-${runId}` } })).toBe(0);

    const created = await createOpeningBalance(financeId, {
      postingKey: `OB-VALID-${runId}`,
      branchId,
      balanceDate: new Date('2026-07-27T00:00:00.000Z'),
      description: 'Opening balanced untuk koreksi',
      lines,
    });
    openingId = created.openingBalance.id;
    await submitOpeningBalance(financeId, openingId);
    await rejectOpeningBalance(financeId, openingId, 'Mapping saldo awal perlu diperbaiki');

    const rejected = await prisma.openingBalance.findUniqueOrThrow({ where: { id: openingId } });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reviewedBy).toBe(financeId);
    expect(rejected.rejectionReason).toBe('Mapping saldo awal perlu diperbaiki');
    expect(await prisma.journalEntry.count({ where: { postingKey: `OPENING_BALANCE:${openingId}` } })).toBe(0);

    await updateOpeningBalance(financeId, openingId, {
      description: 'Opening balanced setelah koreksi',
      lines,
    });
    await submitOpeningBalance(financeId, openingId);
    const firstPost = await postOpeningBalance(financeId, openingId);
    const retry = await postOpeningBalance(financeId, openingId);

    expect(firstPost.idempotentReplay).toBe(false);
    expect(retry.idempotentReplay).toBe(true);
    expect(firstPost.openingBalance.status).toBe('POSTED');
    expect(firstPost.openingBalance.createdBy).toBe(financeId);
    expect(firstPost.openingBalance.reviewedBy).toBe(financeId);
    expect(firstPost.openingBalance.totalDebit).toBe('1000.00');
    expect(firstPost.openingBalance.totalCredit).toBe('1000.00');
    expect(await prisma.journalEntry.count({ where: { postingKey: `OPENING_BALANCE:${openingId}` } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { resource: 'OpeningBalance', resourceId: openingId } })).toBeGreaterThanOrEqual(5);
  }, 45_000);
});
