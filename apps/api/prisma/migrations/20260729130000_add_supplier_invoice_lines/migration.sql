CREATE TABLE "supplier_invoice_lines" (
    "id" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "billedQty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supplier_invoice_lines_quantity_check" CHECK ("billedQty" > 0),
    CONSTRAINT "supplier_invoice_lines_unit_price_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "supplier_invoice_lines_total_check" CHECK ("lineTotal" >= 0)
);

CREATE UNIQUE INDEX "supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemId_key"
ON "supplier_invoice_lines"("supplierInvoiceId", "purchaseOrderItemId");

CREATE UNIQUE INDEX "supplier_invoice_lines_supplierInvoiceId_lineNo_key"
ON "supplier_invoice_lines"("supplierInvoiceId", "lineNo");

CREATE INDEX "supplier_invoice_lines_purchaseOrderItemId_idx"
ON "supplier_invoice_lines"("purchaseOrderItemId");

ALTER TABLE "supplier_invoice_lines"
ADD CONSTRAINT "supplier_invoice_lines_supplierInvoiceId_fkey"
FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_invoice_lines"
ADD CONSTRAINT "supplier_invoice_lines_purchaseOrderItemId_fkey"
FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
