import { Prisma } from '@prisma/client';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import {
  compareWebhookWithMapping,
  extractWebhookIdentity,
  isKnownWebhookEvent,
  verifyWebhookSignature,
  webhookDedupKey,
  webhookPayloadHash,
} from './zoho.webhook.policy';

type ReceiveWebhookInput = {
  organizationId: string;
  payload: unknown;
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
};

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || null : value || null;
}

export async function receiveZohoWebhook(input: ReceiveWebhookInput) {
  if (!env.ZOHO_WEBHOOK_SECRET) {
    throw new AppError(503, 'ZOHO_WEBHOOK_DISABLED', 'Webhook Zoho belum dikonfigurasi.');
  }
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new AppError(400, 'ZOHO_WEBHOOK_PAYLOAD_INVALID', 'Payload webhook harus berupa JSON object.');
  }
  const connection = await prisma.zohoConnection.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!connection || !connection.isActive) {
    throw new AppError(403, 'ZOHO_WEBHOOK_SOURCE_REJECTED', 'Organization webhook tidak dikenal.');
  }
  const signatureValid = verifyWebhookSignature({
    rawBody: input.rawBody,
    sharedSecretHeader: header(input.headers, 'x-raho-zoho-webhook-secret'),
    signatureHeader: header(input.headers, 'x-raho-zoho-signature'),
    secret: env.ZOHO_WEBHOOK_SECRET,
  });
  if (!signatureValid) {
    throw new AppError(401, 'ZOHO_WEBHOOK_SIGNATURE_INVALID', 'Signature webhook tidak valid.');
  }
  const payload = input.payload as Record<string, unknown>;
  const identity = extractWebhookIdentity(payload, input.headers);
  const sourceValid = !identity.organizationId || identity.organizationId === input.organizationId;
  if (!sourceValid) {
    throw new AppError(403, 'ZOHO_WEBHOOK_SOURCE_REJECTED', 'Organization payload tidak cocok dengan URL webhook.');
  }
  const payloadHash = webhookPayloadHash(payload);
  const dedupKey = webhookDedupKey({
    organizationId: input.organizationId,
    deliveryId: header(input.headers, 'x-zoho-webhook-id')
      || header(input.headers, 'x-zoho-delivery-id'),
    identity,
    payloadHash,
  });
  const existing = await prisma.zohoWebhookInbox.findUnique({ where: { dedupKey } });
  if (existing) return { accepted: true, duplicate: true, inboxId: existing.id, status: existing.status };

  const known = isKnownWebhookEvent(identity);
  let mapping = identity.zohoEntityId
    ? await prisma.zohoEntityMapping.findFirst({
        where: {
          zohoConnectionId: connection.id,
          zohoEntityType: identity.zohoEntityType!,
          zohoEntityId: identity.zohoEntityId,
        },
      })
    : null;
  if (!mapping && identity.externalReference) {
    mapping = await prisma.zohoEntityMapping.findFirst({
      where: {
        zohoConnectionId: connection.id,
        externalKey: identity.externalReference,
      },
    });
  }
  const status = !known ? 'IGNORED' : mapping ? 'PROCESSED' : 'PENDING_CORRELATION';
  const differences = mapping ? compareWebhookWithMapping(identity, payload, mapping) : [];

  try {
    const created = await prisma.$transaction(async (tx) => {
      const run = known && mapping ? await tx.zohoReconciliationRun.create({
        data: {
          zohoConnectionId: connection.id,
          runType: 'WEBHOOK',
          triggerSource: 'WEBHOOK',
          status: 'COMPLETED',
          totalChecked: 1,
          matchedCount: differences.length ? 0 : 1,
          exceptionCount: differences.length ? 1 : 0,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      }) : null;
      if (run && mapping) {
        await tx.zohoReconciliationResult.create({
          data: {
            runId: run.id,
            entityType: mapping.entityType,
            localEntityId: mapping.localEntityId,
            zohoEntityId: mapping.zohoEntityId,
            externalReference: identity.externalReference || mapping.externalKey,
            status: differences.length ? 'DRIFT' : 'MATCHED',
            severity: differences.length ? 'HIGH' : 'INFO',
            differences: json(differences),
            evidence: json({ webhookEventType: identity.eventType, payloadHash }),
            actionRequired: differences.length
              ? 'Review perubahan manual di Zoho dan pilih sumber data yang benar.'
              : null,
          },
        });
      }
      return tx.zohoWebhookInbox.create({
        data: {
          zohoConnectionId: connection.id,
          organizationId: input.organizationId,
          dedupKey,
          eventType: identity.eventType,
          zohoEntityType: identity.zohoEntityType,
          zohoEntityId: identity.zohoEntityId,
          externalReference: identity.externalReference,
          payloadHash,
          payload: json(payload),
          headers: json({
            deliveryId: header(input.headers, 'x-zoho-webhook-id')
              || header(input.headers, 'x-zoho-delivery-id'),
            event: header(input.headers, 'x-zoho-event'),
            userAgent: header(input.headers, 'user-agent'),
          }),
          signatureValid,
          sourceValid,
          status,
          correlationStatus: mapping ? 'MAPPED' : known ? 'PENDING' : 'NOT_REQUIRED',
          correlatedMappingId: mapping?.id,
          reconciliationRunId: run?.id,
          processedAt: status === 'PENDING_CORRELATION' ? null : new Date(),
        },
      });
    });
    return { accepted: true, duplicate: false, inboxId: created.id, status: created.status };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await prisma.zohoWebhookInbox.findUniqueOrThrow({ where: { dedupKey } });
      return { accepted: true, duplicate: true, inboxId: duplicate.id, status: duplicate.status };
    }
    throw error;
  }
}

