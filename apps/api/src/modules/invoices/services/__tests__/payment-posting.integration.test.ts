import { randomUUID } from 'crypto';
import { PackageStatus, PackageType, PaymentMethod, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { InvoicePaymentService } from '../invoice-payment.service';

const describeDatabase = process.env.RUN_FINANCE_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('AC-001 package payment posting integration', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const verifierId = `pay_verifier_${runId}`;
  const submitterId = `pay_submitter_${runId}`;
  const memberUserId = `pay_member_user_${runId}`;
  const memberId = `pay_member_${runId}`;
  const branchId = `pay_branch_${runId}`;
  const periodId = `pay_period_${runId}`;
  const cashAccountId = `pay_cash_${runId}`;
  const pricingId = `pay_pricing_${runId}`;
  const memberPackageId = `pay_package_${runId}`;
  const invoiceId = `pay_invoice_${runId}`;
  const invoiceItemId = `pay_item_${runId}`;
  const paymentId = `pay_payment_${runId}`;
  const service = new InvoicePaymentService();

  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: verifierId, email: `pay-verifier-${runId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN },
      { id: submitterId, email: `pay-submitter-${runId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN },
    ] });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `PY${runId.slice(0, 6)}`, name: `Payment Branch ${runId}` },
    });
    await prisma.user.create({
      data: {
        id: memberUserId,
        email: `pay-member-${runId}@example.test`,
        password: 'test-only',
        role: Role.MEMBER,
        branchId,
      },
    });
    await prisma.member.create({
      data: { id: memberId, userId: memberUserId, memberNo: `PM${runId}`, registrationBranchId: branchId },
    });
    await prisma.accountingPeriod.create({
      data: {
        id: periodId,
        name: `July 2026 Payment ${runId}`,
        fiscalYear: 2026,
        periodNo: 7,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T23:59:59.999Z'),
        branchId,
        scopeKey: branchId,
        createdBy: verifierId,
      },
    });
    const cashCoa = await prisma.account.findUniqueOrThrow({ where: { code: '1110' } });
    await prisma.cashBankAccount.create({
      data: {
        id: cashAccountId,
        code: `CASH-${runId}`,
        name: `Cash ${runId}`,
        type: 'CASH',
        branchId,
        coaAccountId: cashCoa.id,
        createdBy: verifierId,
      },
    });
    await prisma.packagePricing.create({
      data: {
        id: pricingId,
        branchId,
        packageType: PackageType.BASIC,
        productCode: `PAY-${runId}`,
        name: `Paid Package ${runId}`,
        totalSessions: 1,
        price: '1000000',
      },
    });
    await prisma.memberPackage.create({
      data: {
        id: memberPackageId,
        packageCode: `MPP-${runId}`,
        memberId,
        branchId,
        packagePricingId: pricingId,
        packageType: PackageType.BASIC,
        productCode: `PAY-${runId}`,
        totalSessions: 1,
        finalPrice: '1000000',
        status: PackageStatus.PENDING_PAYMENT,
        assignedBy: verifierId,
      },
    });
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        invoiceNumber: `INV-PAY-${runId}`,
        memberId,
        branchId,
        subtotal: '1000000',
        totalAmount: '1000000',
        totalPurchaseAmount: '1000000',
        status: 'PENDING_PAYMENT',
        finalizedAt: new Date('2026-07-20T00:00:00.000Z'),
        createdBy: verifierId,
        items: {
          create: {
            id: invoiceItemId,
            itemType: 'PACKAGE',
            itemId: memberPackageId,
            code: `PAY-${runId}`,
            description: `Paid Package ${runId}`,
            pricePerUnit: '1000000',
            subtotal: '1000000',
            totalAmount: '1000000',
          },
        },
      },
    });
    await prisma.invoicePayment.create({
      data: {
        id: paymentId,
        invoiceId,
        idempotencyKey: `PAYMENT-${runId}`,
        payloadHash: `hash-${runId}`,
        amount: '1000000',
        paymentMethod: PaymentMethod.CASH,
        cashBankAccountId: cashAccountId,
        receivedBy: submitterId,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ branchId }, { userId: { in: [verifierId, submitterId] } }] } });
    await prisma.deferredRevenueMovement.deleteMany({ where: { memberPackageId } });
    await prisma.cashBankTransaction.deleteMany({ where: { invoicePaymentId: paymentId } });
    await prisma.invoicePayment.deleteMany({ where: { id: paymentId } });
    await prisma.packageRevenueContract.deleteMany({ where: { memberPackageId } });
    await prisma.packageBenefitValuation.deleteMany({ where: { memberPackageId } });
    await prisma.invoiceItem.deleteMany({ where: { id: invoiceItemId } });
    await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    await prisma.memberPackage.deleteMany({ where: { id: memberPackageId } });
    await prisma.packagePricing.deleteMany({ where: { id: pricingId } });
    const journalIds = (await prisma.journalEntry.findMany({ where: { branchId }, select: { id: true } })).map((row) => row.id);
    await prisma.journalSourceLink.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    await prisma.journalSequence.deleteMany({ where: { scopeKey: branchId } });
    await prisma.cashBankAccount.deleteMany({ where: { id: cashAccountId } });
    await prisma.accountingPeriod.deleteMany({ where: { id: periodId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, submitterId, verifierId] } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  }, 30_000);

  it('posts cash and deferred funding exactly once without recognizing revenue', async () => {
    const results = await Promise.all([
      service.verifyPayment(paymentId, { reason: 'Payment evidence verified' }, verifierId),
      service.verifyPayment(paymentId, { reason: 'Payment evidence verified' }, verifierId),
    ]);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(await prisma.cashBankTransaction.count({ where: { invoicePaymentId: paymentId } })).toBe(1);
    expect(await prisma.deferredRevenueMovement.count({
      where: { invoicePaymentId: paymentId, memberPackageId, type: 'FUNDING' },
    })).toBe(1);
    expect(await prisma.revenueRecognition.count({ where: { memberPackageId } })).toBe(0);

    const contract = await prisma.packageRevenueContract.findUniqueOrThrow({ where: { memberPackageId } });
    expect(contract.status).toBe('ACTIVE');
    expect(contract.fundedDeferredAmount.toFixed(2)).toBe('1000000.00');
    expect(contract.recognizedAmount.toFixed(2)).toBe('0.00');
    expect(contract.remainingDeferredAmount.toFixed(2)).toBe('1000000.00');

    const journal = await prisma.journalEntry.findUniqueOrThrow({
      where: { postingKey: `INVOICE_PAYMENT:${paymentId}` },
      include: { lines: { include: { account: true } } },
    });
    expect(journal.totalDebit.toFixed(2)).toBe('1000000.00');
    expect(journal.totalCredit.toFixed(2)).toBe('1000000.00');
    expect(Object.fromEntries(journal.lines.map((line) => [line.account.code, {
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
    }]))).toEqual({
      '1110': { debit: '1000000.00', credit: '0.00' },
      '2200': { debit: '0.00', credit: '1000000.00' },
    });
    expect(journal.lines.some((line) => line.account.code === '4100')).toBe(false);
  }, 45_000);
});
