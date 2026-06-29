ALTER TABLE "public"."shipments"
ADD COLUMN "receiptFileUrl" TEXT,
ADD COLUMN "receiptFileName" TEXT,
ADD COLUMN "receiptFileSize" INTEGER,
ADD COLUMN "receiptMimeType" TEXT;
