-- Two historical treatment-reversal fixtures were created with synthetic,
-- non-existent branch IDs. Preserve them as audit evidence, but prevent them
-- from ever being delivered to Zoho. The three independently stored fixture
-- identifiers must share the same generated suffix and the branch must remain
-- absent, so a real treatment event cannot be selected by this migration.
BEGIN;

UPDATE "integration_events" AS event
SET
  "status" = 'IGNORED',
  "ignoredAt" = COALESCE(event."ignoredAt", CURRENT_TIMESTAMP),
  "ignoreReason" = COALESCE(event."ignoreReason", 'Quarantined orphaned treatment integration-test fixture'),
  "lockedBy" = NULL,
  "leaseUntil" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE event."status" IN ('PENDING', 'PROCESSING', 'FAILED', 'DRY_RUN', 'DEAD_LETTER')
  AND event."eventType" = 'TREATMENT_INVENTORY_REVERSED'
  AND event."aggregateType" = 'TreatmentSessionInventoryReversal'
  AND event."aggregateId" ~ '^treat_session_[0-9a-f]{14}:REVERSAL$'
  AND event."branchId" ~ '^treat_branch_[0-9a-f]{14}$'
  AND event."payload"->>'externalKey' ~ '^RAHO-TREATMENT-REV-SES-[0-9a-f]{14}$'
  AND replace(split_part(event."aggregateId", ':', 1), 'treat_session_', '')
      = replace(event."branchId", 'treat_branch_', '')
  AND replace(event."branchId", 'treat_branch_', '')
      = replace(event."payload"->>'externalKey', 'RAHO-TREATMENT-REV-SES-', '')
  AND NOT EXISTS (
    SELECT 1
    FROM "branches" AS branch
    WHERE branch."id" = event."branchId"
  );

COMMIT;
