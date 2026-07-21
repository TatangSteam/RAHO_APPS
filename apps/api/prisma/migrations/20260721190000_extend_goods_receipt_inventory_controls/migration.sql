CREATE TYPE "GoodsReceiptStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "GoodsReceiptCondition" AS ENUM ('GOOD', 'DAMAGED', 'EXPIRED', 'OTHER');

ALTER TABLE "purchase_order_items"
  ADD COLUMN "uomId" TEXT,
  ADD COLUMN "destinationStockLocationId" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "purchase_order_items"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "purchase_order_items"
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "goods_receipts"
  ADD COLUMN "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'POSTED',
  ADD COLUMN "totalQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "quarantinedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "inventoryPostingId" TEXT,
  ADD COLUMN "supplierDeliveryNumber" TEXT,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_quantity_check" CHECK (
    "totalQuantity" >= 0
    AND "quarantinedQuantity" >= 0
    AND "quarantinedQuantity" <= "totalQuantity"
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
    "quantity" > 0
    AND "quarantineQty" >= 0
    AND "quarantineQty" <= "quantity"
    AND "unitCost" >= 0
    AND "totalCost" >= 0
  )
);

CREATE INDEX "purchase_order_items_destinationStockLocationId_idx"
  ON "purchase_order_items"("destinationStockLocationId");
CREATE UNIQUE INDEX "goods_receipts_inventoryPostingId_key"
  ON "goods_receipts"("inventoryPostingId");
CREATE UNIQUE INDEX "goods_receipt_items_stockMutationId_key"
  ON "goods_receipt_items"("stockMutationId");
CREATE UNIQUE INDEX "goods_receipt_items_costLayerId_key"
  ON "goods_receipt_items"("costLayerId");
CREATE UNIQUE INDEX "goods_receipt_items_receipt_line_key"
  ON "goods_receipt_items"("goodsReceiptId", "purchaseOrderItemId", "stockLocationId", "batchKey", "condition");
CREATE INDEX "goods_receipt_items_purchaseOrderItemId_idx"
  ON "goods_receipt_items"("purchaseOrderItemId");
CREATE INDEX "goods_receipt_items_inventoryBalanceId_idx"
  ON "goods_receipt_items"("inventoryBalanceId");
CREATE INDEX "goods_receipt_items_batchId_idx"
  ON "goods_receipt_items"("batchId");

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_uomId_fkey"
  FOREIGN KEY ("uomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_destinationStockLocationId_fkey"
  FOREIGN KEY ("destinationStockLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
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
