import { randomUUID } from 'crypto';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { processClaimedZohoEvent } from '../zoho.worker';

describe('Zoho worker database integration', () => {
  const aggregateId = `zoho-worker-test-${randomUUID()}`;
  let eventId = '';

  afterAll(async () => {
    if (eventId) await prisma.integrationEvent.deleteMany({ where: { id: eventId } });
    await prisma.$disconnect();
  });

  it('stores a sanitized dry-run attempt without writing to Zoho', async () => {
    expect(env.ZOHO_SYNC_DRY_RUN).toBe(true);
    const event = await prisma.integrationEvent.create({
      data: {
        eventType: 'ZOHO_WORKER_TEST',
        aggregateType: 'Test',
        aggregateId,
        payload: {
          amount: 100_000,
          authorization: 'must-not-be-stored',
          accessToken: 'must-not-be-stored',
        },
        status: 'PROCESSING',
        attempts: 1,
        lockedBy: 'jest',
        leaseUntil: new Date(Date.now() + 60_000),
        occurredAt: new Date(),
      },
    });
    eventId = event.id;

    await processClaimedZohoEvent(event);

    const stored = await prisma.integrationEvent.findUniqueOrThrow({
      where: { id: event.id },
      include: { syncAttempts: true },
    });
    expect(stored.status).toBe('DRY_RUN');
    expect(stored.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.lockedBy).toBeNull();
    expect(stored.syncAttempts).toHaveLength(1);
    expect(stored.syncAttempts[0].status).toBe('DRY_RUN');
    expect(JSON.stringify(stored.syncAttempts[0].requestSummary)).not.toContain('must-not-be-stored');
    expect(JSON.stringify(stored.syncAttempts[0].requestSummary)).toContain('[REDACTED]');

    const replay = await prisma.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSING',
        attempts: 1,
        lockedBy: 'jest-replay',
        leaseUntil: new Date(Date.now() + 60_000),
      },
    });
    await processClaimedZohoEvent(replay);
    const attempts = await prisma.zohoSyncAttempt.findMany({
      where: { integrationEventId: event.id },
      orderBy: { attemptNo: 'asc' },
    });
    expect(attempts.map((attempt) => attempt.attemptNo)).toEqual([1, 2]);
  });
});
