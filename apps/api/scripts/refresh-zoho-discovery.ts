import { prisma } from '../src/lib/prisma';
import { runDiscovery } from '../src/modules/zoho/zoho.discovery.service';

async function main(): Promise<void> {
  const discovery = await runDiscovery();
  console.log(JSON.stringify({
    refreshed: true,
    organizationId: discovery.organizationId,
    lastRunAt: discovery.lastRunAt,
    contactExternalIdReady: discovery.contactExternalIdField.ready,
    locationSupported: discovery.locationCapability.supported,
    counts: discovery.counts,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      refreshed: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
