-- Merge the seeded Finance and Admin Logistik responsibilities without
-- deleting either historical user row. The Finance login becomes the single
-- active controller account; the legacy logistics login is soft-disabled.

UPDATE "role_templates"
SET
  "name" = 'Finance & Logistics Controller',
  "description" = 'Akses Admin Manager ditambah Finance dan Logistik; pada flow pengiriman hanya melakukan dispatch.',
  "isSystem" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT';

-- Build the merged template from the existing Admin Manager, Admin Logistik,
-- legacy Finance, and controller permissions. Explicit Finance permissions
-- are included for databases that never ran the development Finance seed.
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT
  'rtp_fl_merge_' || permission."id",
  controller."id",
  permission."id"
FROM "role_templates" AS controller
JOIN "permissions" AS permission ON permission."isActive" = true
WHERE controller."code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'
  AND permission."code" <> 'INVENTORY.SHIPMENT.RECEIVE'
  AND (
    permission."code" IN (
      'BRANCH.READ',
      'AUDIT.READ',
      'AUDIT.EXPORT',
      'INVOICE.READ',
      'INVOICE.CREATE',
      'INVOICE.UPDATE',
      'INVOICE.FINALIZE',
      'INVOICE.PAYMENT',
      'INVOICE.CANCEL',
      'INVOICE.PROOF.READ',
      'PAYMENT.SUBMIT',
      'PAYMENT.VERIFY',
      'PAYMENT.REJECT',
      'PAYMENT.REFUND',
      'CASH_BANK.READ',
      'CASH_BANK.MANAGE',
      'OPENING_BALANCE.READ',
      'OPENING_BALANCE.MANAGE',
      'OPENING_BALANCE.POST',
      'EXPENSE.READ',
      'EXPENSE.CREATE',
      'EXPENSE.APPROVE',
      'EXPENSE.PAY',
      'ACCOUNT.READ',
      'ACCOUNT.MANAGE',
      'JOURNAL.READ',
      'JOURNAL.POST',
      'ACCOUNTING_PERIOD.READ',
      'ACCOUNTING_PERIOD.MANAGE',
      'INVENTORY.READ',
      'INVENTORY.VALUATION.READ',
      'INVENTORY.SHIPMENT.DISPATCH',
      'SUPPLIER.READ',
      'SUPPLIER.MANAGE',
      'PURCHASE_REQUEST.READ',
      'PURCHASE_REQUEST.CREATE',
      'PURCHASE_REQUEST.APPROVE',
      'PURCHASE_ORDER.READ',
      'PURCHASE_ORDER.CREATE',
      'GOODS_RECEIPT.READ',
      'AP.READ',
      'AP.INVOICE.POST',
      'AP.PAY',
      'DEFERRED_REVENUE.READ',
      'REVENUE.POLICY.MANAGE',
      'REVENUE.RECOGNIZE',
      'WORKFLOW.APPROVAL.READ'
    )
    OR EXISTS (
      SELECT 1
      FROM "role_template_permissions" AS source_permission
      JOIN "role_templates" AS source_template
        ON source_template."id" = source_permission."roleTemplateId"
      WHERE source_permission."permissionId" = permission."id"
        AND source_template."code" IN (
          'ADMIN_MANAGER_DEFAULT',
          'ADMIN_LOGISTIK_DEFAULT',
          'FINANCE_DUMMY',
          'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'
        )
    )
  )
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

-- Receiving is deliberately excluded: in the shipment flow this controller
-- dispatches the prepared shipment, while destination staff receive it.
DELETE FROM "role_template_permissions" AS assignment
USING "role_templates" AS template, "permissions" AS permission
WHERE assignment."roleTemplateId" = template."id"
  AND assignment."permissionId" = permission."id"
  AND template."code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'
  AND permission."code" = 'INVENTORY.SHIPMENT.RECEIVE';

UPDATE "users" AS finance
SET
  "role" = 'ADMIN_MANAGER',
  "roleTemplateId" = template."id",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "role_templates" AS template
WHERE finance."email" = 'finance@raho.id'
  AND template."code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT';

UPDATE "user_profiles" AS profile
SET
  "fullName" = 'Finance & Logistik RAHO',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "users" AS finance
WHERE finance."email" = 'finance@raho.id'
  AND profile."userId" = finance."id";

-- Copy the union of both legacy branch scopes to the retained Finance login.
WITH finance_user AS (
  SELECT "id" FROM "users" WHERE "email" = 'finance@raho.id'
), legacy_users AS (
  SELECT "id" FROM "users" WHERE "email" IN ('finance@raho.id', 'adminlogistik@raho.id')
), scoped_branches AS (
  SELECT "branchId" FROM "manager_branches" WHERE "userId" IN (SELECT "id" FROM legacy_users)
  UNION
  SELECT "branchId" FROM "staff_branches" WHERE "userId" IN (SELECT "id" FROM legacy_users)
  UNION
  SELECT "branchId" FROM "users"
  WHERE "id" IN (SELECT "id" FROM legacy_users) AND "branchId" IS NOT NULL
)
INSERT INTO "manager_branches" ("id", "userId", "branchId", "accessScope", "createdAt", "updatedAt")
SELECT
  'mb_finlog_' || md5(finance_user."id" || scoped_branches."branchId"),
  finance_user."id",
  scoped_branches."branchId",
  'FULL',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM finance_user
CROSS JOIN scoped_branches
ON CONFLICT ("userId", "branchId") DO UPDATE SET
  "accessScope" = 'FULL',
  "updatedAt" = CURRENT_TIMESTAMP;

WITH finance_user AS (
  SELECT "id" FROM "users" WHERE "email" = 'finance@raho.id'
), legacy_users AS (
  SELECT "id" FROM "users" WHERE "email" IN ('finance@raho.id', 'adminlogistik@raho.id')
), scoped_branches AS (
  SELECT "branchId" FROM "manager_branches" WHERE "userId" IN (SELECT "id" FROM legacy_users)
  UNION
  SELECT "branchId" FROM "staff_branches" WHERE "userId" IN (SELECT "id" FROM legacy_users)
  UNION
  SELECT "branchId" FROM "users"
  WHERE "id" IN (SELECT "id" FROM legacy_users) AND "branchId" IS NOT NULL
)
INSERT INTO "staff_branches" ("id", "userId", "branchId", "createdAt", "updatedAt")
SELECT
  'sb_finlog_' || md5(finance_user."id" || scoped_branches."branchId"),
  finance_user."id",
  scoped_branches."branchId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM finance_user
CROSS JOIN scoped_branches
ON CONFLICT ("userId", "branchId") DO NOTHING;

UPDATE "users"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = 'adminlogistik@raho.id'
  AND EXISTS (SELECT 1 FROM "users" WHERE "email" = 'finance@raho.id');
