-- Nilai komersial GIFT-10B belum ditetapkan dalam requirement bisnis.
-- NULL membedakan status "belum ditetapkan" dari voucher gratis bernilai Rp0.
UPDATE "voucher_campaigns"
SET
  "totalPrice" = NULL,
  "unitPrice" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'GIFT-10B'
  AND "version" = 1
  AND "totalPrice" = 0;
