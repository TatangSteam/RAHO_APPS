-- AddEnumValue
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN_LOGISTIK' BEFORE 'DOCTOR';

-- CreateEnum
CREATE TYPE "HomecareBagStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'IN_CHECKING', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "HomecareTeamMemberRole" AS ENUM ('ADMIN_LAYANAN', 'DOCTOR', 'NURSE', 'DRIVER', 'OTHER');

-- CreateEnum
CREATE TYPE "HomecareBagRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PREPARING', 'SHIPPED', 'RECEIVED', 'RECEIVED_WITH_ISSUE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HomecareBagUsageStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HomecareBagOpnameStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogisticLocationType" AS ENUM ('CENTRAL_STOCK', 'BRANCH_STOCK', 'HOMECARE_BAG');

-- CreateEnum
CREATE TYPE "LogisticTransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT', 'REQUEST_APPROVAL', 'SHIPMENT', 'RECEIVE_SHIPMENT', 'BAG_USAGE', 'BAG_RETURN', 'STOCK_OPNAME');

-- CreateEnum
CREATE TYPE "LogisticTransactionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "homecare_teams" (
    "id" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "HomecareTeamMemberRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "homecare_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bags" (
    "id" TEXT NOT NULL,
    "bagCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "HomecareBagStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_stocks" (
    "id" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "stock" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "minThreshold" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bag_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_stock_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "HomecareBagRequestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requestNotes" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "preparedBy" TEXT,
    "preparedAt" TIMESTAMP(3),
    "shippedBy" TEXT,
    "shippedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivingNotes" TEXT,
    "supportFileUrl" TEXT,
    "supportFileName" TEXT,
    "supportFileSize" INTEGER,
    "supportFileMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bag_stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_stock_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "requestedQty" DECIMAL(10,4) NOT NULL,
    "approvedQty" DECIMAL(10,4),
    "finalQty" DECIMAL(10,4),
    "notes" TEXT,

    CONSTRAINT "homecare_bag_stock_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_shipments" (
    "id" TEXT NOT NULL,
    "shipmentCode" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBagId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PREPARING',
    "shippedBy" TEXT,
    "shippedAt" TIMESTAMP(3),
    "shipmentPhotoUrl" TEXT,
    "shipmentPhotoName" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedUserId" TEXT,
    "receiptFileUrl" TEXT,
    "receiptFileName" TEXT,
    "receiptFileSize" INTEGER,
    "receiptMimeType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bag_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "sentQty" DECIMAL(10,4) NOT NULL,
    "receivedQty" DECIMAL(10,4),
    "discrepancyType" "DiscrepancyType",
    "discrepancyNotes" TEXT,
    "photoUrl" TEXT,
    "photoFileName" TEXT,

    CONSTRAINT "homecare_bag_shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_usages" (
    "id" TEXT NOT NULL,
    "usageCode" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "treatmentSessionId" TEXT,
    "usedBy" TEXT NOT NULL,
    "status" "HomecareBagUsageStatus" NOT NULL DEFAULT 'COMPLETED',
    "usageDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL,
    "supportFileUrl" TEXT,
    "supportFileName" TEXT,
    "supportFileSize" INTEGER,
    "supportFileMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bag_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_usage_items" (
    "id" TEXT NOT NULL,
    "usageId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" TEXT,
    "notes" TEXT,

    CONSTRAINT "homecare_bag_usage_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_returns" (
    "id" TEXT NOT NULL,
    "returnCode" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "returnedBy" TEXT NOT NULL,
    "receivedBy" TEXT,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL,
    "supportFileUrl" TEXT,
    "supportFileName" TEXT,
    "supportFileSize" INTEGER,
    "supportFileMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bag_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "isReusable" BOOLEAN NOT NULL DEFAULT true,
    "condition" TEXT,
    "notes" TEXT,

    CONSTRAINT "homecare_bag_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_opnames" (
    "id" TEXT NOT NULL,
    "opnameCode" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "HomecareBagOpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "checkedBy" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL,
    "supportFileUrl" TEXT,
    "supportFileName" TEXT,
    "supportFileSize" INTEGER,
    "supportFileMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homecare_bag_opnames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homecare_bag_opname_items" (
    "id" TEXT NOT NULL,
    "opnameId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "systemQty" DECIMAL(10,4) NOT NULL,
    "physicalQty" DECIMAL(10,4) NOT NULL,
    "difference" DECIMAL(10,4) NOT NULL,
    "adjustmentCreated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "homecare_bag_opname_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistic_stock_transactions" (
    "id" TEXT NOT NULL,
    "transactionCode" TEXT NOT NULL,
    "type" "LogisticTransactionType" NOT NULL,
    "status" "LogisticTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "sourceType" "LogisticLocationType",
    "sourceId" TEXT,
    "destinationType" "LogisticLocationType",
    "destinationId" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "notes" TEXT NOT NULL,
    "supportFileUrl" TEXT,
    "supportFileName" TEXT,
    "supportFileSize" INTEGER,
    "supportFileMimeType" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistic_stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistic_stock_transaction_items" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "masterProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "sourceStockBefore" DECIMAL(10,4),
    "sourceStockAfter" DECIMAL(10,4),
    "destinationStockBefore" DECIMAL(10,4),
    "destinationStockAfter" DECIMAL(10,4),
    "notes" TEXT,

    CONSTRAINT "logistic_stock_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistic_stock_mutations" (
    "id" TEXT NOT NULL,
    "mutationCode" TEXT NOT NULL,
    "locationType" "LogisticLocationType" NOT NULL,
    "locationId" TEXT NOT NULL,
    "homecareBagId" TEXT,
    "masterProductId" TEXT NOT NULL,
    "type" "LogisticTransactionType" NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "stockBefore" DECIMAL(10,4) NOT NULL,
    "stockAfter" DECIMAL(10,4) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistic_stock_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "homecare_teams_teamCode_key" ON "homecare_teams"("teamCode");

-- CreateIndex
CREATE INDEX "homecare_teams_branchId_isActive_idx" ON "homecare_teams"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "homecare_teams_teamCode_idx" ON "homecare_teams"("teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_team_members_teamId_userId_key" ON "homecare_team_members"("teamId", "userId");

-- CreateIndex
CREATE INDEX "homecare_team_members_teamId_idx" ON "homecare_team_members"("teamId");

-- CreateIndex
CREATE INDEX "homecare_team_members_userId_idx" ON "homecare_team_members"("userId");

-- CreateIndex
CREATE INDEX "homecare_team_members_role_idx" ON "homecare_team_members"("role");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bags_bagCode_key" ON "homecare_bags"("bagCode");

-- CreateIndex
CREATE INDEX "homecare_bags_teamId_idx" ON "homecare_bags"("teamId");

-- CreateIndex
CREATE INDEX "homecare_bags_branchId_idx" ON "homecare_bags"("branchId");

-- CreateIndex
CREATE INDEX "homecare_bags_status_idx" ON "homecare_bags"("status");

-- CreateIndex
CREATE INDEX "homecare_bags_isActive_idx" ON "homecare_bags"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_stocks_bagId_masterProductId_key" ON "homecare_bag_stocks"("bagId", "masterProductId");

-- CreateIndex
CREATE INDEX "homecare_bag_stocks_bagId_idx" ON "homecare_bag_stocks"("bagId");

-- CreateIndex
CREATE INDEX "homecare_bag_stocks_masterProductId_idx" ON "homecare_bag_stocks"("masterProductId");

-- CreateIndex
CREATE INDEX "homecare_bag_stocks_bagId_stock_idx" ON "homecare_bag_stocks"("bagId", "stock");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_stock_requests_requestCode_key" ON "homecare_bag_stock_requests"("requestCode");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_requests_teamId_status_idx" ON "homecare_bag_stock_requests"("teamId", "status");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_requests_bagId_status_idx" ON "homecare_bag_stock_requests"("bagId", "status");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_requests_branchId_status_idx" ON "homecare_bag_stock_requests"("branchId", "status");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_requests_requestedBy_idx" ON "homecare_bag_stock_requests"("requestedBy");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_requests_createdAt_idx" ON "homecare_bag_stock_requests"("createdAt");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_request_items_requestId_idx" ON "homecare_bag_stock_request_items"("requestId");

-- CreateIndex
CREATE INDEX "homecare_bag_stock_request_items_masterProductId_idx" ON "homecare_bag_stock_request_items"("masterProductId");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_shipments_shipmentCode_key" ON "homecare_bag_shipments"("shipmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_shipments_requestId_key" ON "homecare_bag_shipments"("requestId");

-- CreateIndex
CREATE INDEX "homecare_bag_shipments_fromBranchId_idx" ON "homecare_bag_shipments"("fromBranchId");

-- CreateIndex
CREATE INDEX "homecare_bag_shipments_toBagId_status_idx" ON "homecare_bag_shipments"("toBagId", "status");

-- CreateIndex
CREATE INDEX "homecare_bag_shipments_status_idx" ON "homecare_bag_shipments"("status");

-- CreateIndex
CREATE INDEX "homecare_bag_shipments_shippedAt_idx" ON "homecare_bag_shipments"("shippedAt");

-- CreateIndex
CREATE INDEX "homecare_bag_shipment_items_shipmentId_idx" ON "homecare_bag_shipment_items"("shipmentId");

-- CreateIndex
CREATE INDEX "homecare_bag_shipment_items_masterProductId_idx" ON "homecare_bag_shipment_items"("masterProductId");

-- CreateIndex
CREATE INDEX "homecare_bag_shipment_items_discrepancyType_idx" ON "homecare_bag_shipment_items"("discrepancyType");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_usages_usageCode_key" ON "homecare_bag_usages"("usageCode");

-- CreateIndex
CREATE INDEX "homecare_bag_usages_bagId_idx" ON "homecare_bag_usages"("bagId");

-- CreateIndex
CREATE INDEX "homecare_bag_usages_teamId_idx" ON "homecare_bag_usages"("teamId");

-- CreateIndex
CREATE INDEX "homecare_bag_usages_usedBy_idx" ON "homecare_bag_usages"("usedBy");

-- CreateIndex
CREATE INDEX "homecare_bag_usages_treatmentSessionId_idx" ON "homecare_bag_usages"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "homecare_bag_usages_usageDate_idx" ON "homecare_bag_usages"("usageDate");

-- CreateIndex
CREATE INDEX "homecare_bag_usage_items_usageId_idx" ON "homecare_bag_usage_items"("usageId");

-- CreateIndex
CREATE INDEX "homecare_bag_usage_items_masterProductId_idx" ON "homecare_bag_usage_items"("masterProductId");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_returns_returnCode_key" ON "homecare_bag_returns"("returnCode");

-- CreateIndex
CREATE INDEX "homecare_bag_returns_bagId_idx" ON "homecare_bag_returns"("bagId");

-- CreateIndex
CREATE INDEX "homecare_bag_returns_teamId_idx" ON "homecare_bag_returns"("teamId");

-- CreateIndex
CREATE INDEX "homecare_bag_returns_toBranchId_idx" ON "homecare_bag_returns"("toBranchId");

-- CreateIndex
CREATE INDEX "homecare_bag_returns_returnedBy_idx" ON "homecare_bag_returns"("returnedBy");

-- CreateIndex
CREATE INDEX "homecare_bag_returns_receivedAt_idx" ON "homecare_bag_returns"("receivedAt");

-- CreateIndex
CREATE INDEX "homecare_bag_return_items_returnId_idx" ON "homecare_bag_return_items"("returnId");

-- CreateIndex
CREATE INDEX "homecare_bag_return_items_masterProductId_idx" ON "homecare_bag_return_items"("masterProductId");

-- CreateIndex
CREATE UNIQUE INDEX "homecare_bag_opnames_opnameCode_key" ON "homecare_bag_opnames"("opnameCode");

-- CreateIndex
CREATE INDEX "homecare_bag_opnames_bagId_idx" ON "homecare_bag_opnames"("bagId");

-- CreateIndex
CREATE INDEX "homecare_bag_opnames_teamId_idx" ON "homecare_bag_opnames"("teamId");

-- CreateIndex
CREATE INDEX "homecare_bag_opnames_checkedBy_idx" ON "homecare_bag_opnames"("checkedBy");

-- CreateIndex
CREATE INDEX "homecare_bag_opnames_checkedAt_idx" ON "homecare_bag_opnames"("checkedAt");

-- CreateIndex
CREATE INDEX "homecare_bag_opname_items_opnameId_idx" ON "homecare_bag_opname_items"("opnameId");

-- CreateIndex
CREATE INDEX "homecare_bag_opname_items_masterProductId_idx" ON "homecare_bag_opname_items"("masterProductId");

-- CreateIndex
CREATE UNIQUE INDEX "logistic_stock_transactions_transactionCode_key" ON "logistic_stock_transactions"("transactionCode");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_type_idx" ON "logistic_stock_transactions"("type");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_status_idx" ON "logistic_stock_transactions"("status");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_sourceType_sourceId_idx" ON "logistic_stock_transactions"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_destinationType_destinationId_idx" ON "logistic_stock_transactions"("destinationType", "destinationId");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_referenceType_referenceId_idx" ON "logistic_stock_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_createdBy_idx" ON "logistic_stock_transactions"("createdBy");

-- CreateIndex
CREATE INDEX "logistic_stock_transactions_createdAt_idx" ON "logistic_stock_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "logistic_stock_transaction_items_transactionId_idx" ON "logistic_stock_transaction_items"("transactionId");

-- CreateIndex
CREATE INDEX "logistic_stock_transaction_items_masterProductId_idx" ON "logistic_stock_transaction_items"("masterProductId");

-- CreateIndex
CREATE UNIQUE INDEX "logistic_stock_mutations_mutationCode_key" ON "logistic_stock_mutations"("mutationCode");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_locationType_locationId_idx" ON "logistic_stock_mutations"("locationType", "locationId");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_homecareBagId_idx" ON "logistic_stock_mutations"("homecareBagId");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_masterProductId_idx" ON "logistic_stock_mutations"("masterProductId");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_type_idx" ON "logistic_stock_mutations"("type");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_referenceType_referenceId_idx" ON "logistic_stock_mutations"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_createdBy_idx" ON "logistic_stock_mutations"("createdBy");

-- CreateIndex
CREATE INDEX "logistic_stock_mutations_createdAt_idx" ON "logistic_stock_mutations"("createdAt");

-- AddForeignKey
ALTER TABLE "homecare_team_members" ADD CONSTRAINT "homecare_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "homecare_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bags" ADD CONSTRAINT "homecare_bags_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "homecare_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_stocks" ADD CONSTRAINT "homecare_bag_stocks_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "homecare_bags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_stock_requests" ADD CONSTRAINT "homecare_bag_stock_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "homecare_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_stock_requests" ADD CONSTRAINT "homecare_bag_stock_requests_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_stock_request_items" ADD CONSTRAINT "homecare_bag_stock_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "homecare_bag_stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_shipments" ADD CONSTRAINT "homecare_bag_shipments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "homecare_bag_stock_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_shipments" ADD CONSTRAINT "homecare_bag_shipments_toBagId_fkey" FOREIGN KEY ("toBagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_shipment_items" ADD CONSTRAINT "homecare_bag_shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "homecare_bag_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_usages" ADD CONSTRAINT "homecare_bag_usages_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_usage_items" ADD CONSTRAINT "homecare_bag_usage_items_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "homecare_bag_usages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_returns" ADD CONSTRAINT "homecare_bag_returns_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_return_items" ADD CONSTRAINT "homecare_bag_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "homecare_bag_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_opnames" ADD CONSTRAINT "homecare_bag_opnames_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "homecare_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homecare_bag_opname_items" ADD CONSTRAINT "homecare_bag_opname_items_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "homecare_bag_opnames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistic_stock_transaction_items" ADD CONSTRAINT "logistic_stock_transaction_items_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "logistic_stock_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistic_stock_mutations" ADD CONSTRAINT "logistic_stock_mutations_homecareBagId_fkey" FOREIGN KEY ("homecareBagId") REFERENCES "homecare_bags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
