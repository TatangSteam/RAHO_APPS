-- Older direct-payment purchases could mark an invoice PAID and populate its
-- verifier fields while leaving the denormalized verification flag PENDING.
-- Align that flag with the authoritative paid/verified invoice fields.
UPDATE "invoices"
SET
  "paymentVerificationStatus" = 'VERIFIED',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'PAID'
  AND "verifiedAt" IS NOT NULL
  AND "verifiedBy" IS NOT NULL
  AND "paymentVerificationStatus" = 'PENDING';
