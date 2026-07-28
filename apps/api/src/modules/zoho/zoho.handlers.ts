import {
  handleContactEvent,
  MEMBER_CONTACT_EVENT,
  SUPPLIER_CONTACT_EVENT,
} from './zoho.contact.service';
import { registerZohoEventHandler } from './zoho.worker';

let registered = false;

export function registerZohoHandlers(): void {
  if (registered) return;
  registerZohoEventHandler(MEMBER_CONTACT_EVENT, handleContactEvent);
  registerZohoEventHandler(SUPPLIER_CONTACT_EVENT, handleContactEvent);
  registered = true;
}
