import { randomUUID } from 'crypto';
import { PackageStatus, PackageType, PaymentMethod, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { InvoicePaymentService } from '../invoice-payment.service';
import { InvoiceRefundService } from '../invoice-refund.service';

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
  const normalInvoiceId = `pay_normal_invoice_${runId}`;
  const normalPaymentId = `pay_normal_payment_${runId}`;
  const service = new InvoicePaymentService();
  const refundService = new InvoiceRefundService();
  let createdFinanceTemplateId: string | null = null;

  beforeAll(async () => {
    let financeTemplate = await prisma.roleTemplate.findUnique({
      where: { code: 'FINANCE_DUMMY' },
    });
    if (!financeTemplate) {
      const requiredPermissions = await prisma.permission.findMany({
        where: {
          code: {
            in: [
              PERMISSIONS.PAYMENT_VERIFY,
              PERMISSIONS.PAYMENT_REJECT,
              PERMISSIONS.PAYMENT_REFUND,
              PERMISSIONS.JOURNAL_POST,
            ],
          },
          isActive: true,
        },
        select: { id: true },
      });
      if (requiredPermissions.length !== 4) {
        throw new Error('Migration IAM belum menyediakan permission pembayaran yang dibutuhkan test.');
      }
      financeTemplate = await prisma.roleTemplate.create({
        data: {
          code: 'FINANCE_DUMMY',
          name: 'Finance Integration Test',
          description: 'Fixture sementara untuk integration test pembayaran.',
          permissions: {
            create: requiredPermissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
      });
      createdFinanceTemplateId = financeTemplate.id;
    }
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
        name: `Year 2026 Payment ${runId}`,
        fiscalYear: 2026,
        periodNo: 1,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
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
    await prisma.invoice.create({
      data: {
        id: normalInvoiceId,
        invoiceNumber: `INV-NORMAL-${runId}`,
        memberId,
        branchId,
        subtotal: '1000.00',
        totalAmount: '1000.00',
        status: 'PENDING_PAYMENT',
        finalizedAt: new Date('2026-07-20T00:00:00.000Z'),
        createdBy: verifierId,
        items: {
          create: {
            itemType: 'ADDON',
            itemId: `addon-${runId}`,
            code: `ADD-${runId}`,
            description: 'Normal sale',
            pricePerUnit: '1000.00',
            subtotal: '1000.00',
            totalAmount: '1000.00',
          },
        },
        payments: {
          create: {
            id: normalPaymentId,
            idempotencyKey: `PAYMENT-NORMAL-${runId}`,
            payloadHash: `hash-normal-${runId}`,
            amount: '600.00',
            paymentMethod: PaymentMethod.CASH,
            cashBankAccountId: cashAccountId,
            receivedBy: submitterId,
          },
        },
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.integrationEvent.deleteMany({
      where: { branchId },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: [memberUserId, submitterId, verifierId] } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ branchId }, { userId: { in: [verifierId, submitterId] } }] } });
    await prisma.deferredRevenueMovement.deleteMany({ where: { memberPackageId } });
    await prisma.invoicePaymentRefund.deleteMany({
      where: { invoicePaymentId: normalPaymentId },
    });
    await prisma.cashBankTransaction.deleteMany({ where: { branchId } });
    await prisma.invoicePayment.deleteMany({ where: { invoiceId: { in: [invoiceId, normalInvoiceId] } } });
    await prisma.packageRevenueContract.deleteMany({ where: { memberPackageId } });
    await prisma.packageBenefitValuation.deleteMany({ where: { memberPackageId } });
    await prisma.invoiceItem.deleteMany({ where: { id: invoiceItemId } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: normalInvoiceId } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceId, normalInvoiceId] } } });
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
    if (createdFinanceTemplateId) {
      await prisma.roleTemplate.deleteMany({
        where: { id: createdFinanceTemplateId, users: { none: {} } },
      });
    }
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
    const zohoEvent = await prisma.integrationEvent.findUniqueOrThrow({
      where: {
        eventType_aggregateId: {
          eventType: 'PAYMENT_VERIFIED',
          aggregateId: paymentId,
        },
      },
    });
    expect(zohoEvent.status).toBe('PENDING');
    expect(zohoEvent.payload).toMatchObject({
      classification: 'THERAPY_ADVANCE',
      eligible: false,
      amount: '600.00',
      outstandingAfter: '400.00',
    });

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
    expect(await prisma.integrationEvent.count({
      where: { eventType: 'PAYMENT_VERIFIED', aggregateId: rejectedPaymentId },
    })).toBe(0);
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

  it('posts an immutable partial refund, reduces net paid, and enqueues the Zoho reversal once', async () => {
    await service.verifyPayment(
      normalPaymentId,
      { reason: 'Normal payment verified' },
      submitterId,
    );
    const input = {
      amount: '100.00',
      cashBankAccountId: cashAccountId,
      reason: 'Kelebihan pembayaran member',
      referenceNumber: `REF-${runId}`,
      refundDate: '2026-07-28T09:00:00.000Z',
      postingKey: `REFUND-NORMAL-${runId}`,
    };
    const first = await refundService.refundPayment(normalPaymentId, input, submitterId);
    const replay = await refundService.refundPayment(normalPaymentId, input, submitterId);
    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: normalInvoiceId } });
    expect(invoice.actualPaidAmount?.toFixed(2)).toBe('500.00');
    expect(invoice.status).toBe('PENDING_PAYMENT');
    expect(await prisma.invoicePaymentRefund.count({ where: { invoicePaymentId: normalPaymentId } })).toBe(1);
    expect(await prisma.cashBankTransaction.count({
      where: { sourceType: 'INVOICE_PAYMENT_REFUND', sourceId: first.refund.id },
    })).toBe(1);

    const event = await prisma.integrationEvent.findUniqueOrThrow({
      where: {
        eventType_aggregateId: {
          eventType: 'PAYMENT_REFUNDED',
          aggregateId: first.refund.id,
        },
      },
    });
    expect(event.payload).toMatchObject({
      originalPaymentId: normalPaymentId,
      amount: '100.00',
      remainingAppliedAmountAfterRefund: '500.00',
      eligible: true,
    });
  }, 45_000);
});
