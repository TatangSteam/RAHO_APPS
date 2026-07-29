import {
  handleContactEvent,
  MEMBER_CONTACT_EVENT,
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

let registered = false;

export function registerZohoHandlers(): void {
  if (registered) return;
  registerZohoEventHandler(MEMBER_CONTACT_EVENT, handleContactEvent);
  registerZohoEventHandler(SUPPLIER_CONTACT_EVENT, handleContactEvent);
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
  registered = true;
}
