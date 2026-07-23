-- Finance owns financial documents end-to-end. The original static checks
-- cannot distinguish an autonomous Finance template from ordinary makers, so
-- replace them with a conditional database trigger. Application-level
-- maker-checker checks remain in place for all non-Finance users.

ALTER TABLE "purchase_requests"
  DROP CONSTRAINT IF EXISTS "purchase_requests_maker_checker_check";

ALTER TABLE "expenses"
  DROP CONSTRAINT IF EXISTS "expenses_maker_checker_check";

ALTER TABLE "opening_balances"
  DROP CONSTRAINT IF EXISTS "opening_balances_maker_checker_check";

CREATE OR REPLACE FUNCTION enforce_finance_autonomous_maker_checker()
RETURNS trigger AS $$
DECLARE
  maker_template_code TEXT;
BEGIN
  IF NEW."reviewedBy" IS NOT NULL AND NEW."reviewedBy" = NEW."createdBy" THEN
    SELECT rt."code"
      INTO maker_template_code
      FROM "users" u
      LEFT JOIN "role_templates" rt ON rt."id" = u."roleTemplateId"
      WHERE u."id" = NEW."createdBy"
        AND u."isActive" = true
        AND rt."isActive" = true;

    IF maker_template_code IS NULL
       OR maker_template_code NOT IN ('FINANCE', 'FINANCE_DUMMY') THEN
      RAISE EXCEPTION 'maker-checker violation: only autonomous Finance may review its own financial document'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "purchase_requests_maker_checker_trigger" ON "purchase_requests";
CREATE TRIGGER "purchase_requests_maker_checker_trigger"
BEFORE INSERT OR UPDATE OF "reviewedBy", "createdBy" ON "purchase_requests"
FOR EACH ROW EXECUTE FUNCTION enforce_finance_autonomous_maker_checker();

DROP TRIGGER IF EXISTS "expenses_maker_checker_trigger" ON "expenses";
CREATE TRIGGER "expenses_maker_checker_trigger"
BEFORE INSERT OR UPDATE OF "reviewedBy", "createdBy" ON "expenses"
FOR EACH ROW EXECUTE FUNCTION enforce_finance_autonomous_maker_checker();

DROP TRIGGER IF EXISTS "opening_balances_maker_checker_trigger" ON "opening_balances";
CREATE TRIGGER "opening_balances_maker_checker_trigger"
BEFORE INSERT OR UPDATE OF "reviewedBy", "createdBy" ON "opening_balances"
FOR EACH ROW EXECUTE FUNCTION enforce_finance_autonomous_maker_checker();
