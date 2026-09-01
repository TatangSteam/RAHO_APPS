ALTER TABLE "campaign_vouchers"
  ADD COLUMN "recipientNikHash" TEXT,
  ADD COLUMN "recipientDateOfBirth" TIMESTAMP(3);

UPDATE "campaign_vouchers" AS voucher
SET "recipientDateOfBirth" = member."dateOfBirth"
FROM "members" AS member
WHERE voucher."recipientMemberId" = member."id"
  AND voucher."recipientDateOfBirth" IS NULL;

CREATE INDEX "campaign_vouchers_recipientNikHash_idx"
  ON "campaign_vouchers"("recipientNikHash");
