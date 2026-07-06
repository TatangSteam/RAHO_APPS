-- Persist the member's session number within a branch. Previously this value
-- was accepted by the API but only returned in-memory and was lost afterwards.
ALTER TABLE "treatment_sessions" ADD COLUMN "branchInfusKe" INTEGER;

-- Recover values recorded by session-creation audit logs, including manual
-- branch numbers entered by users.
WITH "audited_branch_numbers" AS (
    SELECT DISTINCT ON ("resourceId")
        "resourceId" AS "sessionId",
        ("meta"->>'branchInfusKe')::INTEGER AS "branchInfusKe"
    FROM "audit_logs"
    WHERE "resource" = 'TreatmentSession'
      AND "meta"->>'branchInfusKe' ~ '^[1-9][0-9]*$'
    ORDER BY "resourceId", "createdAt" DESC
)
UPDATE "treatment_sessions" AS "session"
SET "branchInfusKe" = "audit"."branchInfusKe"
FROM "audited_branch_numbers" AS "audit"
WHERE "session"."id" = "audit"."sessionId";

-- Backfill sessions without a usable audit value in their historical order.
WITH "ranked_sessions" AS (
    SELECT
        "session"."id",
        ROW_NUMBER() OVER (
            PARTITION BY "encounter"."memberId", "session"."branchId"
            ORDER BY
                "session"."infusKe" ASC,
                "session"."treatmentDate" ASC,
                "session"."createdAt" ASC,
                "session"."id" ASC
        )::INTEGER AS "branchInfusKe"
    FROM "treatment_sessions" AS "session"
    INNER JOIN "encounters" AS "encounter"
        ON "encounter"."id" = "session"."encounterId"
)
UPDATE "treatment_sessions" AS "session"
SET "branchInfusKe" = "ranked"."branchInfusKe"
FROM "ranked_sessions" AS "ranked"
WHERE "session"."id" = "ranked"."id"
  AND "session"."branchInfusKe" IS NULL;

ALTER TABLE "treatment_sessions" ALTER COLUMN "branchInfusKe" SET NOT NULL;

CREATE INDEX "treatment_sessions_branchId_branchInfusKe_idx"
ON "treatment_sessions"("branchId", "branchInfusKe");
