ALTER TYPE "StockMutationType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "StockMutationType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "InventoryPostingType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "InventoryPostingType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "StockReservationStatus" ADD VALUE IF NOT EXISTS 'CONSUMED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED';

CREATE TYPE "ShipmentDiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "stock_reservations"
  ADD COLUMN "consumedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "consumedBy" TEXT,
  ADD COLUMN "consumedAt" TIMESTAMP(3);

ALTER TABLE "shipments"
  ADD COLUMN "shipIdempotencyKey" TEXT,
  ADD COLUMN "shipPayloadHash" TEXT;

ALTER TABLE "shipment_items"
  ADD COLUMN "quarantineQty" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "shipment_items"
  ALTER COLUMN "sentQty" TYPE DECIMAL(18,4),
  ALTER COLUMN "receivedQty" TYPE DECIMAL(18,4),
  ALTER COLUMN "quarantineQty" TYPE DECIMAL(18,4),
  ALTER COLUMN "requestedQty" TYPE DECIMAL(18,4),
  ALTER COLUMN "overstockQty" TYPE DECIMAL(18,4);

ALTER TABLE "shipment_discrepancies"
  ADD COLUMN "shipmentReceiptId" TEXT,
  ADD COLUMN "quarantinedQty" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ShipmentDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "resolvedBy" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionNotes" TEXT;

ALTER TABLE "shipment_discrepancies"
  ALTER COLUMN "expectedQty" TYPE DECIMAL(18,4),
  ALTER COLUMN "receivedQty" TYPE DECIMAL(18,4),
  ALTER COLUMN "quarantinedQty" TYPE DECIMAL(18,4);

CREATE TABLE "shipment_transfer_layers" (
  "id" TEXT NOT NULL,
  "shipmentItemId" TEXT NOT NULL,
  "sourceCostLayerId" TEXT NOT NULL,
  "sourceInventoryBalanceId" TEXT NOT NULL,
  "batchId" TEXT,
  "shippedQty" DECIMAL(18,4) NOT NULL,
  "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "totalCost" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipment_transfer_layers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_transfer_layers_quantity_check" CHECK (
    "shippedQty" > 0 AND "receivedQty" >= 0 AND "receivedQty" <= "shippedQty" AND "unitCost" >= 0
  )
);

CREATE TABLE "shipment_receipts" (
  "id" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "inventoryPostingId" TEXT NOT NULL,
  "isFinal" BOOLEAN NOT NULL DEFAULT false,
  "totalQuantity" DECIMAL(18,4) NOT NULL,
  "quarantinedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(18,4) NOT NULL,
  "evidenceFileUrl" TEXT,
  "evidenceFileName" TEXT,
  "evidenceFileSize" INTEGER,
  "evidenceMimeType" TEXT,
  "evidenceChecksum" TEXT,
  "notes" TEXT,
  "receivedBy" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipment_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_receipts_quantity_check" CHECK (
    "totalQuantity" >= 0 AND "quarantinedQuantity" >= 0 AND "quarantinedQuantity" <= "totalQuantity" AND "totalCost" >= 0
  )
);

CREATE TABLE "shipment_receipt_items" (
  "id" TEXT NOT NULL,
  "shipmentReceiptId" TEXT NOT NULL,
  "shipmentItemId" TEXT NOT NULL,
  "transferLayerId" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "receivedQty" DECIMAL(18,4) NOT NULL,
  "quarantineQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "totalCost" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipment_receipt_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipment_receipt_items_quantity_check" CHECK (
    "receivedQty" > 0 AND "quarantineQty" >= 0 AND "quarantineQty" <= "receivedQty" AND "unitCost" >= 0
  )
);

CREATE UNIQUE INDEX "shipments_shipIdempotencyKey_key" ON "shipments"("shipIdempotencyKey");
CREATE INDEX "shipment_discrepancies_shipmentReceiptId_idx" ON "shipment_discrepancies"("shipmentReceiptId");
CREATE INDEX "shipment_discrepancies_shipmentId_status_idx" ON "shipment_discrepancies"("shipmentId", "status");
CREATE UNIQUE INDEX "shipment_transfer_layers_shipmentItemId_sourceCostLayerId_key" ON "shipment_transfer_layers"("shipmentItemId", "sourceCostLayerId");
CREATE INDEX "shipment_transfer_layers_sourceInventoryBalanceId_idx" ON "shipment_transfer_layers"("sourceInventoryBalanceId");
CREATE INDEX "shipment_transfer_layers_shipmentItemId_receivedQty_idx" ON "shipment_transfer_layers"("shipmentItemId", "receivedQty");
CREATE UNIQUE INDEX "shipment_receipts_receiptNumber_key" ON "shipment_receipts"("receiptNumber");
CREATE UNIQUE INDEX "shipment_receipts_idempotencyKey_key" ON "shipment_receipts"("idempotencyKey");
CREATE UNIQUE INDEX "shipment_receipts_inventoryPostingId_key" ON "shipment_receipts"("inventoryPostingId");
CREATE INDEX "shipment_receipts_shipmentId_receivedAt_idx" ON "shipment_receipts"("shipmentId", "receivedAt");
CREATE UNIQUE INDEX "shipment_receipt_items_receipt_item_layer_key" ON "shipment_receipt_items"("shipmentReceiptId", "shipmentItemId", "transferLayerId");
CREATE INDEX "shipment_receipt_items_shipmentItemId_idx" ON "shipment_receipt_items"("shipmentItemId");
CREATE INDEX "shipment_receipt_items_inventoryBalanceId_idx" ON "shipment_receipt_items"("inventoryBalanceId");

