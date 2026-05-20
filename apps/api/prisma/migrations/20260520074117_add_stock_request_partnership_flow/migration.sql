/*
  Warnings:

  - You are about to drop the column `inventoryItemId` on the `shipment_items` table. All the data in the column will be lost.
  - Added the required column `masterProductId` to the `shipment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `masterProductId` to the `stock_request_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('SHORTAGE', 'DAMAGE', 'WRONG_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('EXPIRED', 'DAMAGED', 'LOST', 'STOCK_OPNAME', 'OTHER');

-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'RECEIVED_WITH_ISSUE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockRequestStatus" ADD VALUE 'WAITING_PAYMENT';
ALTER TYPE "StockRequestStatus" ADD VALUE 'PAYMENT_UPLOADED';
ALTER TYPE "StockRequestStatus" ADD VALUE 'PAYMENT_CONFIRMED';
ALTER TYPE "StockRequestStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "StockRequestStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "StockRequestStatus" ADD VALUE 'COMPLETED_WITH_ISSUE';

-- DropForeignKey
ALTER TABLE "shipment_items" DROP CONSTRAINT "shipment_items_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "stock_request_items" DROP CONSTRAINT "stock_request_items_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_request_items" DROP CONSTRAINT "stock_request_items_stockRequestId_fkey";

-- AlterTable
ALTER TABLE "shipment_items" DROP COLUMN "inventoryItemId",
ADD COLUMN     "masterProductId" TEXT NOT NULL,
ADD COLUMN     "receivedQty" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "shipmentPhotoName" TEXT,
ADD COLUMN     "shipmentPhotoUrl" TEXT,
ADD COLUMN     "shippedBy" TEXT;

-- AlterTable
ALTER TABLE "stock_request_items" ADD COLUMN     "approvedQty" DECIMAL(10,2),
ADD COLUMN     "masterProductId" TEXT NOT NULL,
ALTER COLUMN "inventoryItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stock_requests" ADD COLUMN     "paymentProofFileName" TEXT,
ADD COLUMN     "paymentProofFileSize" INTEGER,
ADD COLUMN     "paymentProofMimeType" TEXT,
ADD COLUMN     "paymentProofUrl" TEXT,
ADD COLUMN     "paymentRejectionReason" TEXT,
ADD COLUMN     "paymentUploadedAt" TIMESTAMP(3),
ADD COLUMN     "paymentUploadedBy" TEXT,
ADD COLUMN     "paymentVerificationNotes" TEXT,
ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentVerifiedBy" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "receivingNotes" TEXT,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippedBy" TEXT;

-- CreateTable
CREATE TABLE "stock_request_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "stockRequestId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentProofUrl" TEXT,
    "paymentProofFileName" TEXT,
    "paymentProofFileSize" INTEGER,
    "paymentProofMimeType" TEXT,
    "paymentUploadedAt" TIMESTAMP(3),
    "paymentUploadedBy" TEXT,
    "paymentVerificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_request_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_request_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "stock_request_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_discrepancies" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "expectedQty" DECIMAL(10,2) NOT NULL,
    "receivedQty" DECIMAL(10,2) NOT NULL,
    "discrepancyType" "DiscrepancyType" NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,
    "photoFileName" TEXT,
    "reportedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_request_invoices_invoiceNumber_key" ON "stock_request_invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stock_request_invoices_stockRequestId_key" ON "stock_request_invoices"("stockRequestId");

-- CreateIndex
CREATE INDEX "stock_request_invoices_branchId_idx" ON "stock_request_invoices"("branchId");

-- CreateIndex
CREATE INDEX "stock_request_invoices_status_idx" ON "stock_request_invoices"("status");

-- CreateIndex
CREATE INDEX "stock_request_invoices_paymentVerificationStatus_idx" ON "stock_request_invoices"("paymentVerificationStatus");

-- CreateIndex
CREATE INDEX "stock_request_invoices_createdAt_idx" ON "stock_request_invoices"("createdAt");

-- CreateIndex
CREATE INDEX "stock_request_invoice_items_invoiceId_idx" ON "stock_request_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "stock_request_invoice_items_masterProductId_idx" ON "stock_request_invoice_items"("masterProductId");

-- CreateIndex
CREATE INDEX "shipment_discrepancies_shipmentId_idx" ON "shipment_discrepancies"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_discrepancies_masterProductId_idx" ON "shipment_discrepancies"("masterProductId");

-- CreateIndex
CREATE INDEX "shipment_discrepancies_discrepancyType_idx" ON "shipment_discrepancies"("discrepancyType");

-- CreateIndex
CREATE INDEX "shipment_items_masterProductId_idx" ON "shipment_items"("masterProductId");

-- CreateIndex
CREATE INDEX "shipments_shippedAt_idx" ON "shipments"("shippedAt");

-- CreateIndex
CREATE INDEX "shipments_receivedAt_idx" ON "shipments"("receivedAt");

-- CreateIndex
CREATE INDEX "stock_request_items_masterProductId_idx" ON "stock_request_items"("masterProductId");

-- CreateIndex
CREATE INDEX "stock_requests_requestedBy_idx" ON "stock_requests"("requestedBy");

-- CreateIndex
CREATE INDEX "stock_requests_createdAt_idx" ON "stock_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_invoices" ADD CONSTRAINT "stock_request_invoices_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_invoice_items" ADD CONSTRAINT "stock_request_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "stock_request_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_invoice_items" ADD CONSTRAINT "stock_request_invoice_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_discrepancies" ADD CONSTRAINT "shipment_discrepancies_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_discrepancies" ADD CONSTRAINT "shipment_discrepancies_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
