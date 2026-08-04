import { ensureContactExternalIdField, runDiscovery } from './zoho.discovery.service';
import { ensureDefaultItemAccountMappings } from './zoho.master.service';

export async function setupZohoReadiness() {
  const contactExternalIdField = await ensureContactExternalIdField();
  const discovery = await runDiscovery();
  const itemAccountMappings = await ensureDefaultItemAccountMappings();
  return { contactExternalIdField, itemAccountMappings, discovery };
}
