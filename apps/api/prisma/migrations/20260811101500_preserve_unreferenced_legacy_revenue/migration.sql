-- A small set of packages can be operational legacy rows even though they
-- received the version-2 default after the finance cutover. They have no
-- invoice item and no deferred-revenue contract, so there is no finance source
-- document that can safely be reconstructed. Preserve them as legacy instead
-- of blocking treatment completion or inventing revenue history.
--
-- Current unpaid packages remain version 2. Current packages that already have
-- an invoice reference also remain version 2 and must pass normal payment
-- verification/funding.
UPDATE "member_packages" AS package
SET "revenueFlowVersion" = 1
WHERE package."revenueFlowVersion" = 2
  AND package."finalPrice" > 0
  AND (
    package."usedSessions" > 0
    OR package."status" IN ('ACTIVE', 'EXPIRED')
    OR package."verifiedAt" IS NOT NULL
    OR package."activatedAt" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "invoice_items" AS item
    WHERE item."itemType" = 'PACKAGE'
      AND item."itemId" = package."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "package_revenue_contracts" AS contract
    WHERE contract."memberPackageId" = package."id"
  );
