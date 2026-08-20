import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiRoot = resolve(__dirname, '../../../..');

describe('Finance & Logistics Controller contract', () => {
  it('merges the seeded Finance and Logistics accounts without deleting history', () => {
    const seed = readFileSync(resolve(apiRoot, 'prisma/seeds/users.seed.ts'), 'utf8');
    const migration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260820120000_merge_finance_logistics_access/migration.sql',
    ), 'utf8');

    expect(seed).toContain("const FINANCE_LOGISTICS_EMAIL = 'finance@raho.id'");
    expect(seed).toContain("password: 'Finance@123'");
    expect(seed).not.toContain("password: 'AdminLogistik@123'");
    expect(seed).toContain('data: { isActive: false }');
    expect(migration).toContain("finance.\"email\" = 'finance@raho.id'");
    expect(migration).toContain("WHERE \"email\" = 'adminlogistik@raho.id'");
    expect(migration).not.toContain('DELETE FROM "users"');
  });

  it('inherits manager, finance, and logistics permissions but keeps shipment dispatch-only', () => {
    const migration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260820120000_merge_finance_logistics_access/migration.sql',
    ), 'utf8');
    const shipmentService = readFileSync(resolve(
      apiRoot,
      'src/modules/inventory/shipment.service.ts',
    ), 'utf8');
    const shipmentPage = readFileSync(resolve(
      apiRoot,
      '../web/src/app/(staff)/inventory/shipments/page.tsx',
    ), 'utf8');
    const shipmentModal = readFileSync(resolve(
      apiRoot,
      '../web/src/app/(staff)/inventory/shipments/components/ShipModal.tsx',
    ), 'utf8');

    expect(migration).toContain("'ADMIN_MANAGER_DEFAULT'");
    expect(migration).toContain("'ADMIN_LOGISTIK_DEFAULT'");
    expect(migration).toContain("'INVENTORY.SHIPMENT.DISPATCH'");
    expect(migration).toContain("'TREATMENT.COMPLETION.REVERSE'");
    expect(migration).toContain("permission.\"code\" = 'INVENTORY.SHIPMENT.RECEIVE'");
    expect(shipmentService).toContain('FINANCE_LOGISTICS_DISPATCH_ONLY');
    expect(shipmentService).toContain("await assertNotDispatchOnlyController(userId, 'menerima barang')");
    expect(shipmentService).toContain('const dispatchData = dispatchOnly');
    expect(shipmentPage).toContain("user?.roleTemplateName === 'Finance & Logistics Controller'");
    expect(shipmentModal).toContain('? { idempotencyKey }');
  });

  it('adds the role and its branch-scoped read/control permissions', () => {
    const roleMigration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260728100000_add_finance_logistics_controller_role/migration.sql',
    ), 'utf8');
    const permissionMigration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260728101000_seed_finance_logistics_controller_permissions/migration.sql',
    ), 'utf8');

    expect(roleMigration).toContain("'FINANCE_LOGISTICS_CONTROLLER'");
    expect(permissionMigration).toContain("'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'");
    expect(permissionMigration).toContain("'INVENTORY.SHIPMENT.DISPATCH'");
    expect(permissionMigration).toContain("'AP.READ'");
    expect(permissionMigration).toContain("'ZOHO.SYNC.RETRY'");
    const assignedPermissions = permissionMigration.slice(
      permissionMigration.indexOf('WHERE p."code" IN'),
    );
    expect(assignedPermissions).not.toContain("'ZOHO.CONNECTION.MANAGE'");
  });

  it('keeps maker-checker enforcement in the approval engine', () => {
    const approvalService = readFileSync(resolve(
      apiRoot,
      'src/modules/workflow/approval.service.ts',
    ), 'utf8');

    expect(approvalService).toContain('instance.makerUserId === input.actorUserId');
    expect(approvalService).toContain('Maker tidak boleh memutuskan dokumennya sendiri.');
  });

  it('enforces branch scope and payment maker-checker in the Partnership stock flow', () => {
    const stockApproval = readFileSync(resolve(
      apiRoot,
      'src/modules/inventory/services/stock-request-approval.service.ts',
    ), 'utf8');

    expect(stockApproval).toContain('Role.FINANCE_LOGISTICS_CONTROLLER');
    expect(stockApproval).toContain('await assertBranchAccess(userId, branchId)');
    expect(stockApproval).toContain('PAYMENT_MAKER_CHECKER_REQUIRED');
    expect(stockApproval).toContain('request.paymentUploadedBy === userId');
  });

  it('registers idempotent Partnership shipment and advance handlers', () => {
    const handlers = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.handlers.ts',
    ), 'utf8');
    const routes = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.routes.ts',
    ), 'utf8');

    expect(handlers).toContain('handlePartnershipGoodsShipped');
    expect(handlers).toContain('handlePartnershipPaymentVerified');
    expect(routes).toContain("'/partnership-sales/:id/preview'");
    expect(routes).toContain("'/partnership-sales/reconcile/run'");
  });

  it('creates and cancels Purchase Orders through atomic Zoho outbox events', () => {
    const purchasingService = readFileSync(resolve(
      apiRoot,
      'src/modules/purchasing/purchasing.service.ts',
    ), 'utf8');
    const handlers = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.handlers.ts',
    ), 'utf8');
    const routes = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.routes.ts',
    ), 'utf8');

    expect(purchasingService).toContain('enqueuePurchaseOrderIssuedTx');
    expect(purchasingService).toContain('enqueuePurchaseOrderCancelledTx');
    expect(purchasingService).toContain('PurchaseOrderStatus.CANCELLED');
    expect(purchasingService).not.toContain('purchaseOrder.delete');
    const purchaseOrderService = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.purchase-order.service.ts',
    ), 'utf8');
    expect(purchaseOrderService).toContain('ZOHO_PO_ISSUE_STILL_PROCESSING');
    expect(purchaseOrderService).toContain('IntegrationEventStatus.PROCESSING');
    expect(handlers).toContain('PO_ISSUED_EVENT');
    expect(handlers).toContain('PO_CANCELLED_EVENT');
    expect(routes).toContain("'/purchase-orders/:id/preview'");
    expect(routes).toContain("'/purchase-orders/reconcile/run'");
  });

  it('posts quantity-safe supplier invoices and syncs one PO-linked Zoho Bill', () => {
    const purchasingService = readFileSync(resolve(
      apiRoot,
      'src/modules/purchasing/purchasing.service.ts',
    ), 'utf8');
    const purchasingHelpers = readFileSync(resolve(
      apiRoot,
      'src/modules/purchasing/purchasing.helpers.ts',
    ), 'utf8');
    const billService = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.bill.service.ts',
    ), 'utf8');
    const billPolicy = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.bill.policy.ts',
    ), 'utf8');
    const worker = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.worker.ts',
    ), 'utf8');
    const routes = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.routes.ts',
    ), 'utf8');
    const migration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260729130000_add_supplier_invoice_lines/migration.sql',
    ), 'utf8');

    expect(purchasingHelpers).toContain('SUPPLIER_INVOICE_EXCEEDS_RECEIVED_QUANTITY');
    expect(purchasingService).toContain('enqueueSupplierInvoicePostedTx');
    expect(purchasingService).toContain('supplierInvoiceLine.groupBy');
    expect(billPolicy).toContain('purchaseorder_item_id');
    expect(billService).not.toContain('inventoryAdjustment');
    expect(worker).toContain("'SUPPLIER_INVOICE_POSTED'");
    expect(worker).not.toContain("'GOODS_RECEIPT'");
    expect(routes).toContain("'/grni'");
    expect(routes).toContain("'/bills/reconcile/run'");
    expect(migration).toContain('supplier_invoice_lines_quantity_check');
    expect(migration).toContain('ON DELETE CASCADE');
  });

  it('posts one idempotent Vendor Payment applied to the mapped Zoho Bill', () => {
    const purchasingService = readFileSync(resolve(
      apiRoot,
      'src/modules/purchasing/purchasing.service.ts',
    ), 'utf8');
    const vendorPaymentService = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.vendor-payment.service.ts',
    ), 'utf8');
    const worker = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.worker.ts',
    ), 'utf8');
    const routes = readFileSync(resolve(
      apiRoot,
      'src/modules/zoho/zoho.routes.ts',
    ), 'utf8');

    expect(purchasingService).toContain('enqueueSupplierPaymentPostedTx');
    expect(purchasingService).toContain('enqueueSupplierPaymentRefundedTx');
    expect(vendorPaymentService).toContain("'/books/v3/vendorpayments'");
    expect(vendorPaymentService).toContain("'SUPPLIER_INVOICE'");
    expect(vendorPaymentService).toContain("'CASH_BANK_ACCOUNT'");
    expect(vendorPaymentService).toContain('RECOVER_EXISTING');
    expect(worker).toContain("'AP_PAYMENT_POSTED'");
    expect(worker).toContain("'AP_PAYMENT_REFUNDED'");
    expect(routes).toContain("'/vendor-payments/reconcile/run'");
  });
});
