CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('POSTED', 'PARTIALLY_PAID', 'PAID');

CREATE TABLE "suppliers" (
  "id" TEXT PRIMARY KEY, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "taxId" TEXT,
  "contactName" TEXT, "phone" TEXT, "email" TEXT, "address" TEXT,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30, "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_terms_check" CHECK ("paymentTermsDays" BETWEEN 0 AND 365)
);
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");
CREATE INDEX "suppliers_status_name_idx" ON "suppliers"("status", "name");

CREATE TABLE "purchase_requests" (
  "id" TEXT PRIMARY KEY, "requestNumber" TEXT NOT NULL, "postingKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "branchId" TEXT NOT NULL, "requestDate" TIMESTAMP(3) NOT NULL, "requiredDate" TIMESTAMP(3), "description" TEXT NOT NULL,
  "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT', "approvalNote" TEXT, "rejectionReason" TEXT,
  "createdBy" TEXT NOT NULL, "submittedAt" TIMESTAMP(3), "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_requests_maker_checker_check" CHECK ("reviewedBy" IS NULL OR "reviewedBy" <> "createdBy")
);
CREATE UNIQUE INDEX "purchase_requests_requestNumber_key" ON "purchase_requests"("requestNumber");
CREATE UNIQUE INDEX "purchase_requests_postingKey_key" ON "purchase_requests"("postingKey");
CREATE INDEX "purchase_requests_branchId_requestDate_idx" ON "purchase_requests"("branchId", "requestDate");
CREATE INDEX "purchase_requests_status_createdAt_idx" ON "purchase_requests"("status", "createdAt");

CREATE TABLE "purchase_request_items" (
  "id" TEXT PRIMARY KEY, "purchaseRequestId" TEXT NOT NULL, "lineNo" INTEGER NOT NULL, "masterProductId" TEXT NOT NULL,
  "description" TEXT NOT NULL, "requestedQty" DECIMAL(18,4) NOT NULL, "approvedQty" DECIMAL(18,4),
  "estimatedUnitCost" DECIMAL(18,4) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_request_items_quantity_check" CHECK ("requestedQty" > 0 AND "estimatedUnitCost" >= 0 AND ("approvedQty" IS NULL OR ("approvedQty" >= 0 AND "approvedQty" <= "requestedQty")))
);
CREATE UNIQUE INDEX "purchase_request_items_purchaseRequestId_lineNo_key" ON "purchase_request_items"("purchaseRequestId", "lineNo");
CREATE INDEX "purchase_request_items_masterProductId_idx" ON "purchase_request_items"("masterProductId");

CREATE TABLE "purchase_orders" (
  "id" TEXT PRIMARY KEY, "poNumber" TEXT NOT NULL, "postingKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "purchaseRequestId" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "orderDate" TIMESTAMP(3) NOT NULL,
  "expectedDate" TIMESTAMP(3), "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'ISSUED', "currency" TEXT NOT NULL DEFAULT 'IDR',
  "totalAmount" DECIMAL(18,2) NOT NULL, "notes" TEXT, "createdBy" TEXT NOT NULL, "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_amount_check" CHECK ("totalAmount" > 0), CONSTRAINT "purchase_orders_currency_check" CHECK ("currency" = 'IDR')
);
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");
CREATE UNIQUE INDEX "purchase_orders_postingKey_key" ON "purchase_orders"("postingKey");
CREATE UNIQUE INDEX "purchase_orders_purchaseRequestId_key" ON "purchase_orders"("purchaseRequestId");
CREATE INDEX "purchase_orders_branchId_orderDate_idx" ON "purchase_orders"("branchId", "orderDate");
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "purchase_orders"("supplierId", "status");

CREATE TABLE "purchase_order_items" (
  "id" TEXT PRIMARY KEY, "purchaseOrderId" TEXT NOT NULL, "lineNo" INTEGER NOT NULL, "masterProductId" TEXT NOT NULL,
  "skuSnapshot" TEXT, "nameSnapshot" TEXT NOT NULL, "uomSnapshot" TEXT NOT NULL,
  "orderedQty" DECIMAL(18,4) NOT NULL, "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(18,4) NOT NULL, "lineTotal" DECIMAL(18,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_items_quantity_check" CHECK ("orderedQty" > 0 AND "receivedQty" >= 0 AND "receivedQty" <= "orderedQty"),
  CONSTRAINT "purchase_order_items_value_check" CHECK ("unitPrice" >= 0 AND "lineTotal" = "orderedQty" * "unitPrice" AND ROUND("orderedQty" * "unitPrice", 2) = "orderedQty" * "unitPrice")
);
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_lineNo_key" ON "purchase_order_items"("purchaseOrderId", "lineNo");
CREATE INDEX "purchase_order_items_masterProductId_idx" ON "purchase_order_items"("masterProductId");