ALTER TABLE "shipment_discrepancies" ADD CONSTRAINT "shipment_discrepancies_shipmentReceiptId_fkey"
  FOREIGN KEY ("shipmentReceiptId") REFERENCES "shipment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_transfer_layers" ADD CONSTRAINT "shipment_transfer_layers_shipmentItemId_fkey"
  FOREIGN KEY ("shipmentItemId") REFERENCES "shipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_transfer_layers" ADD CONSTRAINT "shipment_transfer_layers_sourceCostLayerId_fkey"
  FOREIGN KEY ("sourceCostLayerId") REFERENCES "inventory_cost_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_transfer_layers" ADD CONSTRAINT "shipment_transfer_layers_sourceInventoryBalanceId_fkey"
  FOREIGN KEY ("sourceInventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_transfer_layers" ADD CONSTRAINT "shipment_transfer_layers_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_receipts" ADD CONSTRAINT "shipment_receipts_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_receipts" ADD CONSTRAINT "shipment_receipts_inventoryPostingId_fkey"
  FOREIGN KEY ("inventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_receipt_items" ADD CONSTRAINT "shipment_receipt_items_shipmentReceiptId_fkey"
  FOREIGN KEY ("shipmentReceiptId") REFERENCES "shipment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_receipt_items" ADD CONSTRAINT "shipment_receipt_items_shipmentItemId_fkey"
  FOREIGN KEY ("shipmentItemId") REFERENCES "shipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_receipt_items" ADD CONSTRAINT "shipment_receipt_items_transferLayerId_fkey"
  FOREIGN KEY ("transferLayerId") REFERENCES "shipment_transfer_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_receipt_items" ADD CONSTRAINT "shipment_receipt_items_inventoryBalanceId_fkey"
  FOREIGN KEY ("inventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_quantity_buckets_check" CHECK (
  "onHandQty" >= 0 AND "reservedQty" >= 0 AND "quarantineQty" >= 0 AND "inTransitQty" >= 0
  AND "reservedQty" + "quarantineQty" <= "onHandQty"
);

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_inventory_shipment_read', 'INVENTORY.SHIPMENT.READ', 'Lihat Shipment', 'INVENTORY', 'Melihat shipment, receipt, dan discrepancy sesuai branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_inventory_shipment_dispatch', 'INVENTORY.SHIPMENT.DISPATCH', 'Dispatch Shipment', 'INVENTORY', 'Memindahkan reserved stock ke in-transit secara idempotent.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_shipment_receive', 'INVENTORY.SHIPMENT.RECEIVE', 'Receive Shipment', 'INVENTORY', 'Menerima shipment penuh atau parsial ke inventory tujuan.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_discrepancy_read', 'INVENTORY.DISCREPANCY.READ', 'Lihat Discrepancy', 'INVENTORY', 'Melihat discrepancy dan quarantine shipment.', false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s5_super_' || p."id", 'rt_super_admin', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.SHIPMENT.READ','INVENTORY.SHIPMENT.DISPATCH','INVENTORY.SHIPMENT.RECEIVE','INVENTORY.DISCREPANCY.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s5_manager_' || p."id", 'rt_admin_manager', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.SHIPMENT.READ','INVENTORY.SHIPMENT.DISPATCH','INVENTORY.SHIPMENT.RECEIVE','INVENTORY.DISCREPANCY.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s5_logistik_' || p."id", 'rt_admin_logistik', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.SHIPMENT.READ','INVENTORY.SHIPMENT.DISPATCH','INVENTORY.SHIPMENT.RECEIVE','INVENTORY.DISCREPANCY.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s5_cabang_' || p."id", 'rt_admin_cabang', p."id" FROM "permissions" p
WHERE p."code" IN ('INVENTORY.SHIPMENT.READ','INVENTORY.SHIPMENT.RECEIVE','INVENTORY.DISCREPANCY.READ')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
