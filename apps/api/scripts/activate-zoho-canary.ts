import { prisma } from '../src/lib/prisma';
import { getStatus } from '../src/modules/zoho/zoho.service';
import {
  approveGoLive,
  countValidatedCanaryEvents,
  configureGoLiveControl,
  getGoLiveControl,
  setGoLiveMode,
} from '../src/modules/zoho/zoho.go-live.service';

async function main(): Promise<void> {
  const approverEmail = process.argv[2];
  const expectedEventCount = Number(process.argv[3]);
  if (!approverEmail || !Number.isInteger(expectedEventCount) || expectedEventCount < 1) {
    throw new Error('USAGE: zoho:activate-canary -- <approver-email> <expected-dry-run-count>');
  }

  const [approver, readiness, goLive] = await Promise.all([
    prisma.user.findFirst({
      where: { email: approverEmail, role: 'SUPER_ADMIN', isActive: true },
      include: { profile: true },
    }),
    getStatus(),
    getGoLiveControl(),
  ]);
  if (!approver) throw new Error('ACTIVE_SUPER_ADMIN_APPROVER_NOT_FOUND');
  const active = readiness.connections.find((connection) => connection.isActive);
  if (!active?.authorizationReady
    || !active.contactSyncReady
    || !active.itemSyncReady
    || !active.locationSyncReady
    || !active.invoiceSyncReady
    || !active.paymentSyncReady) {
    throw new Error('ZOHO_READINESS_INCOMPLETE');
  }
  if (!goLive.connected || !goLive.control) throw new Error('ZOHO_GO_LIVE_NOT_CONFIGURED');

  const canaryBranchIds = Array.isArray(goLive.control.canaryBranchIds)
    ? goLive.control.canaryBranchIds.filter((id): id is string => typeof id === 'string')
    : [];
  if (!canaryBranchIds.length) throw new Error('ZOHO_CANARY_BRANCH_REQUIRED');
  const eventCount = await countValidatedCanaryEvents(canaryBranchIds);
  if (eventCount !== expectedEventCount) {
    throw new Error(`ZOHO_CANARY_EVENT_COUNT_CHANGED:${eventCount}`);
  }

  await configureGoLiveControl({
    actorUserId: approver.id,
    // Kontak/item adalah master event. Freeze harus dibuka selama CANARY agar
    // antrean yang sudah lolos rehearsal benar-benar dapat dikirim. Pembatasan
    // cabang CANARY tetap mencegah event cabang lain ikut diproses.
    masterFrozen: false,
    canaryBranchIds,
    canaryCustomerId: goLive.control.canaryCustomerId,
    canaryVendorId: goLive.control.canaryVendorId,
    notes: `CANARY nyata disetujui ${approver.profile?.fullName || approver.email}; ${eventCount} event dengan riwayat DRY_RUN tervalidasi.`,
  });
  await approveGoLive(approver.id, 'FINANCE');
  await approveGoLive(approver.id, 'LOGISTICS');
  const control = await setGoLiveMode(approver.id, 'CANARY');

  console.log(JSON.stringify({
    activated: true,
    mode: control.mode,
    masterFrozen: control.masterFrozen,
    approver: { id: approver.id, email: approver.email, name: approver.profile?.fullName ?? null },
    canaryBranchIds,
    validatedCanaryEvents: eventCount,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      activated: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
