import { IntegrationEventStatus, Prisma } from '@prisma/client';
import {
  INVENTORY_SYNC_EVENT_VERSION,
  InventorySyncSnapshot,
} from './zoho.inventory-adjustment.policy';

export async function createInventorySyncEventInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    snapshot: Omit<InventorySyncSnapshot, 'eventVersion'>;
    occurredAt: Date;
  },
) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: input.eventType,
        aggregateId: input.aggregateId,
      },
    },
    create: {
      eventType: input.eventType,
      eventVersion: INVENTORY_SYNC_EVENT_VERSION,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      branchId: input.snapshot.branchId,
      payload: {
        eventVersion: INVENTORY_SYNC_EVENT_VERSION,
        ...input.snapshot,
      } as unknown as Prisma.InputJsonValue,
      status: IntegrationEventStatus.PENDING,
      occurredAt: input.occurredAt,
    },
    update: {},
  });
}