CREATE TABLE "goods_receipts" (
  "id" TEXT PRIMARY KEY, "receiptNumber" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "receiptDate" TIMESTAMP(3) NOT NULL, "totalValue" DECIMAL(18,2) NOT NULL,
  "journalEntryId" TEXT NOT NULL, "evidenceReference" TEXT, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipts_value_check" CHECK ("totalValue" > 0)
);
CREATE UNIQUE INDEX "goods_receipts_receiptNumber_key" ON "goods_receipts"("receiptNumber");
CREATE UNIQUE INDEX "goods_receipts_idempotencyKey_key" ON "goods_receipts"("idempotencyKey");
CREATE UNIQUE INDEX "goods_receipts_journalEntryId_key" ON "goods_receipts"("journalEntryId");
CREATE INDEX "goods_receipts_purchaseOrderId_receiptDate_idx" ON "goods_receipts"("purchaseOrderId", "receiptDate");
CREATE INDEX "goods_receipts_branchId_receiptDate_idx" ON "goods_receipts"("branchId", "receiptDate");

CREATE TABLE "goods_receipt_lines" (
  "id" TEXT PRIMARY KEY, "goodsReceiptId" TEXT NOT NULL, "purchaseOrderItemId" TEXT NOT NULL, "lineNo" INTEGER NOT NULL,
  "inventoryItemId" TEXT NOT NULL, "stockLocationId" TEXT NOT NULL, "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL, "lineValue" DECIMAL(18,2) NOT NULL, "batchNumber" TEXT,
  "manufactureDate" TIMESTAMP(3), "expiryDate" TIMESTAMP(3), "inventoryPostingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipt_lines_value_check" CHECK ("quantity" > 0 AND "unitCost" >= 0 AND "lineValue" = "quantity" * "unitCost" AND ROUND("quantity" * "unitCost", 2) = "quantity" * "unitCost")
);
CREATE UNIQUE INDEX "goods_receipt_lines_goodsReceiptId_lineNo_key" ON "goods_receipt_lines"("goodsReceiptId", "lineNo");
CREATE UNIQUE INDEX "goods_receipt_lines_inventoryPostingId_key" ON "goods_receipt_lines"("inventoryPostingId");
CREATE INDEX "goods_receipt_lines_purchaseOrderItemId_idx" ON "goods_receipt_lines"("purchaseOrderItemId");

CREATE TABLE "supplier_invoices" (
  "id" TEXT PRIMARY KEY, "invoiceNumber" TEXT NOT NULL, "supplierInvoiceNumber" TEXT NOT NULL, "postingKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "invoiceDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "balanceAmount" DECIMAL(18,2) NOT NULL,
  "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'POSTED', "grniAccountId" TEXT NOT NULL, "apAccountId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL, "evidenceReference" TEXT, "createdBy" TEXT NOT NULL, "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_invoices_balance_check" CHECK ("amount" > 0 AND "paidAmount" >= 0 AND "balanceAmount" >= 0 AND "paidAmount" + "balanceAmount" = "amount")
);
CREATE UNIQUE INDEX "supplier_invoices_invoiceNumber_key" ON "supplier_invoices"("invoiceNumber");
CREATE UNIQUE INDEX "supplier_invoices_postingKey_key" ON "supplier_invoices"("postingKey");
CREATE UNIQUE INDEX "supplier_invoices_journalEntryId_key" ON "supplier_invoices"("journalEntryId");
CREATE UNIQUE INDEX "supplier_invoices_supplierId_supplierInvoiceNumber_key" ON "supplier_invoices"("supplierId", "supplierInvoiceNumber");
CREATE INDEX "supplier_invoices_branchId_dueDate_status_idx" ON "supplier_invoices"("branchId", "dueDate", "status");
CREATE INDEX "supplier_invoices_purchaseOrderId_invoiceDate_idx" ON "supplier_invoices"("purchaseOrderId", "invoiceDate");

