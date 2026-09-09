-- Keep the ordinal embedded in sessionCode aligned with infusKe for open sessions.
-- Completed/posted sessions remain immutable because their codes can already be
-- referenced by finance, inventory, exports, or external integrations.
UPDATE "treatment_sessions"
SET
  "sessionCode" = regexp_replace(
    "sessionCode",
    '-[0-9]+-([0-9]{4}-[A-Z0-9]{5})$',
    '-' || LPAD("infusKe"::text, 2, '0') || '-\1'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  NOT "isCompleted"
  AND "sessionCode" ~ '^SES-.+-[0-9]+-[0-9]{4}-[A-Z0-9]{5}$'
  AND "sessionCode" <> regexp_replace(
    "sessionCode",
    '-[0-9]+-([0-9]{4}-[A-Z0-9]{5})$',
    '-' || LPAD("infusKe"::text, 2, '0') || '-\1'
  );
