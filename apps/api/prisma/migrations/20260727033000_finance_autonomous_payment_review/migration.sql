-- Finance owns invoice payment review end-to-end. Preserve maker-checker for
-- every other role template while allowing active FINANCE/FINANCE_DUMMY users
-- to verify or reject a payment that they submitted.

ALTER TABLE "invoice_payments"
  DROP CONSTRAINT IF EXISTS "invoice_payments_verifier_check";

CREATE OR REPLACE FUNCTION enforce_invoice_payment_finance_self_review()
RETURNS trigger AS $$
DECLARE
  maker_template_code TEXT;
BEGIN
  IF NEW."verifiedBy" IS NOT NULL AND NEW."verifiedBy" = NEW."receivedBy" THEN
    SELECT rt."code"
      INTO maker_template_code
      FROM "users" u
      LEFT JOIN "role_templates" rt ON rt."id" = u."roleTemplateId"
      WHERE u."id" = NEW."receivedBy"
        AND u."isActive" = true
        AND rt."isActive" = true;

    IF maker_template_code IS NULL
       OR maker_template_code NOT IN ('FINANCE', 'FINANCE_DUMMY') THEN
      RAISE EXCEPTION 'maker-checker violation: only autonomous Finance may review its own invoice payment'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "invoice_payment_finance_self_review_trigger" ON "invoice_payments";
CREATE TRIGGER "invoice_payment_finance_self_review_trigger"
BEFORE INSERT OR UPDATE OF "verifiedBy", "receivedBy" ON "invoice_payments"
FOR EACH ROW EXECUTE FUNCTION enforce_invoice_payment_finance_self_review();
