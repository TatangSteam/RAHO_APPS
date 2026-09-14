CREATE TYPE "StaffIncentivePeriodStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'PAID');

CREATE TABLE "staff_incentive_periods" (
  "id" TEXT NOT NULL,
  "month" VARCHAR(7) NOT NULL,
  "scopeKey" VARCHAR(500) NOT NULL,
  "branchId" TEXT,
  "status" "StaffIncentivePeriodStatus" NOT NULL DEFAULT 'DRAFT',
  "report" JSONB NOT NULL,
  "generatedBy" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidBy" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_incentive_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_incentive_periods_month_scopeKey_key"
ON "staff_incentive_periods"("month", "scopeKey");

CREATE INDEX "staff_incentive_periods_month_status_idx"
ON "staff_incentive_periods"("month", "status");

CREATE INDEX "staff_incentive_periods_branchId_idx"
ON "staff_incentive_periods"("branchId");
