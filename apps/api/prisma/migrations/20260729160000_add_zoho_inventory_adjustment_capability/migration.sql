ALTER TABLE "zoho_connections"
  ADD COLUMN "inventoryAdjustmentsSupported" BOOLEAN,
  ADD COLUMN "inventoryAdjustmentsCapabilityError" TEXT,
  ADD COLUMN "inventoryAdjustmentsLastCheckedAt" TIMESTAMP(3);
