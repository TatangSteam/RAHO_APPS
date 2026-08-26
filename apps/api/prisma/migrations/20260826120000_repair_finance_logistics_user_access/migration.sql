-- Repair accounts created as FINANCE_LOGISTICS_CONTROLLER before role/template
-- synchronization was enforced. This migration preserves users and history.

UPDATE "role_templates"
SET
  "baseRole" = 'FINANCE_LOGISTICS_CONTROLLER',
  "name" = 'Finance & Logistics Controller',
  "isSystem" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT';

-- Rebuild the effective permission union in case the account was created on a
-- database whose earlier seed/migration only populated part of the template.
INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT
  'rtp_flc_repair_' || md5(controller."id" || permission."id"),
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
      'TREATMENT.COMPLETION.REVERSE',
      'AP.READ',
      'AP.INVOICE.POST',
      'AP.PAY',
      'DEFERRED_REVENUE.READ',
      'REVENUE.POLICY.MANAGE',
      'REVENUE.RECOGNIZE',
      'WORKFLOW.APPROVAL.READ',
      'ZOHO.SYNC.READ',
      'ZOHO.SYNC.RETRY',
      'ZOHO.RECONCILE.RUN'
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

-- Attach the correct IAM template to every controller account, including
-- accounts already created through Quick Actions.
UPDATE "users" AS target
SET
  "roleTemplateId" = template."id",
  "branchId" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "role_templates" AS template
WHERE target."role" = 'FINANCE_LOGISTICS_CONTROLLER'
  AND template."code" = 'FINANCE_LOGISTICS_CONTROLLER_DEFAULT'
  AND target."roleTemplateId" IS DISTINCT FROM template."id";

-- Controller access is global across active operational branches. Add missing
-- scope rows only; no historical scope or transaction data is removed.
INSERT INTO "manager_branches" ("id", "userId", "branchId", "accessScope", "createdAt", "updatedAt")
SELECT
  'mb_flc_repair_' || md5(target."id" || branch."id"),
  target."id",
  branch."id",
  'FULL',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" AS target
CROSS JOIN "branches" AS branch
WHERE target."role" = 'FINANCE_LOGISTICS_CONTROLLER'
  AND target."isActive" = true
  AND branch."isActive" = true
  AND branch."branchCode" <> 'EXT'
ON CONFLICT ("userId", "branchId") DO UPDATE SET
  "accessScope" = 'FULL',
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "staff_branches" ("id", "userId", "branchId", "createdAt", "updatedAt")
SELECT
  'sb_flc_repair_' || md5(target."id" || branch."id"),
  target."id",
  branch."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" AS target
CROSS JOIN "branches" AS branch
WHERE target."role" = 'FINANCE_LOGISTICS_CONTROLLER'
  AND target."isActive" = true
  AND branch."isActive" = true
  AND branch."branchCode" <> 'EXT'
ON CONFLICT ("userId", "branchId") DO NOTHING;
