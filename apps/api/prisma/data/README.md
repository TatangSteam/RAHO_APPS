# Default vouchers

`default-vouchers-2026-09-02.json` contains the exact 200 codes supplied in
`voucher-codes-semua-campaign-2026-09-02.csv` (100 GIFT-10B, 50 SOCIAL-15B,
50 SOCIAL-15B-10BST). All were AVAILABLE, unrestricted by recipient or location.

Deployment runs `seed-default-vouchers.cjs` after successful migrations through
both deploy-with-recovery entry points, including the production Compose migration
service and `npm run db:migrate:prod`. The Prisma directory is included in the API image.
Running bare `prisma migrate deploy` does not run this seed; use the deployment
entry points or run `node prisma/seed-default-vouchers.cjs` afterward.

Codes are hashed for lookup and encrypted using VOUCHER_CODE_ENCRYPTION_KEY
(JWT_ACCESS_SECRET fallback, matching the application). Keep the same key across
deployments. The catalogue is bundled in the deployment source; it contains real
redeemable codes and should have the same access restrictions as the original CSV.

Import is transactional and repeatable: existing code hashes are skipped entirely,
preserving claims, recipients, cancellations and existing encrypted codes. New codes
start AVAILABLE with no member requirement. Campaign version 1 and benefits must
match the catalogue; migrations create these campaigns first. Existing unrelated
codes are retained. If their addition would exceed campaign quota, quota is raised
to the total stored code count; issuedCount/claimedCount remain unchanged because
AVAILABLE codes have not yet been issued or claimed.
