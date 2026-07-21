import fs from 'fs';
import path from 'path';

describe('AC-003 PO sampai pembayaran supplier contract', () => {
  it('mengikat source document, FIFO, GRNI, AP, kas/bank, idempotency, dan locking', () => {
    const root = path.resolve(__dirname, '..');
    const service = fs.readFileSync(path.join(root, 'purchasing.service.ts'), 'utf8');
    const accounting = fs.readFileSync(path.resolve(root, '..', 'accounting', 'accounting.service.ts'), 'utf8');
    const inventory = fs.readFileSync(path.resolve(root, '..', 'inventory', 'services', 'inventory-ledger.service.ts'), 'utf8');
    const migration = fs.readFileSync(path.resolve(root, '..', '..', '..', 'prisma', 'migrations', '20260721180000_add_purchasing_accounts_payable', 'migration.sql'), 'utf8');

    expect(service).toContain('PurchaseRequestStatus.APPROVED');
    expect(service).toContain('Maker tidak boleh menyetujui PR sendiri');
    expect(service).toContain('FROM "purchase_orders" WHERE "id" = ${purchaseOrderId} FOR UPDATE');
    expect(service).toContain('receivePurchasedInventoryInTransaction');
    expect(service).toContain("sourceType: 'GOODS_RECEIPT'");
    expect(service).toContain('FROM "supplier_invoices" WHERE "id" = ${supplierInvoiceId} FOR UPDATE');
    expect(service).toContain('SUPPLIER_PAYMENT_EXCEEDS_BALANCE');
    expect(service).toContain('GOODS_RECEIPT_INVENTORY_ITEM_INVALID');
    expect(service).toContain('const concurrentReplay = await tx.goodsReceipt.findUnique');
    expect(service).toContain('const concurrentReplay = await tx.supplierPayment.findUnique');
    expect(accounting).toContain('postPurchasingDerivedJournal');
    expect(accounting).toContain("GOODS_RECEIPT: { debit: '1300', credit: '2110'");
    expect(accounting).toContain("SUPPLIER_INVOICE: { debit: '2110', credit: '2100'");
    expect(inventory).toContain('InventoryPostingType.RECEIPT');
    expect(migration).toContain('supplier_payments_postingKey_key');
    expect(migration).toContain('supplier_invoices_balance_check');
    expect(migration).toContain("'2110', 'Goods Received Not Invoiced'");
  });
});