CREATE TABLE "supplier_payments" (
  "id" TEXT PRIMARY KEY, "paymentNumber" TEXT NOT NULL, "postingKey" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL, "cashBankAccountId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "paymentDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "paymentReference" TEXT NOT NULL, "journalEntryId" TEXT NOT NULL, "cashBankTransactionId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL, "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payments_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "supplier_payments_paymentNumber_key" ON "supplier_payments"("paymentNumber");
CREATE UNIQUE INDEX "supplier_payments_postingKey_key" ON "supplier_payments"("postingKey");
CREATE UNIQUE INDEX "supplier_payments_journalEntryId_key" ON "supplier_payments"("journalEntryId");
CREATE UNIQUE INDEX "supplier_payments_cashBankTransactionId_key" ON "supplier_payments"("cashBankTransactionId");
CREATE INDEX "supplier_payments_supplierInvoiceId_paymentDate_idx" ON "supplier_payments"("supplierInvoiceId", "paymentDate");
CREATE INDEX "supplier_payments_branchId_paymentDate_idx" ON "supplier_payments"("branchId", "paymentDate");

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_inventoryPostingId_fkey" FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_grniAccountId_fkey" FOREIGN KEY ("grniAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_apAccountId_fkey" FOREIGN KEY ("apAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_cashBankTransactionId_fkey" FOREIGN KEY ("cashBankTransactionId") REFERENCES "cash_bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "accounts" ("id", "code", "name", "type", "normalBalance", "parentId", "level", "allowPosting", "isControl", "description", "updatedAt")
VALUES ('coa_2110', '2110', 'Goods Received Not Invoiced', 'LIABILITY', 'CREDIT', 'coa_2000', 2, true, true, 'Clearing receipt barang sebelum invoice supplier.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
 ('perm_supplier_read','SUPPLIER.READ','Lihat Supplier','PURCHASING','Melihat master supplier.',false,CURRENT_TIMESTAMP),
 ('perm_supplier_manage','SUPPLIER.MANAGE','Kelola Supplier','PURCHASING','Membuat dan mengubah supplier.',true,CURRENT_TIMESTAMP),
 ('perm_pr_read','PURCHASE_REQUEST.READ','Lihat Purchase Request','PURCHASING','Melihat PR dalam branch scope.',false,CURRENT_TIMESTAMP),
 ('perm_pr_create','PURCHASE_REQUEST.CREATE','Buat Purchase Request','PURCHASING','Membuat dan submit PR.',true,CURRENT_TIMESTAMP),
 ('perm_pr_approve','PURCHASE_REQUEST.APPROVE','Approve Purchase Request','PURCHASING','Maker-checker PR.',true,CURRENT_TIMESTAMP),
 ('perm_po_read','PURCHASE_ORDER.READ','Lihat Purchase Order','PURCHASING','Melihat PO dalam branch scope.',false,CURRENT_TIMESTAMP),
 ('perm_po_create','PURCHASE_ORDER.CREATE','Buat Purchase Order','PURCHASING','Konversi approved PR menjadi PO.',true,CURRENT_TIMESTAMP),
 ('perm_gr_read','GOODS_RECEIPT.READ','Lihat Goods Receipt','PURCHASING','Melihat penerimaan pembelian.',false,CURRENT_TIMESTAMP),
 ('perm_gr_post','GOODS_RECEIPT.POST','Posting Goods Receipt','PURCHASING','Posting receipt, FIFO layer, dan GRNI.',true,CURRENT_TIMESTAMP),
 ('perm_ap_read','AP.READ','Lihat Accounts Payable','ACCOUNTS_PAYABLE','Melihat invoice dan saldo AP.',false,CURRENT_TIMESTAMP),
 ('perm_ap_invoice','AP.INVOICE.POST','Posting Supplier Invoice','ACCOUNTS_PAYABLE','Posting invoice supplier dari GRNI ke AP.',true,CURRENT_TIMESTAMP),
 ('perm_ap_pay','AP.PAY','Bayar Supplier','ACCOUNTS_PAYABLE','Posting pembayaran parsial atau penuh supplier.',true,CURRENT_TIMESTAMP);

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_super_s6_' || "id", 'rt_super_admin', "id" FROM "permissions" WHERE "module" IN ('PURCHASING','ACCOUNTS_PAYABLE');
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_manager_s6_' || "id", 'rt_admin_manager', "id" FROM "permissions" WHERE "module" IN ('PURCHASING','ACCOUNTS_PAYABLE');
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_logistik_s6_' || "id", 'rt_admin_logistik', "id" FROM "permissions" WHERE "code" IN ('SUPPLIER.READ','PURCHASE_REQUEST.READ','PURCHASE_REQUEST.CREATE','PURCHASE_ORDER.READ','GOODS_RECEIPT.READ','GOODS_RECEIPT.POST');
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_cabang_s6_' || "id", 'rt_admin_cabang', "id" FROM "permissions" WHERE "code" IN ('SUPPLIER.READ','PURCHASE_REQUEST.READ','PURCHASE_REQUEST.CREATE','PURCHASE_ORDER.READ','GOODS_RECEIPT.READ','AP.READ');
