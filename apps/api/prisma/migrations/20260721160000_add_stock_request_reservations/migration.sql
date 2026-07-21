ALTER TYPE "StockRequestStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_APPROVED';
ALTER TYPE "StockRequestStatus" ADD VALUE IF NOT EXISTS 'RESERVATION_RELEASED';

CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED');

ALTER TABLE "stock_requests"
  ADD COLUMN "sourceBranchId" TEXT,
  ADD COLUMN "approvalIdempotencyKey" TEXT,
  ADD COLUMN "approvalPayloadHash" TEXT,
  ADD COLUMN "releaseIdempotencyKey" TEXT,
  ADD COLUMN "releasePayloadHash" TEXT,
  ADD COLUMN "reservationReleasedAt" TIMESTAMP(3);

CREATE TABLE "stock_reservations" (
  "id" TEXT NOT NULL,
  "stockRequestId" TEXT NOT NULL,
  "stockRequestItemId" TEXT NOT NULL,
  "inventoryBalanceId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "releasedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "reservedBy" TEXT NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedBy" TEXT,
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_requests_approvalIdempotencyKey_key"
  ON "stock_requests"("approvalIdempotencyKey");
CREATE UNIQUE INDEX "stock_requests_releaseIdempotencyKey_key"
  ON "stock_requests"("releaseIdempotencyKey");
CREATE INDEX "stock_requests_sourceBranchId_status_idx"
  ON "stock_requests"("sourceBranchId", "status");
CREATE UNIQUE INDEX "stock_reservations_stockRequestItemId_inventoryBalanceId_key"
  ON "stock_reservations"("stockRequestItemId", "inventoryBalanceId");
CREATE INDEX "stock_reservations_stockRequestId_status_idx"
  ON "stock_reservations"("stockRequestId", "status");
CREATE INDEX "stock_reservations_inventoryBalanceId_status_idx"
  ON "stock_reservations"("inventoryBalanceId", "status");

ALTER TABLE "stock_requests"
  ADD CONSTRAINT "stock_requests_sourceBranchId_fkey"
  FOREIGN KEY ("sourceBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_stockRequestId_fkey"
  FOREIGN KEY ("stockRequestId") REFERENCES "stock_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_stockRequestItemId_fkey"
  FOREIGN KEY ("stockRequestItemId") REFERENCES "stock_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_inventoryBalanceId_fkey"
  FOREIGN KEY ("inventoryBalanceId") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "isSensitive", "updatedAt") VALUES
  ('perm_inventory_request_read', 'INVENTORY.REQUEST.READ', 'Lihat Stock Request', 'INVENTORY', 'Melihat stock request dan reservation sesuai branch scope.', false, CURRENT_TIMESTAMP),
  ('perm_inventory_request_create', 'INVENTORY.REQUEST.CREATE', 'Buat Stock Request', 'INVENTORY', 'Membuat stock request untuk cabang sendiri.', false, CURRENT_TIMESTAMP),
  ('perm_inventory_request_approve', 'INVENTORY.REQUEST.APPROVE', 'Approve Stock Request', 'INVENTORY', 'Menyetujui penuh atau parsial stock request.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_reserve', 'INVENTORY.RESERVATION.CREATE', 'Reserve Stock', 'INVENTORY', 'Mengunci available quantity untuk stock request.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_reservation_release', 'INVENTORY.RESERVATION.RELEASE', 'Release Reservation', 'INVENTORY', 'Melepas reservation stock request.', true, CURRENT_TIMESTAMP),
  ('perm_inventory_opening_post', 'INVENTORY.OPENING.POST', 'Posting Opening Stock', 'INVENTORY', 'Memposting opening stock bernilai dan membentuk cost layer.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s4_super_' || p."id", 'rt_super_admin', p."id"
FROM "permissions" p
WHERE p."code" IN (
  'INVENTORY.REQUEST.READ', 'INVENTORY.REQUEST.CREATE', 'INVENTORY.REQUEST.APPROVE',
  'INVENTORY.RESERVATION.CREATE', 'INVENTORY.RESERVATION.RELEASE', 'INVENTORY.OPENING.POST'
)
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s4_manager_' || p."id", 'rt_admin_manager', p."id"
FROM "permissions" p
WHERE p."code" IN (
  'INVENTORY.REQUEST.READ', 'INVENTORY.REQUEST.CREATE', 'INVENTORY.REQUEST.APPROVE',
  'INVENTORY.RESERVATION.CREATE', 'INVENTORY.RESERVATION.RELEASE', 'INVENTORY.OPENING.POST'
)
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s4_logistik_' || p."id", 'rt_admin_logistik', p."id"
FROM "permissions" p
WHERE p."code" IN (
  'INVENTORY.REQUEST.READ', 'INVENTORY.REQUEST.APPROVE', 'INVENTORY.RESERVATION.CREATE',
  'INVENTORY.RESERVATION.RELEASE', 'INVENTORY.OPENING.POST'
)
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;

INSERT INTO "role_template_permissions" ("id", "roleTemplateId", "permissionId")
SELECT 'rtp_s4_cabang_' || p."id", 'rt_admin_cabang', p."id"
FROM "permissions" p
WHERE p."code" IN ('INVENTORY.REQUEST.READ', 'INVENTORY.REQUEST.CREATE')
ON CONFLICT ("roleTemplateId", "permissionId") DO NOTHING;
