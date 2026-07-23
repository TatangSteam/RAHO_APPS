-- Backfill branches created before default warehouse/location provisioning was enabled.
INSERT INTO "warehouses" (
  "id",
  "branchId",
  "code",
  "name",
  "isDefault",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'wh_default_backfill_' || b."id",
  b."id",
  'DEFAULT',
  'Warehouse Utama',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "branches" b
WHERE NOT EXISTS (
  SELECT 1 FROM "warehouses" w WHERE w."branchId" = b."id"
)
ON CONFLICT ("branchId", "code") DO NOTHING;

INSERT INTO "stock_locations" (
  "id",
  "warehouseId",
  "code",
  "name",
  "isDefault",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'loc_default_backfill_' || w."id",
  w."id",
  'DEFAULT',
  'Lokasi Utama',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "warehouses" w
WHERE w."isDefault" = true
  AND NOT EXISTS (
    SELECT 1 FROM "stock_locations" l WHERE l."warehouseId" = w."id"
  )
ON CONFLICT ("warehouseId", "code") DO NOTHING;
