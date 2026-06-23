ALTER TABLE "stock_request_invoices"
ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "remainingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "stock_request_invoices"
SET
  "paidAmount" = CASE WHEN "status" = 'PAID' THEN "totalAmount" ELSE 0 END,
  "remainingAmount" = CASE WHEN "status" = 'PAID' THEN 0 ELSE "totalAmount" END;

CREATE TABLE "stock_request_invoice_payments" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "proofFileUrl" TEXT NOT NULL,
  "proofFileName" TEXT NOT NULL,
  "proofFileSize" INTEGER NOT NULL,
  "proofMimeType" TEXT NOT NULL,
  "notes" TEXT,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verificationNotes" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stock_request_invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_request_invoice_payments_invoiceId_idx" ON "stock_request_invoice_payments"("invoiceId");
CREATE INDEX "stock_request_invoice_payments_uploadedBy_idx" ON "stock_request_invoice_payments"("uploadedBy");
CREATE INDEX "stock_request_invoice_payments_uploadedAt_idx" ON "stock_request_invoice_payments"("uploadedAt");

ALTER TABLE "stock_request_invoice_payments"
ADD CONSTRAINT "stock_request_invoice_payments_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "stock_request_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
