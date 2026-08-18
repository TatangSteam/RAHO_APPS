-- DropForeignKey
ALTER TABLE "encounters" DROP CONSTRAINT "encounters_memberPackageId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_payments" DROP CONSTRAINT "invoice_payments_verifiedBy_fkey";

-- DropIndex
DROP INDEX "cash_bank_transactions_journalEntryId_idx";

-- DropIndex
DROP INDEX "integration_events_leaseUntil_idx";

-- DropIndex
DROP INDEX "integration_events_payloadHash_idx";

-- DropIndex
DROP INDEX "material_usages_treatmentSessionId_idx";

-- DropIndex
DROP INDEX "member_packages_revenueFlowVersion_idx";

-- AlterTable
ALTER TABLE "approval_instances" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "approval_rules" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_adjustment_reason_codes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_adjustments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "material_usages" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_kit_components" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_opname_lines" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_opnames" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "approval_audit_logs" RENAME CONSTRAINT "approval_audit_logs_actor_fkey" TO "approval_audit_logs_actorUserId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_audit_logs" RENAME CONSTRAINT "approval_audit_logs_instance_fkey" TO "approval_audit_logs_approvalInstanceId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_decisions" RENAME CONSTRAINT "approval_decisions_approver_fkey" TO "approval_decisions_approverUserId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_decisions" RENAME CONSTRAINT "approval_decisions_instance_fkey" TO "approval_decisions_approvalInstanceId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_instances" RENAME CONSTRAINT "approval_instances_branch_fkey" TO "approval_instances_branchId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_instances" RENAME CONSTRAINT "approval_instances_maker_fkey" TO "approval_instances_makerUserId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_instances" RENAME CONSTRAINT "approval_instances_rule_fkey" TO "approval_instances_approvalRuleId_fkey";

-- RenameForeignKey
ALTER TABLE "approval_rule_steps" RENAME CONSTRAINT "approval_rule_steps_rule_fkey" TO "approval_rule_steps_approvalRuleId_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_adjustment_lines" RENAME CONSTRAINT "inventory_adjustment_lines_adjustment_fkey" TO "inventory_adjustment_lines_inventoryAdjustmentId_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_adjustments" RENAME CONSTRAINT "inventory_adjustments_approval_fkey" TO "inventory_adjustments_approvalInstanceId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opname_lines" RENAME CONSTRAINT "stock_opname_lines_batch_fkey" TO "stock_opname_lines_batchId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opname_lines" RENAME CONSTRAINT "stock_opname_lines_inventory_posting_fkey" TO "stock_opname_lines_inventoryPostingId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opname_lines" RENAME CONSTRAINT "stock_opname_lines_item_fkey" TO "stock_opname_lines_inventoryItemId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opname_lines" RENAME CONSTRAINT "stock_opname_lines_location_fkey" TO "stock_opname_lines_stockLocationId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opname_lines" RENAME CONSTRAINT "stock_opname_lines_opname_fkey" TO "stock_opname_lines_stockOpnameId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opname_lines" RENAME CONSTRAINT "stock_opname_lines_stock_mutation_fkey" TO "stock_opname_lines_stockMutationId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opnames" RENAME CONSTRAINT "stock_opnames_approval_fkey" TO "stock_opnames_approvalInstanceId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opnames" RENAME CONSTRAINT "stock_opnames_branch_fkey" TO "stock_opnames_branchId_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opnames" RENAME CONSTRAINT "stock_opnames_creator_fkey" TO "stock_opnames_createdBy_fkey";

-- RenameForeignKey
ALTER TABLE "stock_opnames" RENAME CONSTRAINT "stock_opnames_journal_fkey" TO "stock_opnames_journalEntryId_fkey";

-- RenameForeignKey
ALTER TABLE "zoho_discovery_cache" RENAME CONSTRAINT "zoho_discovery_cache_connection_fkey" TO "zoho_discovery_cache_zohoConnectionId_fkey";

-- RenameForeignKey
ALTER TABLE "zoho_entity_mappings" RENAME CONSTRAINT "zoho_entity_mappings_connection_fkey" TO "zoho_entity_mappings_zohoConnectionId_fkey";

-- RenameForeignKey
ALTER TABLE "zoho_mapping_reviews" RENAME CONSTRAINT "zoho_mapping_reviews_connection_fkey" TO "zoho_mapping_reviews_zohoConnectionId_fkey";

-- RenameForeignKey
ALTER TABLE "zoho_sync_attempts" RENAME CONSTRAINT "zoho_sync_attempts_event_fkey" TO "zoho_sync_attempts_integrationEventId_fkey";

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "member_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "deferred_revenue_movements_invoicePaymentId_memberPackageId_typ" RENAME TO "deferred_revenue_movements_invoicePaymentId_memberPackageId_key";

-- RenameIndex
ALTER INDEX "inventory_cost_allocations_postingId_stockMutationId_costLayerI" RENAME TO "inventory_cost_allocations_postingId_stockMutationId_costLa_key";

-- RenameIndex
ALTER INDEX "journal_source_links_journalEntryId_sourceType_sourceId_relatio" RENAME TO "journal_source_links_journalEntryId_sourceType_sourceId_rel_key";

-- RenameIndex
ALTER INDEX "shipment_receipt_items_receipt_item_layer_key" RENAME TO "shipment_receipt_items_shipmentReceiptId_shipmentItemId_tra_key";

-- RenameIndex
ALTER INDEX "stock_opname_lines_stockOpnameId_inventoryItemId_stockLocationI" RENAME TO "stock_opname_lines_stockOpnameId_inventoryItemId_stockLocat_key";

-- RenameIndex
ALTER INDEX "supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemId_ke" RENAME TO "supplier_invoice_lines_supplierInvoiceId_purchaseOrderItemI_key";

-- RenameIndex
ALTER INDEX "zoho_discovery_cache_resource_key" RENAME TO "zoho_discovery_cache_zohoConnectionId_resourceType_zohoId_key";

-- RenameIndex
ALTER INDEX "zoho_discovery_cache_type_active_name_idx" RENAME TO "zoho_discovery_cache_resourceType_isActive_name_idx";

-- RenameIndex
ALTER INDEX "zoho_entity_mappings_external_key" RENAME TO "zoho_entity_mappings_zohoConnectionId_zohoEntityType_zohoEn_key";

-- RenameIndex
ALTER INDEX "zoho_entity_mappings_local_key" RENAME TO "zoho_entity_mappings_zohoConnectionId_entityType_localEntit_key";

-- RenameIndex
ALTER INDEX "zoho_entity_mappings_zohoConnectionId_entityType_externalKey_ke" RENAME TO "zoho_entity_mappings_zohoConnectionId_entityType_externalKe_key";

-- RenameIndex
ALTER INDEX "zoho_mapping_reviews_local_key" RENAME TO "zoho_mapping_reviews_zohoConnectionId_entityType_localEntit_key";

-- RenameIndex
ALTER INDEX "zoho_mapping_reviews_status_type_created_idx" RENAME TO "zoho_mapping_reviews_status_entityType_createdAt_idx";

-- RenameIndex
ALTER INDEX "zoho_reconciliation_results_runId_entityType_localEntityId_zoho" RENAME TO "zoho_reconciliation_results_runId_entityType_localEntityId__key";

-- RenameIndex
ALTER INDEX "zoho_sync_attempts_event_attempt_key" RENAME TO "zoho_sync_attempts_integrationEventId_attemptNo_key";
