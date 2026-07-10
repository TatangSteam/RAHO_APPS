-- NB-HHO is consumed in ml during infusion, but stock is managed by bottle.
-- Keep existing inventory quantities unchanged; only fix product unit metadata
-- so stock 27 is interpreted as 27 bottles, not 27 ml.
UPDATE "master_products"
SET
  "unit" = 'botol',
  "base_unit" = 'botol',
  "usage_unit" = 'ml',
  "conversion_factor" = 25,
  "description" = 'Nano Bubble HHO 25ml per botol - untuk field: hho'
WHERE "sku" = 'PRD-NBT-HHO-001';
