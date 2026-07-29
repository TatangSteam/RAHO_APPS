-- Existing packages must keep the pre-finance behavior. The temporary DEFAULT 1
-- labels every row that already exists when this migration is deployed as legacy.
ALTER TABLE "member_packages"
ADD COLUMN "revenueFlowVersion" INTEGER NOT NULL DEFAULT 1;

-- Packages created after the cutover use the current deferred-revenue flow.
ALTER TABLE "member_packages"
ALTER COLUMN "revenueFlowVersion" SET DEFAULT 2;

ALTER TABLE "member_packages"
ADD CONSTRAINT "member_packages_revenueFlowVersion_check"
CHECK ("revenueFlowVersion" IN (1, 2));

CREATE INDEX "member_packages_revenueFlowVersion_idx"
ON "member_packages"("revenueFlowVersion");
