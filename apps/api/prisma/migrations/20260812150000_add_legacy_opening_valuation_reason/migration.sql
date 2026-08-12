-- Legacy opening-stock valuation is a balance-sheet adoption, not an
-- operational inventory gain. Keep it on opening equity so old stock does not
-- inflate current-period revenue.
INSERT INTO "inventory_adjustment_reason_codes" (
  "id",
  "code",
  "name",
  "direction",
  "requiresApproval",
  "approvalThreshold",
  "gainAccountCode",
  "lossAccountCode",
  "isActive",
  "updatedAt"
) VALUES (
  'adj_reason_legacy_opening_valuation',
  'LEGACY_OPENING_VALUATION',
  'Valuasi saldo awal persediaan legacy',
  NULL,
  true,
  0,
  '3100',
  '3100',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "direction" = EXCLUDED."direction",
  "requiresApproval" = true,
  "gainAccountCode" = '3100',
  "lossAccountCode" = '3100',
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
