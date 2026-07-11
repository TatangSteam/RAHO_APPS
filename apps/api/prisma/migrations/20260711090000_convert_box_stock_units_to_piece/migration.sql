-- Normalize stock products that were previously configured as boxes/kotak.
-- Existing inventory quantities are already maintained as counted items, so this
-- migration only fixes product unit metadata and keeps stock numbers unchanged.

UPDATE "master_products"
SET
  "unit" = CASE
    WHEN lower("unit") IN ('box', 'kotak', 'pcs') THEN 'Piece'
    ELSE "unit"
  END,
  "base_unit" = CASE
    WHEN lower("base_unit") IN ('box', 'kotak', 'pcs') THEN 'Piece'
    ELSE "base_unit"
  END,
  "usage_unit" = CASE
    WHEN lower("usage_unit") IN ('box', 'kotak', 'pcs') THEN 'Piece'
    ELSE "usage_unit"
  END,
  "conversion_factor" = CASE
    WHEN lower("base_unit") IN ('box', 'kotak') THEN 1
    ELSE "conversion_factor"
  END,
  "updatedAt" = NOW()
WHERE
  lower("unit") IN ('box', 'kotak', 'pcs')
  OR lower("base_unit") IN ('box', 'kotak', 'pcs')
  OR lower("usage_unit") IN ('box', 'kotak', 'pcs');

UPDATE "material_usages" mu
SET "unit" = 'Piece'
FROM "inventory_items" ii
JOIN "master_products" mp ON mp."id" = ii."masterProductId"
WHERE
  mu."inventoryItemId" = ii."id"
  AND lower(mu."unit") IN ('box', 'kotak', 'pcs')
  AND lower(mp."usage_unit") = 'piece';
