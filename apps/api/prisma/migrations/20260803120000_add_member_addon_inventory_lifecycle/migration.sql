CREATE TYPE "AddOnStockReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

ALTER TABLE "member_add_ons"
  ADD COLUMN "productCode" TEXT,
  ADD COLUMN "inventorySku" TEXT,
  ADD COLUMN "stockQuantity" DECIMAL(18,4),
  ADD COLUMN "inventoryPostingId" TEXT;

CREATE TABLE "add_on_stock_reservations" (
  "id" TEXT NOT NULL,
  "memberAddOnId" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "status" "AddOnStockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "reservedBy" TEXT NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedBy" TEXT,
  "consumedAt" TIMESTAMP(3),
  "releasedBy" TEXT,
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "add_on_stock_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "add_on_stock_reservations_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "add_on_stock_reservations_memberAddOnId_inventoryBalanceId_key"
  ON "add_on_stock_reservations"("memberAddOnId", "inventoryBalanceId");
CREATE INDEX "add_on_stock_reservations_memberAddOnId_status_idx"
  ON "add_on_stock_reservations"("memberAddOnId", "status");
CREATE INDEX "add_on_stock_reservations_inventoryBalanceId_status_idx"
  ON "add_on_stock_reservations"("inventoryBalanceId", "status");
CREATE INDEX "member_add_ons_productCode_idx" ON "member_add_ons"("productCode");
CREATE INDEX "member_add_ons_inventorySku_idx" ON "member_add_ons"("inventorySku");
CREATE INDEX "member_add_ons_inventoryPostingId_idx" ON "member_add_ons"("inventoryPostingId");

ALTER TABLE "add_on_stock_reservations"
  ADD CONSTRAINT "add_on_stock_reservations_memberAddOnId_fkey"
  FOREIGN KEY ("memberAddOnId") REFERENCES "member_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "add_on_stock_reservations"
  ADD CONSTRAINT "add_on_stock_reservations_inventoryBalanceId_fkey"
  FOREIGN KEY ("inventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
