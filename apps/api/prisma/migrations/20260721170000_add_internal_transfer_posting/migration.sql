ALTER TYPE "StockMutationType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "StockMutationType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "InventoryPostingType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "InventoryPostingType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "InventoryCostAllocationType" ADD VALUE IF NOT EXISTS 'TRANSFER_RECEIPT';
CREATE TYPE "InternalTransferStatus" AS ENUM ('IN_TRANSIT', 'RECEIVED', 'DISCREPANCY');

INSERT INTO "accounts" ("id", "code", "name", "type", "normalBalance", "parentId", "level", "allowPosting", "isControl", "description", "updatedAt")
VALUES ('coa_1310', '1310', 'Persediaan Dalam Perjalanan', 'ASSET', 'DEBIT', 'coa_1000', 2, true, true, 'Control account persediaan in-transit untuk transfer internal.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "internal_transfer_ledgers" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "fromBranchId" TEXT NOT NULL,
  "toBranchId" TEXT NOT NULL,
  "status" "InternalTransferStatus" NOT NULL DEFAULT 'IN_TRANSIT',
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "totalValue" DECIMAL(18,4) NOT NULL,
  "receivedValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "dispatchInventoryPostingId" TEXT NOT NULL,
  "receiptInventoryPostingId" TEXT,
  "dispatchJournalEntryId" TEXT NOT NULL,
  "receiptJournalEntryId" TEXT,
  "dispatchedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "internal_transfer_ledgers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "internal_transfer_branch_check" CHECK ("fromBranchId" <> "toBranchId"),
  CONSTRAINT "internal_transfer_value_check" CHECK ("totalValue" >= 0 AND "receivedValue" >= 0 AND "receivedValue" <= "totalValue")
);

CREATE UNIQUE INDEX "internal_transfer_ledgers_shipmentId_key" ON "internal_transfer_ledgers"("shipmentId");
CREATE UNIQUE INDEX "internal_transfer_ledgers_dispatchInventoryPostingId_key" ON "internal_transfer_ledgers"("dispatchInventoryPostingId");
CREATE UNIQUE INDEX "internal_transfer_ledgers_receiptInventoryPostingId_key" ON "internal_transfer_ledgers"("receiptInventoryPostingId");
CREATE UNIQUE INDEX "internal_transfer_ledgers_dispatchJournalEntryId_key" ON "internal_transfer_ledgers"("dispatchJournalEntryId");
CREATE UNIQUE INDEX "internal_transfer_ledgers_receiptJournalEntryId_key" ON "internal_transfer_ledgers"("receiptJournalEntryId");
CREATE INDEX "internal_transfer_ledgers_fromBranchId_status_idx" ON "internal_transfer_ledgers"("fromBranchId", "status");
CREATE INDEX "internal_transfer_ledgers_toBranchId_status_idx" ON "internal_transfer_ledgers"("toBranchId", "status");

ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_dispatchInventoryPostingId_fkey" FOREIGN KEY ("dispatchInventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_receiptInventoryPostingId_fkey" FOREIGN KEY ("receiptInventoryPostingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_dispatchJournalEntryId_fkey" FOREIGN KEY ("dispatchJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_ledgers" ADD CONSTRAINT "internal_transfer_ledgers_receiptJournalEntryId_fkey" FOREIGN KEY ("receiptJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
