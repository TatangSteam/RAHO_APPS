ALTER TABLE "shipment_items"
  ADD CONSTRAINT "shipment_items_receiving_quantity_check" CHECK (
    "sentQty" >= 0
    AND ("receivedQty" IS NULL OR ("receivedQty" >= 0 AND "receivedQty" <= "sentQty"))
    AND "quarantineQty" >= 0
    AND "quarantineQty" <= COALESCE("receivedQty", 0)
  );

ALTER TABLE "shipment_discrepancies"
  ADD CONSTRAINT "shipment_discrepancies_quantity_check" CHECK (
    "expectedQty" >= 0
    AND "receivedQty" >= 0
    AND "quarantinedQty" >= 0
    AND "quarantinedQty" <= "receivedQty"
  );
