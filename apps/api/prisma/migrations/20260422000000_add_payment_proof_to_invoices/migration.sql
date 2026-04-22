-- Add payment proof fields to InvoicePayment
ALTER TABLE "invoice_payments" ADD COLUMN "proofFileUrl" TEXT;
ALTER TABLE "invoice_payments" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "invoice_payments" ADD COLUMN "proofFileSize" INTEGER;
ALTER TABLE "invoice_payments" ADD COLUMN "proofMimeType" TEXT;

-- Add payment proof fields to MemberPackage for direct verification
ALTER TABLE "member_packages" ADD COLUMN "paymentProofUrl" TEXT;
ALTER TABLE "member_packages" ADD COLUMN "paymentProofFileName" TEXT;
ALTER TABLE "member_packages" ADD COLUMN "paymentProofFileSize" INTEGER;
ALTER TABLE "member_packages" ADD COLUMN "paymentProofMimeType" TEXT;

-- Add payment proof fields to MemberAddOn
ALTER TABLE "member_add_ons" ADD COLUMN "paymentProofUrl" TEXT;
ALTER TABLE "member_add_ons" ADD COLUMN "paymentProofFileName" TEXT;
ALTER TABLE "member_add_ons" ADD COLUMN "paymentProofFileSize" INTEGER;
ALTER TABLE "member_add_ons" ADD COLUMN "paymentProofMimeType" TEXT;

-- Add payment proof fields to MemberNonTherapyPurchase
ALTER TABLE "member_non_therapy_purchases" ADD COLUMN "paymentProofUrl" TEXT;
ALTER TABLE "member_non_therapy_purchases" ADD COLUMN "paymentProofFileName" TEXT;
ALTER TABLE "member_non_therapy_purchases" ADD COLUMN "paymentProofFileSize" INTEGER;
ALTER TABLE "member_non_therapy_purchases" ADD COLUMN "paymentProofMimeType" TEXT;

-- Create index for payment proof queries
CREATE INDEX "idx_invoice_payments_proof" ON "invoice_payments"("proofFileUrl");
CREATE INDEX "idx_member_packages_proof" ON "member_packages"("paymentProofUrl");
CREATE INDEX "idx_member_add_ons_proof" ON "member_add_ons"("paymentProofUrl");
CREATE INDEX "idx_member_non_therapy_proof" ON "member_non_therapy_purchases"("paymentProofUrl");
