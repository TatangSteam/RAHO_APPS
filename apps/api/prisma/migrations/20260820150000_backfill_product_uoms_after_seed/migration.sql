-- Product seeds can run after the migration that introduced UOM tables.
WITH legacy_uom AS (
  SELECT DISTINCT ON (lower(trim(unit_name))) trim(unit_name) AS unit_name
  FROM (
    SELECT "base_unit" AS unit_name FROM "master_products"
    UNION ALL
    SELECT "usage_unit" AS unit_name FROM "master_products"
  ) source
  WHERE unit_name IS NOT NULL AND trim(unit_name) <> ''
  ORDER BY lower(trim(unit_name)), trim(unit_name)
)
INSERT INTO "units_of_measure" ("id", "code", "name", "category", "createdAt", "updatedAt")
SELECT 'uom_' || substr(md5(lower(unit_name)), 1, 20),
       'UOM_' || upper(substr(md5(lower(unit_name)), 1, 12)),
       unit_name, 'LEGACY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM legacy_uom
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "master_products" p
SET "baseUomId" = u."id"
FROM "units_of_measure" u
WHERE lower(trim(p."base_unit")) = lower(trim(u."name"))
  AND p."baseUomId" IS NULL;

UPDATE "master_products" p
SET "usageUomId" = u."id"
FROM "units_of_measure" u
WHERE lower(trim(p."usage_unit")) = lower(trim(u."name"))
  AND p."usageUomId" IS NULL;

INSERT INTO "unit_conversions" (
  "id", "masterProductId", "fromUomId", "toUomId", "factor", "createdAt", "updatedAt"
)
SELECT 'conv_backfill_' || substr(md5(p."id" || ':' || p."baseUomId" || ':' || p."usageUomId"), 1, 20),
       p."id", p."baseUomId", p."usageUomId",
       p."conversion_factor", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "master_products" p
WHERE p."baseUomId" IS NOT NULL
  AND p."usageUomId" IS NOT NULL
  AND p."conversion_factor" > 0
ON CONFLICT ("masterProductId", "fromUomId", "toUomId") DO UPDATE
SET "factor" = EXCLUDED."factor", "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;
