import { CashBankTransactionType, NormalBalance, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { cashBankReport, deferredRevenueReport, financialPosition, payableAging, profitLoss, receivableAging } from '../finance-report.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    journalLine: { findMany: jest.fn() },
    cashBankAccount: { findMany: jest.fn() },
    cashBankTransaction: { findMany: jest.fn() },
    deferredRevenueMovement: { findMany: jest.fn() },
    packageRevenuePolicy: { findMany: jest.fn() },
    packageBenefitValuation: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
    supplierInvoice: { findMany: jest.fn() },
    openingBalance: { count: jest.fn() },
    inventoryCostLayer: { count: jest.fn() },
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertPermission: jest.fn(),
  getAccessibleBranchIds: jest.fn(),
}));

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const endDate = new Date('2026-08-05T16:59:59.999Z');

describe('finance report batched reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(['branch-a', 'branch-b']);
    (prisma.openingBalance.count as jest.Mock).mockResolvedValue(1);
    (prisma.inventoryCostLayer.count as jest.Mock).mockResolvedValue(0);
  });

  it('memasukkan jurnal reversed bersama reversal entry ke immutable ledger', async () => {
    (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([]);

    await profitLoss('finance-user', {
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate,
    });

    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        journalEntry: expect.objectContaining({ status: { in: ['POSTED', 'REVERSED'] } }),
      }),
    }));
  });

  it('tidak menyamakan persamaan seimbang dengan data opening yang lengkap', async () => {
    (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.openingBalance.count as jest.Mock).mockResolvedValue(0);
    (prisma.inventoryCostLayer.count as jest.Mock).mockResolvedValue(268);

    const result = await financialPosition('finance-user', { endDate });

    expect(result.balanced).toBe(true);
    expect(result.dataQuality).toEqual({
      complete: false,
      postedOpeningBalances: 0,
      pendingInventoryValuations: 268,
      limitations: ['OPENING_BALANCE_MISSING', 'INVENTORY_VALUATION_INCOMPLETE'],
    });
  });

  it('merekonsiliasi banyak akun kas/bank dengan satu query GL dan satu query subledger', async () => {
    (prisma.cashBankAccount.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'cash-a', code: 'BANK-A', name: 'Bank A', type: 'BANK', branchId: 'branch-a', coaAccountId: 'coa-cash',
        coaAccount: { id: 'coa-cash', code: '1100', name: 'Kas Bank' },
        branch: { id: 'branch-a', branchCode: 'A', name: 'Cabang A' },
      },
      {
        id: 'cash-b', code: 'BANK-B', name: 'Bank B', type: 'BANK', branchId: 'branch-b', coaAccountId: 'coa-cash',
        coaAccount: { id: 'coa-cash', code: '1100', name: 'Kas Bank' },
        branch: { id: 'branch-b', branchCode: 'B', name: 'Cabang B' },
      },
    ]);
    (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([
      {
        branchId: 'branch-a', accountId: 'coa-cash', debit: decimal(100), credit: decimal(0),
        account: { code: '1100', name: 'Kas Bank', type: 'ASSET', normalBalance: NormalBalance.DEBIT },
      },
      {
        branchId: 'branch-b', accountId: 'coa-cash', debit: decimal(250), credit: decimal(0),
        account: { code: '1100', name: 'Kas Bank', type: 'ASSET', normalBalance: NormalBalance.DEBIT },
      },
    ]);
    (prisma.cashBankTransaction.findMany as jest.Mock).mockResolvedValue([
      { cashBankAccountId: 'cash-a', type: CashBankTransactionType.RECEIPT, amount: decimal(100) },
      { cashBankAccountId: 'cash-b', type: CashBankTransactionType.RECEIPT, amount: decimal(200) },
    ]);

    const result = await cashBankReport('finance-user', { endDate });

    expect(prisma.journalLine.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.cashBankTransaction.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ account: { code: { in: ['1100'] } } }),
    }));
    expect(result.accounts).toEqual([
      expect.objectContaining({ id: 'cash-a', ledgerBalance: '100.00', subledgerBalance: '100.00', reconciled: true }),
      expect.objectContaining({ id: 'cash-b', ledgerBalance: '250.00', subledgerBalance: '200.00', difference: '50.00', reconciled: false }),
    ]);
    expect(result.reconciled).toBe(false);
  });

  it('membaca seluruh akun deferred revenue dengan satu query GL', async () => {
    (prisma.deferredRevenueMovement.findMany as jest.Mock).mockResolvedValue([
      { type: 'FUNDING', amount: decimal(100), contract: { valuation: { deferredRevenueAccountCode: '2200' } } },
      { type: 'RECOGNITION', amount: decimal(40), contract: { valuation: { deferredRevenueAccountCode: '2200' } } },
      { type: 'FUNDING', amount: decimal(20), contract: { valuation: { deferredRevenueAccountCode: '2210' } } },
    ]);
    (prisma.packageRevenuePolicy.findMany as jest.Mock).mockResolvedValue([
      { deferredRevenueAccount: { code: '2200' } },
      { deferredRevenueAccount: { code: '2210' } },
    ]);
    (prisma.packageBenefitValuation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.journalLine.findMany as jest.Mock).mockResolvedValue([
      {
        branchId: 'branch-a', accountId: 'coa-deferred-basic', debit: decimal(0), credit: decimal(60),
        account: { code: '2200', name: 'Deferred Basic', type: 'LIABILITY', normalBalance: NormalBalance.CREDIT },
      },
      {
        branchId: 'branch-a', accountId: 'coa-deferred-booster', debit: decimal(0), credit: decimal(20),
        account: { code: '2210', name: 'Deferred Booster', type: 'LIABILITY', normalBalance: NormalBalance.CREDIT },
      },
    ]);

    const result = await deferredRevenueReport('finance-user', { endDate });

    expect(prisma.journalLine.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ account: { code: { in: ['2200', '2210'] } } }),
    }));
    expect(result.accounts).toEqual([
      expect.objectContaining({ accountCode: '2200', movementCount: 2, ledgerBalance: '60.00', subledgerBalance: '60.00', reconciled: true }),
      expect.objectContaining({ accountCode: '2210', movementCount: 1, ledgerBalance: '20.00', subledgerBalance: '20.00', reconciled: true }),
    ]);
    expect(result.totalDeferredRevenue).toBe('80.00');
    expect(result.reconciled).toBe(true);
  });

  it('menghitung AR aging dari outstanding subledger dan menyatakan snapshot saat ini', async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'invoice-1', invoiceNumber: 'INV-1', totalAmount: decimal(1000), actualPaidAmount: decimal(250),
        dueDate: new Date('2026-07-01T00:00:00.000+07:00'),
        branch: { id: 'branch-a', branchCode: 'A', name: 'Cabang A' },
        member: { memberNo: 'MEM-1', user: { email: 'member@example.test', profile: { fullName: 'Member One' } } },
      },
    ]);

    const result = await receivableAging('finance-user', { endDate });

    expect(result.source).toBe('CURRENT_OPERATIONAL_SUBLEDGER');
    expect(result.rows[0]).toMatchObject({ documentNumber: 'INV-1', counterpartyName: 'Member One', balance: '750.00', bucket: 'DAYS_31_60' });
    expect(result.totalOutstanding).toBe('750.00');
  });

  it('menghitung AP aging dari balance supplier invoice', async () => {
    (prisma.supplierInvoice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'supplier-invoice-1', invoiceNumber: 'AP-1', supplierInvoiceNumber: 'VENDOR-9', balanceAmount: decimal(400),
        dueDate: new Date('2026-08-01T00:00:00.000+07:00'),
        branch: { id: 'branch-a', branchCode: 'A', name: 'Cabang A' },
        supplier: { code: 'SUP-1', name: 'Supplier One' },
      },
    ]);

    const result = await payableAging('finance-user', { endDate });

    expect(result.rows[0]).toMatchObject({ documentNumber: 'AP-1', externalDocumentNumber: 'VENDOR-9', balance: '400.00', bucket: 'DAYS_1_30' });
    expect(result.totalOutstanding).toBe('400.00');
  });
});
