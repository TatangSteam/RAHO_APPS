-- Release login emails retained by the legacy staff soft-delete flow.
-- Historical user rows and all foreign-key relations remain intact.
-- MEMBER accounts are intentionally excluded because they have a separate
-- lifecycle and are not deleted from the staff management screen.
UPDATE "users"
SET
  "email" = 'deleted-' || "id" || '@users.invalid',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "isActive" = false
  AND "role" <> 'MEMBER'
  AND "email" NOT LIKE 'deleted-%@users.invalid';
