import { prisma } from '../src/lib/prisma';
import { getStatus, testConnection } from '../src/modules/zoho/zoho.service';

async function main(): Promise<void> {
  const status = await getStatus();
  const active = status.connections.find((connection) => connection.isActive);
  if (!active) {
    console.log(JSON.stringify({ ready: false, reason: 'ZOHO_NOT_CONNECTED' }));
    process.exitCode = 2;
    return;
  }

  const connectionTest = await testConnection();
  const result = {
    ready:
      connectionTest.healthy
      && !active.reconnectRequired
      && active.contactSyncReady
      && active.itemSyncReady
      && active.locationSyncReady
      && active.invoiceSyncReady
      && active.paymentSyncReady,
    connected: connectionTest.healthy,
    contactSyncReady: active.contactSyncReady,
    itemSyncReady: active.itemSyncReady,
    locationSyncReady: active.locationSyncReady,
    invoiceSyncReady: active.invoiceSyncReady,
    paymentSyncReady: active.paymentSyncReady,
    organizationName: active.organizationName,
    scopeVersion: active.scopeVersion,
    requiredScopeVersion: status.requiredScopeVersion,
    reconnectRequired: active.reconnectRequired,
    missingScopes: active.missingScopes,
    dryRun: status.dryRun,
    workerEnabled: status.workerEnabled,
    discoveryLastRunAt: active.discoveryLastRunAt,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ready: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
