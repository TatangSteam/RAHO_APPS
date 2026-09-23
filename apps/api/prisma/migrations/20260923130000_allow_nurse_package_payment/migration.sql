-- Nakes menerima bukti pembayaran di cabang tempat mereka bertugas. The
-- package-payment compatibility flow uses INVOICE.PAYMENT for both uploading
-- the proof and confirming the package payment.
INSERT INTO "role_template_permissions" (
  "id",
  "roleTemplateId",
  "permissionId",
  "createdAt"
)
SELECT
  'rtp_nurse_invoice_payment',
  role_template."id",
  permission."id",
  CURRENT_TIMESTAMP
FROM "role_templates" role_template
JOIN "permissions" permission
  ON permission."code" = 'INVOICE.PAYMENT'
WHERE role_template."baseRole" = 'NURSE'
  AND role_template."isActive" = true
  AND permission."isActive" = true
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
