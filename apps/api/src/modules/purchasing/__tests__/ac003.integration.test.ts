import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { paySupplierInvoice, postSupplierInvoice } from '../purchasing.service';

const describeDatabase = process.env.RUN_FINANCE_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('AC-003 supplier credit purchase through payment PostgreSQL', () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `ac003_actor_${suffix}`;
  const branchId = `ac003_branch_${suffix}`;
  const periodId = `ac003_period_${suffix}`;
  const supplierId = `ac003_supplier_${suffix}`;
  const requestId = `ac003_pr_${suffix}`;
  const orderId = `ac003_po_${suffix}`;
  const receiptId = `ac003_gr_${suffix}`;
  const receiptJournalId = `ac003_je_${suffix}`;
  const cashAccountId = `ac003_cash_${suffix}`;

  beforeAll(async () => {
    const accounts = await prisma.account.findMany({ where: { code: { in: ['1110', '1300', '2110', '2100'] }, isActive: true, allowPosting: true } });
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    if (byCode.size !== 4) throw new Error('AC-003 integration memerlukan account 1110, 1300, 2110, dan 2100 dari migration kanonis.');
    await prisma.user.create({ data: { id: actorId, email: `ac003-${suffix}@test.local`, password: 'test-only', role: Role.SUPER_ADMIN } });
    await prisma.branch.create({ data: { id: branchId, branchCode: `A3${suffix.slice(0, 6)}`, name: `AC-003 ${suffix}` } });
    await prisma.accountingPeriod.create({ data: { id: periodId, name: `AC-003 2026 ${suffix}`, fiscalYear: 2026, periodNo: 7, startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2026-07-31T23:59:59.999Z'), branchId, scopeKey: branchId, createdBy: actorId } });
    await prisma.cashBankAccount.create({ data: { id: cashAccountId, code: `AC3-${suffix}`, name: `AC-003 Bank ${suffix}`, type: 'BANK', branchId, coaAccountId: byCode.get('1110')!.id, createdBy: actorId } });
    await prisma.supplier.create({ data: { id: supplierId, code: `AC3SUP-${suffix}`, name: `AC-003 Supplier ${suffix}`, createdBy: actorId } });
    await prisma.purchaseRequest.create({ data: { id: requestId, requestNumber: `AC3-PR-${suffix}`, postingKey: `AC3:PR:${suffix}`, payloadHash: suffix, branchId, requestDate: new Date('2026-07-01T00:00:00.000Z'), description: 'AC-003 PostgreSQL gate', status: 'CONVERTED', createdBy: actorId } });
    await prisma.purchaseOrder.create({ data: { id: orderId, poNumber: `AC3-PO-${suffix}`, postingKey: `AC3:PO:${suffix}`, payloadHash: suffix, purchaseRequestId: requestId, supplierId, branchId, status: 'RECEIVED', orderDate: new Date('2026-07-01T00:00:00.000Z'), totalAmount: '1000.00', createdBy: actorId } });
    await prisma.journalEntry.create({ data: { id: receiptJournalId, journalNumber: `AC3-JE-${suffix}`, postingKey: `AC3:GR:${suffix}`, payloadHash: suffix, transactionDate: new Date('2026-07-02T00:00:00.000Z'), description: 'AC-003 receipt fixture', branchId, accountingPeriodId: periodId, totalDebit: '1000.00', totalCredit: '1000.00', createdBy: actorId, postedBy: actorId, lines: { create: [
      { lineNo: 1, accountId: byCode.get('1300')!.id, branchId, debit: '1000.00', credit: '0' },
      { lineNo: 2, accountId: byCode.get('2110')!.id, branchId, debit: '0', credit: '1000.00' },
    ] } } });
    await prisma.goodsReceipt.create({ data: { id: receiptId, receiptNumber: `AC3-GR-${suffix}`, idempotencyKey: `AC3:GR:${suffix}`, payloadHash: suffix, purchaseOrderId: orderId, branchId, receiptDate: new Date('2026-07-02T00:00:00.000Z'), totalQuantity: '1', totalValue: '1000.00', journalEntryId: receiptJournalId, createdBy: actorId } });
  }, 30_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.supplierPayment.deleteMany({ where: { branchId } });
    await prisma.cashBankTransaction.deleteMany({ where: { branchId } });
    await prisma.supplierInvoice.deleteMany({ where: { branchId } });
    await prisma.goodsReceipt.deleteMany({ where: { id: receiptId } });
    const journalIds = (await prisma.journalEntry.findMany({ where: { branchId }, select: { id: true } })).map((row) => row.id);
    await prisma.journalSourceLink.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    await prisma.journalSequence.deleteMany({ where: { scopeKey: branchId } });
    await prisma.cashBankAccount.deleteMany({ where: { id: cashAccountId } });
    await prisma.purchaseOrder.deleteMany({ where: { id: orderId } });
    await prisma.purchaseRequest.deleteMany({ where: { id: requestId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.accountingPeriod.deleteMany({ where: { id: periodId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('posts AP once, supports partial/full payment, and leaves a zero balance', async () => {
    const invoiceInput = { postingKey: `AC3:SI:${suffix}`, purchaseOrderId: orderId, supplierInvoiceNumber: `VENDOR-${suffix}`, invoiceDate: new Date('2026-07-03T00:00:00.000Z'), dueDate: new Date('2026-08-03T00:00:00.000Z'), amount: '1000.00' };
    const invoices = await Promise.all([postSupplierInvoice(actorId, invoiceInput), postSupplierInvoice(actorId, invoiceInput)]);
    expect(invoices.filter((result) => result.idempotentReplay)).toHaveLength(1);
    const invoiceId = invoices[0].supplierInvoice.id;
    expect(await prisma.supplierInvoice.count({ where: { purchaseOrderId: orderId } })).toBe(1);

    const partialInput = { postingKey: `AC3:PAY1:${suffix}`, cashBankAccountId: cashAccountId, paymentDate: new Date('2026-07-04T00:00:00.000Z'), amount: '400.00', paymentReference: `BANK-1-${suffix}` };
    const partial = await Promise.all([paySupplierInvoice(actorId, invoiceId, partialInput), paySupplierInvoice(actorId, invoiceId, partialInput)]);
    expect(partial.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(partial[0]).toMatchObject({ invoiceStatus: 'PARTIALLY_PAID', balanceAmount: '600.00' });

    const final = await paySupplierInvoice(actorId, invoiceId, { postingKey: `AC3:PAY2:${suffix}`, cashBankAccountId: cashAccountId, paymentDate: new Date('2026-07-05T00:00:00.000Z'), amount: '600.00', paymentReference: `BANK-2-${suffix}` });
    expect(final).toMatchObject({ invoiceStatus: 'PAID', balanceAmount: '0.00' });
    const invoice = await prisma.supplierInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.paidAmount.toFixed(2)).toBe('1000.00');
    expect(await prisma.supplierPayment.count({ where: { supplierInvoiceId: invoiceId } })).toBe(2);
    expect((await prisma.cashBankTransaction.aggregate({ where: { branchId, sourceType: 'SUPPLIER_PAYMENT' }, _sum: { amount: true } }))._sum.amount?.toFixed(2)).toBe('1000.00');
    const apLines = await prisma.journalLine.findMany({ where: { branchId, account: { code: '2100' }, journalEntry: { sourceLinks: { some: { sourceType: { in: ['SUPPLIER_INVOICE', 'SUPPLIER_PAYMENT'] } } } } } });
    expect(apLines.reduce((sum, line) => sum.add(line.credit).sub(line.debit), invoice.amount.mul(0)).toFixed(2)).toBe('0.00');
  }, 60_000);
});
