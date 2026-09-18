import jwt from 'jsonwebtoken';
import { IntegrationEvent, Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '@config/env';
import { getCurrentDatabaseProfileId, prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient } from './zoho.client';
import { getZohoRuntimeGate } from './zoho.go-live.service';
import { ZohoApiError } from './zoho.error';
import { buildExcelImportPayload, EXCEL_IMPORT_EVENT, ExcelImportType, importHash, importIdentity, importRowSchema, importTypeSchema } from './zoho.excel-import.policy';
import { MAX_IMPORT_ROWS, previewImportRows, readImportWorkbook } from './zoho.excel-import.workbook';

const proofSecret = () => `${env.JWT_ACCESS_SECRET}:zoho-excel-import`;
const proofSchema = z.object({
  userId: z.string(), databaseProfileId: z.string(), connectionId: z.string(), hash: z.string(),
});
export const commitImportSchema = z.object({
  type: importTypeSchema,
  rows: z.array(importRowSchema).min(1).max(MAX_IMPORT_ROWS),
  proof: z.string().max(3000),
  confirmed: z.literal(true),
}).strict();

export async function previewExcelImport(userId: string, buffer: Buffer, input: {
  type: ExcelImportType; sheetId: number; headerRow: number; mapping: Record<string, string>;
}) {
  const workbook = await readImportWorkbook(buffer);
  const rows = previewImportRows(workbook, input.sheetId, input.headerRow, input.type, input.mapping);
  const errorCount = rows.filter((row) => row.errors.length).length;
  const normalizedRows = errorCount ? [] : rows.map((row) => importRowSchema.parse({ rowNumber: row.rowNumber, ...row.data }));
  const [connection, gate] = await Promise.all([
    prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true, organizationId: true, organizationName: true } }),
    getZohoRuntimeGate(),
  ]);
  const readyToQueue = Boolean(connection && gate.connectionId === connection.id && gate.mode === 'LIVE' && !gate.masterFrozen);
  const proof = connection && !errorCount ? jwt.sign({
    userId, databaseProfileId: getCurrentDatabaseProfileId(), connectionId: connection.id,
    hash: importHash({ type: input.type, rows: normalizedRows }),
  }, proofSecret(), { expiresIn: '15m', issuer: 'raho-api', audience: 'zoho-excel-import' }) : null;
  return {
    rows, normalizedRows, errorCount, validCount: rows.length - errorCount, proof,
    organization: connection ? { id: connection.organizationId, name: connection.organizationName } : null,
    mode: gate.mode, readyToQueue,
    message: !connection ? 'Hubungkan Zoho Books pada tab Koneksi terlebih dahulu.'
      : gate.masterFrozen ? 'Perubahan master Zoho sedang dibekukan.'
        : !readyToQueue ? 'Pratinjau tersedia. Pengiriman nyata menunggu mode LIVE dan worker aktif; pengaman Go-live tetap berlaku.'
          : 'Data siap masuk antrean. Kontak dengan nama sama atau produk dengan SKU sama di Zoho akan dilewati, bukan ditimpa.',
  };
}

export async function enqueueExcelImport(userId: string, raw: unknown) {
  const input = commitImportSchema.parse(raw);
  let proof: z.infer<typeof proofSchema>;
  try {
    proof = proofSchema.parse(jwt.verify(input.proof, proofSecret(), { issuer: 'raho-api', audience: 'zoho-excel-import' }));
  } catch { throw new AppError(400, 'ZOHO_IMPORT_PREVIEW_EXPIRED', 'Pratinjau kedaluwarsa atau tidak valid. Buat pratinjau kembali.'); }
  if (proof.userId !== userId || proof.databaseProfileId !== getCurrentDatabaseProfileId()
    || proof.hash !== importHash({ type: input.type, rows: input.rows })) {
    throw new AppError(403, 'ZOHO_IMPORT_PREVIEW_MISMATCH', 'Data atau pengguna berubah sejak pratinjau. Buat pratinjau kembali.');
  }
  const gate = await getZohoRuntimeGate();
  if (gate.connectionId !== proof.connectionId || gate.mode !== 'LIVE' || gate.masterFrozen) {
    throw new AppError(409, 'ZOHO_IMPORT_NOT_READY', 'Organisasi berubah atau pengiriman belum LIVE. Periksa Koneksi dan Go-live, lalu ulangi pratinjau.');
  }
  for (const row of input.rows) buildExcelImportPayload(input.type, row);
  const identities = input.rows.map((row) => importHash({ connectionId: proof.connectionId, identity: importIdentity(input.type, row) }));
  const now = new Date();
  const batchId = importHash({ connectionId: proof.connectionId, type: input.type, rows: input.rows });
  return prisma.$transaction(async (tx) => {
    const created = await tx.integrationEvent.createMany({
      data: input.rows.map((row, index) => ({
        eventType: EXCEL_IMPORT_EVENT, aggregateType: 'ZOHO_EXCEL_MASTER', aggregateId: identities[index],
        payload: { type: input.type, row, connectionId: proof.connectionId, importedById: userId, batchId } as Prisma.InputJsonValue,
        payloadHash: importHash(row), occurredAt: now,
      })), skipDuplicates: true,
    });
    const events = await tx.integrationEvent.findMany({
      where: { eventType: EXCEL_IMPORT_EVENT, aggregateId: { in: identities } },
      select: { id: true, status: true, aggregateId: true },
    });
    return { queued: created.count, alreadyQueued: input.rows.length - created.count, events };
  });
}

