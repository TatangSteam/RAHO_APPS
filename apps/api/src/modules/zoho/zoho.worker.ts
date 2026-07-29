import os from 'os';
import { IntegrationEvent, Prisma } from '@prisma/client';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';
import { ZohoApiError, normalizeZohoError } from './zoho.error';
import { sanitizeForAudit, stablePayloadHash } from './zoho.sanitizer';

export type ZohoEventHandler = (event: IntegrationEvent) => Promise<unknown>;

const handlers = new Map<string, ZohoEventHandler>();
export const ZOHO_SYNC_EVENT_TYPES = [
  'TREATMENT_COMPLETED',
  'TREATMENT_COMPLETION_CANCELLED',
  'PARTNERSHIP_GOODS_SHIPPED',
  'MEMBER_CONTACT_UPSERTED',
  'SUPPLIER_CONTACT_UPSERTED',
  'MASTER_PRODUCT_ITEM_UPSERTED',
  'PACKAGE_PRICING_ITEM_UPSERTED',
  'BRANCH_LOCATION_UPSERTED',
  'STOCK_LOCATION_UPSERTED',
  'INVOICE_FINALIZED',
  'INVOICE_VOIDED',
  'PAYMENT_VERIFIED',
  'PAYMENT_REFUNDED',
  'EXPENSE_PAID',
] as const;
const workerId = `${os.hostname()}:${process.pid}`;
let timer: NodeJS.Timeout | null = null;
let running = false;

export function registerZohoEventHandler(eventType: string, handler: ZohoEventHandler): void {
  handlers.set(eventType, handler);
}

export function calculateRetryAt(attemptNo: number, retryAfterMs?: number): Date {
  const exponential = Math.min(30 * 60_000, 30_000 * (2 ** Math.max(0, attemptNo - 1)));
  return new Date(Date.now() + (retryAfterMs ?? exponential));
}

export async function claimZohoEvents(limit = env.ZOHO_SYNC_BATCH_SIZE): Promise<IntegrationEvent[]> {
  const leaseUntil = new Date(Date.now() + env.ZOHO_SYNC_LEASE_MS);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "integration_events"
        WHERE "eventType" IN (${Prisma.join(ZOHO_SYNC_EVENT_TYPES)})
        AND (
          ("status" = 'PENDING' AND "availableAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "leaseUntil" < NOW())
        )
        ORDER BY "availableAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "integration_events" AS event
      SET
        "status" = 'PROCESSING',
        "attempts" = event."attempts" + 1,
        "lockedBy" = ${workerId},
        "leaseUntil" = ${leaseUntil},
        "updatedAt" = NOW()
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id"
    `);
    if (!claimed.length) return [];
    return tx.integrationEvent.findMany({
      where: { id: { in: claimed.map((entry) => entry.id) } },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    });
  });
}

async function nextAttemptNo(eventId: string): Promise<number> {
  const latest = await prisma.zohoSyncAttempt.aggregate({
    where: { integrationEventId: eventId },
    _max: { attemptNo: true },
  });
  return (latest._max.attemptNo || 0) + 1;
}

async function finishDryRun(event: IntegrationEvent): Promise<void> {
  const attemptNo = await nextAttemptNo(event.id);
  const requestSummary = sanitizeForAudit({
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    branchId: event.branchId,
    payload: event.payload,
  }) as Prisma.InputJsonValue;
  await prisma.$transaction([
    prisma.zohoSyncAttempt.create({
      data: {
        integrationEventId: event.id,
        attemptNo,
        workerId,
        status: 'DRY_RUN',
        requestSummary,
        responseSummary: { outcome: 'NO_WRITE', mode: 'DRY_RUN' },
        completedAt: new Date(),
      },
    }),
    prisma.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: 'DRY_RUN',
        payloadHash: event.payloadHash || stablePayloadHash(event.payload),
        lastError: null,
        lockedBy: null,
        leaseUntil: null,
      },
    }),
  ]);
}

export async function processClaimedZohoEvent(event: IntegrationEvent): Promise<void> {
  if (env.ZOHO_SYNC_DRY_RUN) {
    await finishDryRun(event);
    return;
  }

  const attemptNo = await nextAttemptNo(event.id);
  const attempt = await prisma.zohoSyncAttempt.create({
    data: {
      integrationEventId: event.id,
      attemptNo,
      workerId,
      status: 'PROCESSING',
      requestSummary: sanitizeForAudit({
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      }) as Prisma.InputJsonValue,
    },
  });

  try {
    const handler = handlers.get(event.eventType);
    if (!handler) {
      throw new ZohoApiError(
        `Handler Zoho untuk event ${event.eventType} belum tersedia.`,
        'ZOHO_HANDLER_NOT_IMPLEMENTED',
        422,
        false,
      );
    }
    const result = await handler(event);
    await prisma.$transaction([
      prisma.zohoSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUCCEEDED',
          responseSummary: sanitizeForAudit(result) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      }),
      prisma.integrationEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          payloadHash: event.payloadHash || stablePayloadHash(event.payload),
          lastError: null,
          lockedBy: null,
          leaseUntil: null,
        },
      }),
    ]);
  } catch (error) {
    const normalized = normalizeZohoError(error);
    const maxAttempts = Math.min(event.maxAttempts, env.ZOHO_SYNC_MAX_ATTEMPTS);
    const exhausted = event.attempts >= maxAttempts;
    const willRetry = normalized.retryable && !exhausted;
    const nextRetryAt = willRetry
      ? calculateRetryAt(event.attempts, normalized.retryAfterMs)
      : undefined;
    await prisma.$transaction([
      prisma.zohoSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: willRetry ? 'RETRY_SCHEDULED' : 'FAILED',
          httpStatus: normalized.httpStatus,
          errorCode: normalized.code,
          errorMessage: normalized.message,
          retryable: normalized.retryable,
          nextRetryAt,
          completedAt: new Date(),
        },
      }),
      prisma.integrationEvent.update({
        where: { id: event.id },
        data: {
          status: exhausted ? 'DEAD_LETTER' : willRetry ? 'PENDING' : 'FAILED',
          availableAt: nextRetryAt,
          deadLetteredAt: exhausted ? new Date() : null,
          lastError: `${normalized.code}: ${normalized.message}`,
          lockedBy: null,
          leaseUntil: null,
        },
      }),
    ]);
  }
}

export async function runZohoWorkerOnce(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const events = await claimZohoEvents();
    await Promise.all(events.map(processClaimedZohoEvent));
    return events.length;
  } finally {
    running = false;
  }
}

export function startZohoWorker(): void {
  if (!env.ZOHO_SYNC_WORKER_ENABLED || timer) return;
  logger.info('Zoho sync worker started', {
    workerId,
    dryRun: env.ZOHO_SYNC_DRY_RUN,
    intervalMs: env.ZOHO_SYNC_WORKER_INTERVAL_MS,
  });
  void runZohoWorkerOnce().catch((error) => logger.error('Zoho worker cycle failed', error));
  timer = setInterval(() => {
    void runZohoWorkerOnce().catch((error) => logger.error('Zoho worker cycle failed', error));
  }, env.ZOHO_SYNC_WORKER_INTERVAL_MS);
  timer.unref();
}

export function stopZohoWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
