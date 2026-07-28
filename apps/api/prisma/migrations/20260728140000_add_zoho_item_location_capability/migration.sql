ALTER TYPE "ZohoDiscoveryResourceType" ADD VALUE IF NOT EXISTS 'ITEM';

ALTER TABLE "zoho_connections"
  ADD COLUMN "locationsSupported" BOOLEAN,
  ADD COLUMN "locationsCapabilityError" TEXT;
