import { ensureContactExternalIdField, runDiscovery } from './zoho.discovery.service';
import { ensureDefaultItemAccountMappings, ensureDefaultUomMappings } from './zoho.master.service';

export async function setupZohoReadiness() {
  const contactExternalIdField = await ensureContactExternalIdField();
  const discovery = await runDiscovery();
  const itemAccountMappings = await ensureDefaultItemAccountMappings();
  const uomMappings = await ensureDefaultUomMappings();
  return { contactExternalIdField, itemAccountMappings, uomMappings, discovery };
}
