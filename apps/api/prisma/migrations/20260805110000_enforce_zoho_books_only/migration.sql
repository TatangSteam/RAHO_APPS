-- The integration target is deliberately limited to Zoho Books.
-- Clear any capability result that may previously have enabled Zoho Inventory writes.
UPDATE "zoho_connections"
SET
  "inventoryAdjustmentsSupported" = FALSE,
  "inventoryAdjustmentsCapabilityError" = 'Mode Zoho Books-only aktif; inventory adjustment tetap di ERP dan menggunakan ekspor terkontrol.',
  "inventoryAdjustmentsLastCheckedAt" = NOW();
