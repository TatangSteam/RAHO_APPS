-- ============================================================
-- Migration: Add Overstock Feature
-- Description: Allows sending more items than requested and 
--              auto-deducting from future requests
-- ============================================================

-- Add OverstockStatus enum
CREATE TYPE "OverstockStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_USED', 'FULLY_USED');

-- Create BranchOverstock table
CREATE TABLE "branch_overstocks" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "originalQty" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceShipmentId" TEXT NOT NULL,
    "status" "OverstockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_overstocks_pkey" PRIMARY KEY ("id")
);

-- Create OverstockUsage table (tracks how overstock is consumed)
CREATE TABLE "overstock_usages" (
    "id" TEXT NOT NULL,
    "overstockId" TEXT NOT NULL,
    "stockRequestId" TEXT NOT NULL,
    "stockRequestItemId" TEXT NOT NULL,
    "quantityUsed" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overstock_usages_pkey" PRIMARY KEY ("id")
);

-- Add overstock fields to ShipmentItem
ALTER TABLE "shipment_items" ADD COLUMN "requestedQty" DECIMAL(10,2);
ALTER TABLE "shipment_items" ADD COLUMN "overstockQty" DECIMAL(10,2);
ALTER TABLE "shipment_items" ADD COLUMN "overstockReason" TEXT;

-- Add overstock deduction fields to StockRequestItem
ALTER TABLE "stock_request_items" ADD COLUMN "overstockDeducted" DECIMAL(10,2);
ALTER TABLE "stock_request_items" ADD COLUMN "finalQty" DECIMAL(10,2);

-- Create indexes for BranchOverstock
CREATE INDEX "branch_overstocks_branchId_idx" ON "branch_overstocks"("branchId");
CREATE INDEX "branch_overstocks_masterProductId_idx" ON "branch_overstocks"("masterProductId");
CREATE INDEX "branch_overstocks_status_idx" ON "branch_overstocks"("status");
CREATE INDEX "branch_overstocks_branchId_masterProductId_status_idx" ON "branch_overstocks"("branchId", "masterProductId", "status");
CREATE INDEX "branch_overstocks_sourceShipmentId_idx" ON "branch_overstocks"("sourceShipmentId");

-- Create indexes for OverstockUsage
CREATE INDEX "overstock_usages_overstockId_idx" ON "overstock_usages"("overstockId");
CREATE INDEX "overstock_usages_stockRequestId_idx" ON "overstock_usages"("stockRequestId");
CREATE INDEX "overstock_usages_stockRequestItemId_idx" ON "overstock_usages"("stockRequestItemId");

-- Add foreign keys for BranchOverstock
ALTER TABLE "branch_overstocks" ADD CONSTRAINT "branch_overstocks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_overstocks" ADD CONSTRAINT "branch_overstocks_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_overstocks" ADD CONSTRAINT "branch_overstocks_sourceShipmentId_fkey" FOREIGN KEY ("sourceShipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign keys for OverstockUsage
ALTER TABLE "overstock_usages" ADD CONSTRAINT "overstock_usages_overstockId_fkey" FOREIGN KEY ("overstockId") REFERENCES "branch_overstocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "overstock_usages" ADD CONSTRAINT "overstock_usages_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "overstock_usages" ADD CONSTRAINT "overstock_usages_stockRequestItemId_fkey" FOREIGN KEY ("stockRequestItemId") REFERENCES "stock_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
