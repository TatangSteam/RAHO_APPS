DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "master_products"
    WHERE "conversion_factor" <= 0
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce positive master product conversion factor: zero or negative legacy values exist';
  END IF;
END
$$;

ALTER TABLE "master_products"
  ALTER COLUMN "conversion_factor" TYPE DECIMAL(18, 6)
  USING "conversion_factor"::DECIMAL(18, 6);

ALTER TABLE "master_products"
  ADD CONSTRAINT "master_products_conversion_factor_positive"
  CHECK ("conversion_factor" > 0);
