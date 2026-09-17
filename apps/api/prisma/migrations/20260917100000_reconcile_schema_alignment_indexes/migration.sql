-- The July 29 alignment references these indexes before their tables exist.
-- Reconcile them only after the complete migration chain creates the tables.
-- This changes an index name, never business rows or uniqueness semantics.
BEGIN;

DO $repair$
DECLARE
  old_index regclass := to_regclass('"supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemId_ke"');
  new_index regclass := to_regclass('"supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemI_key"');
BEGIN
  IF old_index IS NOT NULL AND new_index IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicting supplier invoice line index names; manual inspection required';
  ELSIF old_index IS NOT NULL THEN
    ALTER INDEX "supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemId_ke"
      RENAME TO "supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemI_key";
  ELSIF new_index IS NULL THEN
    RAISE EXCEPTION 'Supplier invoice line unique index missing; refusing reconciliation';
  END IF;
END $repair$;

DO $repair$
DECLARE
  old_index regclass := to_regclass('"zoho_reconciliation_results_runId_entityType_localEntityId_zoho"');
  new_index regclass := to_regclass('"zoho_reconciliation_results_runId_entityType_localEntityId__key"');
BEGIN
  IF old_index IS NOT NULL AND new_index IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicting Zoho reconciliation index names; manual inspection required';
  ELSIF old_index IS NOT NULL THEN
    ALTER INDEX "zoho_reconciliation_results_runId_entityType_localEntityId_zoho"
      RENAME TO "zoho_reconciliation_results_runId_entityType_localEntityId__key";
  ELSIF new_index IS NULL THEN
    RAISE EXCEPTION 'Zoho reconciliation unique index missing; refusing reconciliation';
  END IF;
END $repair$;

COMMIT;
