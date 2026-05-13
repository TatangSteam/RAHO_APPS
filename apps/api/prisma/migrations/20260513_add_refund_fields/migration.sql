-- Add refund fields to member_packages table
ALTER TABLE "member_packages" 
ADD COLUMN "refundAmount" DECIMAL(12,2),
ADD COLUMN "refundReason" TEXT,
ADD COLUMN "refundProofUrl" TEXT,
ADD COLUMN "refundProofFileName" TEXT,
ADD COLUMN "refundProofFileSize" INTEGER,
ADD COLUMN "refundProofMimeType" TEXT,
ADD COLUMN "refundedBy" TEXT,
ADD COLUMN "refundedAt" TIMESTAMP(3);

-- Add foreign key for refundedBy
ALTER TABLE "member_packages"
ADD CONSTRAINT "member_packages_refundedBy_fkey" 
FOREIGN KEY ("refundedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for refund queries
CREATE INDEX "member_packages_refundedAt_idx" ON "member_packages"("refundedAt");
CREATE INDEX "member_packages_refundProofUrl_idx" ON "member_packages"("refundProofUrl");
