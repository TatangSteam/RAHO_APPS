import {
  handleContactEvent,
  MEMBER_CONTACT_EVENT,
  PARTNERSHIP_CONTACT_EVENT,
  SUPPLIER_CONTACT_EVENT,
} from './zoho.contact.service';
import {
  BRANCH_LOCATION_EVENT,
  handleMasterEvent,
  MASTER_PRODUCT_ITEM_EVENT,
  PACKAGE_PRICING_ITEM_EVENT,
  STOCK_LOCATION_EVENT,
} from './zoho.master.service';
import { registerZohoEventHandler } from './zoho.worker';
import {
  handleInvoiceEvent,
  INVOICE_FINALIZED_EVENT,
  INVOICE_VOIDED_EVENT,
} from './zoho.invoice.service';
import {
  handlePaymentEvent,
  PAYMENT_REFUNDED_EVENT,
  PAYMENT_VERIFIED_EVENT,
} from './zoho.payment.service';
import {
  handleTreatmentCancellation,
  handleTreatmentCompleted,
} from './zoho.retainer.service';
import { EXPENSE_PAID_EVENT, handleExpensePaid } from './zoho.expense.service';
import {
  handlePartnershipGoodsShipped,
  handlePartnershipPaymentVerified,
} from './zoho.partnership.service';
import { PARTNERSHIP_PAYMENT_VERIFIED_EVENT } from './zoho.partnership.policy';
import { PARTNERSHIP_GOODS_SHIPPED_EVENT } from './zoho-routing.policy';
import {
  handlePurchaseOrderEvent,
} from './zoho.purchase-order.service';
import {
  PO_CANCELLED_EVENT,
  PO_ISSUED_EVENT,
} from './zoho.purchase-order.policy';
import {
  handleSupplierInvoicePosted,
} from './zoho.bill.service';
import {
  SUPPLIER_INVOICE_POSTED_EVENT,
} from './zoho.bill.policy';
import {
  handleSupplierPaymentRefunded,
  handleSupplierPaymentPosted,
} from './zoho.vendor-payment.service';
import {
  AP_PAYMENT_POSTED_EVENT,
  AP_PAYMENT_REFUNDED_EVENT,
} from './zoho.vendor-payment.policy';
import { handleInventoryAdjustmentEvent } from './zoho.inventory-adjustment.service';
import {
  INVENTORY_ADJUSTMENT_POSTED_EVENT,
  STOCK_OPNAME_POSTED_EVENT,
  TREATMENT_INVENTORY_CONSUMED_EVENT,
  TREATMENT_INVENTORY_REVERSED_EVENT,
} from './zoho.inventory-adjustment.policy';

let registered = false;

export function registerZohoHandlers(): void {
  if (registered) return;
  registerZohoEventHandler(MEMBER_CONTACT_EVENT, handleContactEvent);
  registerZohoEventHandler(SUPPLIER_CONTACT_EVENT, handleContactEvent);
  registerZohoEventHandler(PARTNERSHIP_CONTACT_EVENT, handleContactEvent);
  registerZohoEventHandler(MASTER_PRODUCT_ITEM_EVENT, handleMasterEvent);
  registerZohoEventHandler(PACKAGE_PRICING_ITEM_EVENT, handleMasterEvent);
  registerZohoEventHandler(BRANCH_LOCATION_EVENT, handleMasterEvent);
  registerZohoEventHandler(STOCK_LOCATION_EVENT, handleMasterEvent);
  registerZohoEventHandler(INVOICE_FINALIZED_EVENT, handleInvoiceEvent);
  registerZohoEventHandler(INVOICE_VOIDED_EVENT, handleInvoiceEvent);
  registerZohoEventHandler(PAYMENT_VERIFIED_EVENT, handlePaymentEvent);
  registerZohoEventHandler(PAYMENT_REFUNDED_EVENT, handlePaymentEvent);
  registerZohoEventHandler('TREATMENT_COMPLETED', handleTreatmentCompleted);
  registerZohoEventHandler('TREATMENT_COMPLETION_CANCELLED', handleTreatmentCancellation);
  registerZohoEventHandler(EXPENSE_PAID_EVENT, handleExpensePaid);
  registerZohoEventHandler(PARTNERSHIP_GOODS_SHIPPED_EVENT, handlePartnershipGoodsShipped);
  registerZohoEventHandler(PARTNERSHIP_PAYMENT_VERIFIED_EVENT, handlePartnershipPaymentVerified);
  registerZohoEventHandler(PO_ISSUED_EVENT, handlePurchaseOrderEvent);
  registerZohoEventHandler(PO_CANCELLED_EVENT, handlePurchaseOrderEvent);
  registerZohoEventHandler(SUPPLIER_INVOICE_POSTED_EVENT, handleSupplierInvoicePosted);
  registerZohoEventHandler(AP_PAYMENT_POSTED_EVENT, handleSupplierPaymentPosted);
  registerZohoEventHandler(AP_PAYMENT_REFUNDED_EVENT, handleSupplierPaymentRefunded);
  registerZohoEventHandler(TREATMENT_INVENTORY_CONSUMED_EVENT, handleInventoryAdjustmentEvent);
  registerZohoEventHandler(TREATMENT_INVENTORY_REVERSED_EVENT, handleInventoryAdjustmentEvent);
  registerZohoEventHandler(INVENTORY_ADJUSTMENT_POSTED_EVENT, handleInventoryAdjustmentEvent);
  registerZohoEventHandler(STOCK_OPNAME_POSTED_EVENT, handleInventoryAdjustmentEvent);
  registered = true;
}
