CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "GoodsReceiptCondition" AS ENUM ('GOOD', 'DAMAGED', 'EXPIRED', 'OTHER');

CREATE TABLE "suppliers" (
  "id" TEXT NOT NULL,
  "supplierCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "suppliers_payment_term_check" CHECK ("paymentTermDays" >= 0)
);

CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "orderDate" TIMESTAMP(3) NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_total_check" CHECK ("totalAmount" >= 0)
);

CREATE TABLE "purchase_order_items" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "masterProductId" TEXT NOT NULL,
  "uomId" TEXT,
  "destinationStockLocationId" TEXT,
  "orderedQty" DECIMAL(18,4) NOT NULL,
  "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_order_items_quantity_check" CHECK (
    "lineNumber" > 0 AND "orderedQty" > 0 AND "receivedQty" >= 0
    AND "receivedQty" <= "orderedQty" AND "unitCost" >= 0
  )
);

CREATE TABLE "goods_receipts" (
  "id" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'POSTED',
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "inventoryPostingId" TEXT NOT NULL,
  "supplierDeliveryNumber" TEXT,
  "totalQuantity" DECIMAL(18,4) NOT NULL,
  "quarantinedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(18,4) NOT NULL,
  "notes" TEXT,
  "receivedBy" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipts_quantity_check" CHECK (
    "totalQuantity" > 0 AND "quarantinedQuantity" >= 0
    AND "quarantinedQuantity" <= "totalQuantity" AND "totalCost" >= 0
  )
);

CREATE TABLE "goods_receipt_items" (
  "id" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "purchaseOrderItemId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "stockLocationId" TEXT NOT NULL,
  "batchId" TEXT,
  "batchKey" TEXT NOT NULL DEFAULT 'NO_BATCH',
  "stockMutationId" TEXT NOT NULL,
  "costLayerId" TEXT NOT NULL,
  "condition" "GoodsReceiptCondition" NOT NULL DEFAULT 'GOOD',
  "quantity" DECIMAL(18,4) NOT NULL,
  "quarantineQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "totalCost" DECIMAL(18,4) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipt_items_quantity_check" CHECK (
    "quantity" > 0 AND "quarantineQty" >= 0 AND "quarantineQty" <= "quantity"
    AND "unitCost" >= 0 AND "totalCost" >= 0
  )
);

CREATE UNIQUE INDEX "suppliers_supplierCode_key" ON "suppliers"("supplierCode");
CREATE INDEX "suppliers_name_isActive_idx" ON "suppliers"("name", "isActive");
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");
CREATE INDEX "purchase_orders_branchId_status_orderDate_idx" ON "purchase_orders"("branchId", "status", "orderDate");
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "purchase_orders"("supplierId", "status");
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_lineNumber_key" ON "purchase_order_items"("purchaseOrderId", "lineNumber");
CREATE INDEX "purchase_order_items_masterProductId_idx" ON "purchase_order_items"("masterProductId");
CREATE INDEX "purchase_order_items_destinationStockLocationId_idx" ON "purchase_order_items"("destinationStockLocationId");
CREATE UNIQUE INDEX "goods_receipts_receiptNumber_key" ON "goods_receipts"("receiptNumber");
CREATE UNIQUE INDEX "goods_receipts_idempotencyKey_key" ON "goods_receipts"("idempotencyKey");
CREATE UNIQUE INDEX "goods_receipts_inventoryPostingId_key" ON "goods_receipts"("inventoryPostingId");
CREATE INDEX "goods_receipts_branchId_receivedAt_idx" ON "goods_receipts"("branchId", "receivedAt");
CREATE INDEX "goods_receipts_purchaseOrderId_receivedAt_idx" ON "goods_receipts"("purchaseOrderId", "receivedAt");
CREATE UNIQUE INDEX "goods_receipt_items_stockMutationId_key" ON "goods_receipt_items"("stockMutationId");
CREATE UNIQUE INDEX "goods_receipt_items_costLayerId_key" ON "goods_receipt_items"("costLayerId");
CREATE UNIQUE INDEX "goods_receipt_items_receipt_order_item_location_batch_condition_key"
  ON "goods_receipt_items"("goodsReceiptId", "purchaseOrderItemId", "stockLocationId", "batchKey", "condition");
CREATE INDEX "goods_receipt_items_purchaseOrderItemId_idx" ON "goods_receipt_items"("purchaseOrderItemId");
CREATE INDEX "goods_receipt_items_inventoryBalanceId_idx" ON "goods_receipt_items"("inventoryBalanceId");
CREATE INDEX "goods_receipt_items_batchId_idx" ON "goods_receipt_items"("batchId");

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_masterProductId_fkey"
  FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_uomId_fkey"
  FOREIGN KEY ("uomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_destinationStockLocationId_fkey"
  FOREIGN KEY ("destinationStockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_inventoryPostingId_fkey"
  FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey"
  FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey"
  FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_inventoryBalanceId_fkey"
  FOREIGN KEY ("inventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_stockLocationId_fkey"
  FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_stockMutationId_fkey"
  FOREIGN KEY ("stockMutationId") REFERENCES "stock_mutations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_costLayerId_fkey"
  FOREIGN KEY ("costLayerId") REFERENCES "inventory_cost_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_purchasing_po_read', 'PURCHASING.PO.READ', 'Lihat Purchase Order', 'PURCHASING', 'Melihat purchase order sesuai branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_purchasing_gr_read', 'PURCHASING.GOODS_RECEIPT.READ', 'Lihat Goods Receipt', 'PURCHASING', 'Melihat goods receipt dan cost layer pembelian.', false, CURRENT_TIMESTAMP),
  ('perm_purchasing_gr_post', 'PURCHASING.GOODS_RECEIPT.POST', 'Posting Goods Receipt', 'PURCHASING', 'Memposting penerimaan parsial dari PO ke inventory.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s6_super_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p
WHERE p."code" IN ('PURCHASING.PO.READ', 'PURCHASING.GOODS_RECEIPT.READ', 'PURCHASING.GOODS_RECEIPT.POST')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s6_manager_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p
WHERE p."code" IN ('PURCHASING.PO.READ', 'PURCHASING.GOODS_RECEIPT.READ', 'PURCHASING.GOODS_RECEIPT.POST')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s6_logistik_' || p."id", 'rt_admin_logistik', p."id" FROM "permissions" p
WHERE p."code" IN ('PURCHASING.PO.READ', 'PURCHASING.GOODS_RECEIPT.READ', 'PURCHASING.GOODS_RECEIPT.POST')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s6_cabang_' || p."id", 'rt_admin_cabang', p."id" FROM "permissions" p
WHERE p."code" IN ('PURCHASING.PO.READ', 'PURCHASING.GOODS_RECEIPT.READ', 'PURCHASING.GOODS_RECEIPT.POST')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
