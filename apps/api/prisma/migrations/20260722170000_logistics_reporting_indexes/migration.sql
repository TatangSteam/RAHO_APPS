-- Sprint 10 reporting indexes. Reports remain ledger-backed; no snapshot table is introduced.
CREATE INDEX "material_usages_status_consumedAt_idx" ON "material_usages"("status", "consumedAt");
CREATE INDEX "stock_requests_branchId_createdAt_idx" ON "stock_requests"("branchId", "createdAt");
CREATE INDEX "shipments_fromBranchId_createdAt_idx" ON "shipments"("fromBranchId", "createdAt");
CREATE INDEX "shipments_toBranchId_createdAt_idx" ON "shipments"("toBranchId", "createdAt");
CREATE INDEX "shipment_discrepancies_shipmentId_createdAt_idx" ON "shipment_discrepancies"("shipmentId", "createdAt");
CREATE INDEX "stock_mutations_inventoryItemId_inventoryPostingId_idx" ON "stock_mutations"("inventoryItemId", "inventoryPostingId");
