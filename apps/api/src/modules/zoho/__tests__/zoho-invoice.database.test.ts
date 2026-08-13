import { randomUUID } from 'crypto';
import { PackageStatus, PackageType, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { InvoicePaymentService } from '@modules/invoices/services/invoice-payment.service';
import { InvoiceCancellationService } from '@modules/invoices/services/invoice-cancellation.service';
import {
  enqueueInvoice,
  INVOICE_FINALIZED_EVENT,
  INVOICE_VOIDED_EVENT,
} from '../zoho.invoice.service';

const describeDatabase = process.env.RUN_ZOHO_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Zoho Sprint 5 invoice database integration', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 12);
  const actorId = `zinv-actor-${runId}`;
  const memberUserId = `zinv-member-user-${runId}`;
  const memberId = `zinv-member-${runId}`;
  const branchId = `zinv-branch-${runId}`;
  const pricingId = `zinv-pricing-${runId}`;
  const packageId = `zinv-package-${runId}`;
  const invoiceId = `zinv-invoice-${runId}`;
  const payment = new InvoicePaymentService();
  const cancellation = new InvoiceCancellationService();

  beforeAll(async () => {
    await prisma.branch.create({
      data: {
        id: branchId,
        branchCode: `ZI${runId.slice(0, 6)}`,
        name: `Zoho Invoice Branch ${runId}`,
        type: 'PREMIER',
      },
    });
    await prisma.user.createMany({
      data: [
        {
          id: actorId,
          email: `zinv-actor-${runId}@example.test`,
          password: 'test-only',
          role: Role.SUPER_ADMIN,
          branchId,
        },
        {
          id: memberUserId,
          email: `zinv-member-${runId}@example.test`,
          password: 'test-only',
          role: Role.MEMBER,
          branchId,
        },
      ],
    });
    await prisma.userProfile.create({
      data: { userId: memberUserId, fullName: `Invoice Customer ${runId}` },
    });
    await prisma.member.create({
      data: {
        id: memberId,
        userId: memberUserId,
        memberNo: `ZIM${runId}`,
        registrationBranchId: branchId,
      },
    });
    await prisma.packagePricing.create({
      data: {
        id: pricingId,
        branchId,
        packageType: PackageType.BASIC,
        productCode: `ZINV-BASIC-${runId}`,
        name: `Basic ${runId}`,
        totalSessions: 4,
        price: '1000000.00',
      },
    });
    await prisma.memberPackage.create({
      data: {
        id: packageId,
        packageCode: `ZINV-PKG-${runId}`,
        memberId,
        branchId,
        packagePricingId: pricingId,
        packageType: PackageType.BASIC,
        productCode: `ZINV-BASIC-${runId}`,
        totalSessions: 4,
        finalPrice: '1000000.00',
        status: PackageStatus.PENDING_PAYMENT,
        assignedBy: actorId,
      },
    });
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        invoiceNumber: `ZINV-${runId}`,
        memberId,
        branchId,
        subtotal: '1000000.00',
        discountAmount: '0.00',
        taxPercent: '0',
        taxAmount: '0.00',
        totalAmount: '1000000.00',
        status: 'DRAFT',
        createdBy: actorId,
        items: {
          create: {
            itemType: 'PACKAGE',
            itemId: packageId,
            code: `ZINV-BASIC-${runId}`,
            description: `Basic ${runId}`,
            quantity: 1,
            pricePerUnit: '1000000.00',
            subtotal: '1000000.00',
            discountAmount: '0.00',
            totalAmount: '1000000.00',
          },
        },
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.integrationEvent.deleteMany({ where: { aggregateId: invoiceId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ branchId }, { userId: actorId }] } });
    await prisma.invoicePayment.deleteMany({ where: { invoiceId } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
    await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    await prisma.memberPackage.deleteMany({ where: { id: packageId } });
    await prisma.packagePricing.deleteMany({ where: { id: pricingId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.userProfile.deleteMany({ where: { userId: memberUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, memberUserId] } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  }, 30_000);

  it('atomically finalizes once and creates exactly one immutable event under concurrency', async () => {
    const results = await Promise.allSettled([
      payment.finalizeInvoice(invoiceId, '2026-08-10', actorId),
      payment.finalizeInvoice(invoiceId, '2026-08-10', actorId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const events = await prisma.integrationEvent.findMany({
      where: { eventType: INVOICE_FINALIZED_EVENT, aggregateId: invoiceId },
    });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      invoiceNumber: `ZINV-${runId}`,
      classification: 'THERAPY_ADVANCE',
      eligible: false,
      subtotal: '1000000.00',
      totalAmount: '1000000.00',
      lines: [{
        mappingEntityType: 'PACKAGE_PRICING',
        mappingLocalEntityId: pricingId,
      }],
    });
  }, 30_000);

  it('replays enqueue twenty times without duplicating the invoice event', async () => {
    for (let index = 0; index < 20; index += 1) await enqueueInvoice(invoiceId);
    expect(await prisma.integrationEvent.count({
      where: { eventType: INVOICE_FINALIZED_EVENT, aggregateId: invoiceId },
    })).toBe(1);
  });

  it('cancels locally and creates one void event instead of deleting the invoice', async () => {
    await cancellation.cancelInvoice(invoiceId, { reason: 'UAT cancellation test' }, actorId);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('CANCELLED');
    expect(await prisma.integrationEvent.count({
      where: { eventType: INVOICE_VOIDED_EVENT, aggregateId: invoiceId },
    })).toBe(1);
  });
});
