ALTER TABLE "campaign_vouchers"
  ALTER COLUMN "recipientMemberId" DROP NOT NULL,
  ALTER COLUMN "recipientNameSnapshot" DROP NOT NULL,
  ALTER COLUMN "nikLast4" DROP NOT NULL;
