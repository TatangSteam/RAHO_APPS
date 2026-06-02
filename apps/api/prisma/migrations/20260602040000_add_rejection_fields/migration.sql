-- Add rejection fields to MemberPackage
ALTER TABLE "member_packages" ADD COLUMN "rejectedBy" TEXT;
ALTER TABLE "member_packages" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "member_packages" ADD COLUMN "rejectionReason" TEXT;

-- Add rejection fields to MemberAddOn
ALTER TABLE "member_add_ons" ADD COLUMN "rejectedBy" TEXT;
ALTER TABLE "member_add_ons" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "member_add_ons" ADD COLUMN "rejectionReason" TEXT;

-- Add foreign key constraints
ALTER TABLE "member_packages" ADD CONSTRAINT "member_packages_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "member_add_ons" ADD CONSTRAINT "member_add_ons_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
