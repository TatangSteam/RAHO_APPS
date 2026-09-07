-- A member may only have one current document for each document type.
-- Keep the newest row if legacy/concurrent uploads previously created duplicates.
WITH ranked_documents AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "memberId", "documentType"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "member_documents"
)
DELETE FROM "member_documents"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_documents
  WHERE row_number > 1
);

DROP INDEX IF EXISTS "member_documents_memberId_documentType_idx";

CREATE UNIQUE INDEX "member_documents_memberId_documentType_key"
ON "member_documents"("memberId", "documentType");
