-- Older integration-test runners wrote isolated approval, payment, reservation,
-- and shipment fixtures to the application database. Match both the generated
-- branch-code family and the human-readable fixture name so a real branch with
-- a coincidentally similar code is never selected.
BEGIN;

CREATE TEMP TABLE "_integration_test_branches" ON COMMIT DROP AS
SELECT "id"
FROM "branches"
WHERE ("branchCode" LIKE 'AP%' AND "name" LIKE 'Approval %')
   OR ("branchCode" LIKE 'PY%' AND "name" LIKE 'Payment Branch %')
   OR ("branchCode" LIKE 'RD%' AND "name" LIKE 'Reservation Destination %')
   OR ("branchCode" LIKE 'RS%' AND "name" LIKE 'Reservation Source %')
   OR ("branchCode" LIKE 'SD%' AND "name" LIKE 'Shipment Destination %')
   OR ("branchCode" LIKE 'SS%' AND "name" LIKE 'Shipment Source %');

-- No selected row is deleted. Stop any retryable Zoho work for this isolated
-- scope before deactivating it, while retaining the original event as evidence.
UPDATE "integration_events"
SET
  "status" = 'IGNORED',
  "ignoredAt" = COALESCE("ignoredAt", CURRENT_TIMESTAMP),
  "ignoreReason" = COALESCE("ignoreReason", 'Quarantined legacy integration-test fixture'),
  "lockedBy" = NULL,
  "leaseUntil" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "branchId" IN (SELECT "id" FROM "_integration_test_branches")
  AND "status" IN ('PENDING', 'PROCESSING', 'FAILED', 'DRY_RUN', 'DEAD_LETTER');

UPDATE "branches"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "id" FROM "_integration_test_branches");

-- Test users are selected by both their generated ID prefix and reserved test
-- email domain. Tombstoning releases the unique email without breaking history.
UPDATE "users"
SET
  "isActive" = false,
  "email" = 'deleted-' || "id" || '@users.invalid',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" NOT LIKE 'deleted-%@users.invalid'
  AND (
    ("id" ~ '^apr_' AND "email" LIKE '%@test.local')
    OR ("id" ~ '^(pay|reserve|ship)_' AND "email" LIKE '%@example.test')
  );

COMMIT;
