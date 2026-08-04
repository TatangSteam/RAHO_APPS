import { ensureContactExternalIdField, getDiscovery, runDiscovery } from './zoho.discovery.service';
import { ensureFinanceMappings } from './zoho.finance-setup.service';
import { ensureDefaultItemAccountMappings, ensureDefaultUomMappings } from './zoho.master.service';

export async function setupZohoReadiness(actorUserId: string) {
  const contactExternalIdField = await ensureContactExternalIdField();
  await runDiscovery();
  const itemAccountMappings = await ensureDefaultItemAccountMappings();
  const uomMappings = await ensureDefaultUomMappings();
  const financeMappings = await ensureFinanceMappings(actorUserId);
  const discovery = await getDiscovery();
  return { contactExternalIdField, itemAccountMappings, uomMappings, financeMappings, discovery };
}