export async function listWebhookInbox(input: { page: number; limit: number; status?: string }) {
  const where: Prisma.ZohoWebhookInboxWhereInput = input.status ? { status: input.status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.zohoWebhookInbox.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.zohoWebhookInbox.count({ where }),
  ]);
  return { items, pagination: { ...input, total, totalPages: Math.ceil(total / input.limit) } };
}

export async function retryPendingWebhookCorrelation(id: string) {
  const inbox = await prisma.zohoWebhookInbox.findUnique({ where: { id } });
  if (!inbox) throw new AppError(404, 'ZOHO_WEBHOOK_NOT_FOUND', 'Webhook inbox tidak ditemukan.');
  if (!inbox.zohoConnectionId) {
    throw new AppError(409, 'ZOHO_WEBHOOK_CONNECTION_MISSING', 'Koneksi Zoho untuk webhook tidak ditemukan.');
  }
  const mapping = await prisma.zohoEntityMapping.findFirst({
    where: {
      zohoConnectionId: inbox.zohoConnectionId,
      OR: [
        ...(inbox.zohoEntityId && inbox.zohoEntityType ? [{
          zohoEntityType: inbox.zohoEntityType,
          zohoEntityId: inbox.zohoEntityId,
        }] : []),
        ...(inbox.externalReference ? [{ externalKey: inbox.externalReference }] : []),
      ],
    },
  });
  if (!mapping) return inbox;
  const payload = inbox.payload as unknown as Record<string, unknown>;
  const identity = {
    eventType: inbox.eventType,
    zohoEntityType: inbox.zohoEntityType,
    zohoEntityId: inbox.zohoEntityId,
    externalReference: inbox.externalReference,
    organizationId: inbox.organizationId,
  };
  const differences = compareWebhookWithMapping(identity, payload, mapping);
  return prisma.$transaction(async (tx) => {
    const run = await tx.zohoReconciliationRun.create({
      data: {
        zohoConnectionId: inbox.zohoConnectionId,
        runType: 'WEBHOOK',
        triggerSource: 'WEBHOOK_CORRELATION',
        status: 'COMPLETED',
        totalChecked: 1,
        matchedCount: differences.length ? 0 : 1,
        exceptionCount: differences.length ? 1 : 0,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    await tx.zohoReconciliationResult.create({
      data: {
        runId: run.id,
        entityType: mapping.entityType,
        localEntityId: mapping.localEntityId,
        zohoEntityId: mapping.zohoEntityId,
        externalReference: inbox.externalReference || mapping.externalKey,
        status: differences.length ? 'DRIFT' : 'MATCHED',
        severity: differences.length ? 'HIGH' : 'INFO',
        differences: json(differences),
        evidence: json({ webhookInboxId: inbox.id, payloadHash: inbox.payloadHash }),
        actionRequired: differences.length
          ? 'Review perubahan manual di Zoho dan pilih sumber data yang benar.'
          : null,
      },
    });
    return tx.zohoWebhookInbox.update({
      where: { id },
      data: {
        correlatedMappingId: mapping.id,
        reconciliationRunId: run.id,
        correlationStatus: 'MAPPED',
        status: 'PROCESSED',
        processedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
  });
}
