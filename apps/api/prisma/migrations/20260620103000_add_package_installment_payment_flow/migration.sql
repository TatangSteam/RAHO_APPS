-- Add installment payment metadata for member package invoices.

CREATE TYPE "PaymentPlanType" AS ENUM ('FULL_PAYMENT', 'INSTALLMENT');

ALTER TABLE "member_packages"
ADD COLUMN "paymentPlanType" "PaymentPlanType" NOT NULL DEFAULT 'FULL_PAYMENT',
ADD COLUMN "installmentTotal" INTEGER,
ADD COLUMN "installmentSchedule" JSONB,
ADD COLUMN "totalVerifiedPaid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "paymentPlanStatus" TEXT;

ALTER TABLE "member_add_ons"
ADD COLUMN "paymentPlanType" "PaymentPlanType" NOT NULL DEFAULT 'FULL_PAYMENT',
ADD COLUMN "installmentTotal" INTEGER,
ADD COLUMN "installmentSchedule" JSONB,
ADD COLUMN "totalVerifiedPaid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "paymentPlanStatus" TEXT;

ALTER TABLE "invoices"
ADD COLUMN "paymentPlanType" "PaymentPlanType" NOT NULL DEFAULT 'FULL_PAYMENT',
ADD COLUMN "paymentGroupId" TEXT,
ADD COLUMN "installmentNumber" INTEGER,
ADD COLUMN "installmentTotal" INTEGER,
ADD COLUMN "installmentSchedule" JSONB,
ADD COLUMN "totalPurchaseAmount" DECIMAL(12, 2),
ADD COLUMN "installmentAmount" DECIMAL(12, 2),
ADD COLUMN "carryOverAmount" DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN "creditAmount" DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN "actualPaidAmount" DECIMAL(12, 2),
ADD COLUMN "paymentVerificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paymentRejectionReason" TEXT,
ADD COLUMN "isAdjustment" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "invoices_paymentGroupId_installmentNumber_idx" ON "invoices"("paymentGroupId", "installmentNumber");
CREATE INDEX "invoices_paymentPlanType_idx" ON "invoices"("paymentPlanType");
