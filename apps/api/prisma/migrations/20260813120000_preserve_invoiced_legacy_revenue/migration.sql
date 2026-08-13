-- Some historical payments were verified by the legacy package endpoint.
-- That endpoint marked the invoice/package paid but did not post a cash-bank
-- transaction or create the deferred-revenue subledger contract. A version-2
-- default on those rows would incorrectly block treatment completion.
--
-- Downgrade only operational, explicitly verified rows with legacy payment
-- evidence (paid invoice, but no cash-bank posting). Unpaid/current packages
-- and every package with a proper deferred-revenue contract remain untouched.
UPDATE "member_packages" AS package
SET "revenueFlowVersion" = 1
WHERE package."revenueFlowVersion" >= 2
  AND package."finalPrice" > 0
  AND package."status" IN ('ACTIVE', 'EXPIRED')
  AND package."verifiedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "package_revenue_contracts" AS contract
    WHERE contract."memberPackageId" = package."id"
  )
  AND EXISTS (
    SELECT 1
    FROM "invoice_items" AS item
    JOIN "invoices" AS invoice ON invoice."id" = item."invoiceId"
    WHERE item."itemType" = 'PACKAGE'
      AND item."itemId" = package."id"
      AND invoice."status" = 'PAID'
      AND invoice."paymentVerificationStatus" = 'VERIFIED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "invoice_items" AS item
    JOIN "invoice_payments" AS payment ON payment."invoiceId" = item."invoiceId"
    JOIN "cash_bank_transactions" AS cash_tx ON cash_tx."invoicePaymentId" = payment."id"
    WHERE item."itemType" = 'PACKAGE'
      AND item."itemId" = package."id"
      AND payment."verificationStatus" = 'VERIFIED'
      AND cash_tx."status" = 'POSTED'
  );