const eventPayloadSchema = z.object({ type: importTypeSchema, row: importRowSchema, connectionId: z.string(), importedById: z.string(), batchId: z.string().optional() });
// Reuse the exact-SKU index within a sequential import batch instead of reading
// the entire Books item catalog 100 times. Retried/lease-recovered events always
// fetch a fresh index; cache is bounded and isolated by database and connection.
const itemIndexes = new Map<string, { expiresAt: number; ids: Map<string, string> }>();
const identityKey = (value: unknown) => String(value || '').trim().toLowerCase();

export async function handleExcelImportEvent(event: IntegrationEvent) {
  const input = eventPayloadSchema.parse(event.payload);
  const gate = await getZohoRuntimeGate();
  if (gate.mode !== 'LIVE' || gate.masterFrozen || gate.connectionId !== input.connectionId) {
    throw new ZohoApiError('Target impor berubah atau master belum boleh dikirim. Periksa sebelum retry.', 'ZOHO_IMPORT_TARGET_CHANGED', 409, false);
  }
  const client = await getActiveZohoClient();
  if (client.connection.id !== input.connectionId) throw new ZohoApiError('Organisasi impor tidak lagi aktif.', 'ZOHO_IMPORT_TARGET_CHANGED', 409, false);
  const isItem = input.type === 'item';
  const path = isItem ? '/books/v3/items' : '/books/v3/contacts';
  const collection = isItem ? 'items' : 'contacts';
  // A lookup is mandatory on every attempt, including after a network timeout.
  // Do not overwrite or automatically adopt an existing manual/ERP record.
  let index: Map<string, string> | undefined;
  const cacheKey = input.batchId ? `${getCurrentDatabaseProfileId()}:${input.connectionId}:${input.batchId}` : null;
  for (const [key, cached] of itemIndexes) if (cached.expiresAt <= Date.now()) itemIndexes.delete(key);
  if (isItem && cacheKey && event.attempts <= 1) index = itemIndexes.get(cacheKey)?.ids;
  if (!index) {
    const candidates = await client.listAll<Record<string, unknown>>(path, collection, isItem
      // Books /items does not document an exact-SKU query (unlike /itemvariants).
      ? { filter_by: 'Status.All' }
      : { contact_name: input.row.name, filter_by: 'Status.All' });
    index = new Map(candidates.map((candidate) => [identityKey(candidate[isItem ? 'sku' : 'contact_name']), String(candidate[isItem ? 'item_id' : 'contact_id'])]));
    if (isItem && cacheKey) {
      if (itemIndexes.size >= 10) itemIndexes.delete(itemIndexes.keys().next().value!);
      itemIndexes.set(cacheKey, { expiresAt: Date.now() + 60_000, ids: index });
    }
  }
  const existingId = index.get(identityKey(isItem ? input.row.sku : input.row.name));
  if (existingId) return { outcome: 'SKIPPED_EXISTING', zohoEntityId: existingId, type: input.type };
  const writeGate = await getZohoRuntimeGate();
  if (writeGate.mode !== 'LIVE' || writeGate.masterFrozen || writeGate.connectionId !== input.connectionId) {
    throw new ZohoApiError('Pengiriman ditahan karena target atau mode berubah saat pemeriksaan.', 'ZOHO_IMPORT_TARGET_CHANGED', 409, false);
  }
  const response = await client.request<Record<string, unknown>>(path, { method: 'POST', data: buildExcelImportPayload(input.type, input.row) });
  const entity = response[isItem ? 'item' : 'contact'] as Record<string, unknown> | undefined;
  const id = entity?.[isItem ? 'item_id' : 'contact_id'];
  if (response.code !== 0 || !id) throw new ZohoApiError('Zoho tidak mengonfirmasi pembuatan master. Periksa detail di Zoho sebelum retry.', 'ZOHO_IMPORT_RESPONSE_INVALID', 422, false);
  if (isItem) index.set(identityKey(input.row.sku), String(id));
  return { outcome: 'CREATED', zohoEntityId: String(id), type: input.type };
}
