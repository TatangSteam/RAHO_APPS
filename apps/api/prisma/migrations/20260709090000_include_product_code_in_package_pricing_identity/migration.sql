-- Allow multiple package pricings with the same package type, service, and sessions
-- when they intentionally use different product codes (for example FREE packages).
DROP INDEX IF EXISTS "package_pricings_branchId_packageType_boosterType_serviceType_totalSessions_key";
DROP INDEX IF EXISTS "package_pricing_identity_unique";

CREATE UNIQUE INDEX "package_pricing_identity_unique"
ON "package_pricings" ("branchId", "packageType", "boosterType", "serviceType", "totalSessions", "productCode")
NULLS NOT DISTINCT;
