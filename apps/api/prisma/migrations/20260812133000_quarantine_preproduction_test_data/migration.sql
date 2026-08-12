-- Remove only unmistakable, unreferenced UAT journals that were accidentally
-- written to the application database by the old integration-test runner.
-- Foreign-key RESTRICT remains the final guard: migration rolls back if any
-- selected journal has acquired a real business-document reference.
CREATE TEMP TABLE "_uat_journals_to_remove" ON COMMIT DROP AS
SELECT journal."id"
FROM "journal_entries" AS journal
WHERE journal."postingKey" LIKE 'UAT:%'
  AND EXISTS (
    SELECT 1
    FROM "journal_source_links" AS source
    WHERE source."journalEntryId" = journal."id"
      AND source."sourceType" = 'UAT'
  );

DELETE FROM "journal_source_links"
WHERE "journalEntryId" IN (SELECT "id" FROM "_uat_journals_to_remove");

DELETE FROM "journal_lines"
WHERE "journalEntryId" IN (SELECT "id" FROM "_uat_journals_to_remove");

DELETE FROM "journal_entries"
WHERE "id" IN (SELECT "id" FROM "_uat_journals_to_remove");

-- Sprint 9 integration tests intentionally create isolated branches. Older
-- runners targeted the app database and left them active. Preserve every row
-- for traceability, but quarantine the unmistakable test scope from operations.
UPDATE "branches"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "branchCode" LIKE 'S9%'
  AND "name" LIKE 'Sprint 9 %';

UPDATE "users"
SET
  "isActive" = false,
  "email" = 'deleted-' || "id" || '@users.invalid',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" LIKE 's9-%@test.local';
