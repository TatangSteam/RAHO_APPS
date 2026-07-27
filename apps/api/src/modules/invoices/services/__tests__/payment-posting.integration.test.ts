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
  const rejectedPaymentId = `pay_rejected_${runId}`;
  const resubmittedPaymentId = `pay_resubmit_${runId}`;
  const service = new InvoicePaymentService();

  beforeAll(async () => {
    const financeTemplate = await prisma.roleTemplate.findUniqueOrThrow({
      where: { code: 'FINANCE_DUMMY' },
    });
    await prisma.user.createMany({ data: [
      { id: verifierId, email: `pay-verifier-${runId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN },
      {
        id: submitterId,
        email: `pay-submitter-${runId}@example.test`,
        password: 'test-only',
        role: Role.SUPER_ADMIN,
        roleTemplateId: financeTemplate.id,
      },
    ] });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `PY${runId.slice(0, 6)}`, name: `Payment Branch ${runId}` },
    });
    await prisma.user.update({
      where: { id: submitterId },
      data: { branchId },
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
        price: '1000.00',
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
        finalPrice: '1000.00',
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
        subtotal: '1000.00',
        totalAmount: '1000.00',
        totalPurchaseAmount: '1000.00',
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
            pricePerUnit: '1000.00',
            subtotal: '1000.00',
            totalAmount: '1000.00',
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
        amount: '600.00',
        paymentMethod: PaymentMethod.CASH,
        cashBankAccountId: cashAccountId,
        receivedBy: submitterId,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [memberUserId, submitterId, verifierId] } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ branchId }, { userId: { in: [verifierId, submitterId] } }] } });
    await prisma.deferredRevenueMovement.deleteMany({ where: { memberPackageId } });
    await prisma.cashBankTransaction.deleteMany({ where: { invoicePaymentId: paymentId } });
    await prisma.invoicePayment.deleteMany({ where: { invoiceId } });
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

  it('posts a 600.00 partial payment exactly once and leaves 400.00 outstanding', async () => {
    const results = await Promise.all([
      service.verifyPayment(paymentId, { reason: 'Payment evidence verified by Finance' }, submitterId),
      service.verifyPayment(paymentId, { reason: 'Payment evidence verified by Finance' }, submitterId),
    ]);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(await prisma.cashBankTransaction.count({ where: { invoicePaymentId: paymentId } })).toBe(1);
    expect(await prisma.deferredRevenueMovement.count({
      where: { invoicePaymentId: paymentId, memberPackageId, type: 'FUNDING' },
    })).toBe(1);
    expect(await prisma.revenueRecognition.count({ where: { memberPackageId } })).toBe(0);

    const contract = await prisma.packageRevenueContract.findUniqueOrThrow({ where: { memberPackageId } });
    expect(contract.status).toBe('ACTIVE');
    expect(contract.fundedDeferredAmount.toFixed(2)).toBe('600.00');
    expect(contract.recognizedAmount.toFixed(2)).toBe('0.00');
    expect(contract.remainingDeferredAmount.toFixed(2)).toBe('600.00');

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('PENDING_PAYMENT');
    expect(invoice.actualPaidAmount?.toFixed(2)).toBe('600.00');
    expect(invoice.totalAmount.minus(invoice.actualPaidAmount || 0).toFixed(2)).toBe('400.00');

    const journal = await prisma.journalEntry.findUniqueOrThrow({
      where: { postingKey: `INVOICE_PAYMENT:${paymentId}` },
      include: { lines: { include: { account: true } } },
    });
    expect(journal.totalDebit.toFixed(2)).toBe('600.00');
    expect(journal.totalCredit.toFixed(2)).toBe('600.00');
    expect(Object.fromEntries(journal.lines.map((line) => [line.account.code, {
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
    }]))).toEqual({
      '1110': { debit: '600.00', credit: '0.00' },
      '2200': { debit: '0.00', credit: '600.00' },
    });
    expect(journal.lines.some((line) => line.account.code === '4100')).toBe(false);
  }, 45_000);

  it('rejects invalid evidence concurrently without journal and preserves history on resubmit', async () => {
    await prisma.invoicePayment.create({
      data: {
        id: rejectedPaymentId,
        invoiceId,
        idempotencyKey: `PAYMENT-REJECT-${runId}`,
        payloadHash: `hash-reject-${runId}`,
        amount: '400.00',
        paymentMethod: PaymentMethod.TRANSFER,
        cashBankAccountId: cashAccountId,
        paymentReference: `INVALID-${runId}`,
        proofFileUrl: `private/invalid-${runId}.jpg`,
        proofFileName: 'invalid-proof.jpg',
        proofFileSize: 128,
        proofMimeType: 'image/jpeg',
        receivedBy: submitterId,
      },
    });

    const results = await Promise.all([
      service.rejectPayment(rejectedPaymentId, { reason: 'Bukti pembayaran tidak valid' }, submitterId),
      service.rejectPayment(rejectedPaymentId, { reason: 'Bukti pembayaran tidak valid' }, submitterId),
    ]);

    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    const rejected = await prisma.invoicePayment.findUniqueOrThrow({ where: { id: rejectedPaymentId } });
    expect(rejected.verificationStatus).toBe('REJECTED');
    expect(rejected.verificationReason).toBe('Bukti pembayaran tidak valid');
    expect(await prisma.cashBankTransaction.count({ where: { invoicePaymentId: rejectedPaymentId } })).toBe(0);
    expect(await prisma.journalEntry.count({ where: { postingKey: `INVOICE_PAYMENT:${rejectedPaymentId}` } })).toBe(0);
    expect(await prisma.auditLog.count({
      where: { resource: 'InvoicePayment', resourceId: rejectedPaymentId, action: 'UPDATE' },
    })).toBe(1);

    await prisma.invoicePayment.create({
      data: {
        id: resubmittedPaymentId,
        invoiceId,
        idempotencyKey: `PAYMENT-RESUBMIT-${runId}`,
        payloadHash: `hash-resubmit-${runId}`,
        amount: '400.00',
        paymentMethod: PaymentMethod.TRANSFER,
        cashBankAccountId: cashAccountId,
        paymentReference: `VALID-${runId}`,
        proofFileUrl: `private/valid-${runId}.jpg`,
        proofFileName: 'valid-proof.jpg',
        proofFileSize: 256,
        proofMimeType: 'image/jpeg',
        receivedBy: submitterId,
      },
    });

    const history = await prisma.invoicePayment.findMany({
      where: { id: { in: [rejectedPaymentId, resubmittedPaymentId] } },
      orderBy: { id: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history.find((payment) => payment.id === rejectedPaymentId)?.verificationStatus).toBe('REJECTED');
    expect(history.find((payment) => payment.id === resubmittedPaymentId)?.verificationStatus).toBe('PENDING');
  }, 45_000);
});
