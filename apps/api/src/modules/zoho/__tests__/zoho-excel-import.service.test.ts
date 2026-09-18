import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import { IntegrationEvent } from '@prisma/client';
import { env } from '@config/env';
import { prisma, getCurrentDatabaseProfileId } from '@lib/prisma';
import { getActiveZohoClient } from '../zoho.client';
import { getZohoRuntimeGate } from '../zoho.go-live.service';
import { EXCEL_IMPORT_EVENT } from '../zoho.excel-import.policy';
import { enqueueExcelImport, handleExcelImportEvent, previewExcelImport } from '../zoho.excel-import.service';

jest.mock('@lib/prisma', () => ({
  getCurrentDatabaseProfileId: jest.fn(),
  prisma: { zohoConnection: { findFirst: jest.fn() }, integrationEvent: { createMany: jest.fn(), findMany: jest.fn() }, $transaction: jest.fn() },
}));
jest.mock('../zoho.client', () => ({ getActiveZohoClient: jest.fn() }));
jest.mock('../zoho.go-live.service', () => ({ getZohoRuntimeGate: jest.fn() }));
const mock = (value: unknown) => value as jest.Mock;
const request = jest.fn();
const listAll = jest.fn();
let buffer: Buffer;

beforeAll(async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Contacts').addRows([['Nama', 'Email'], ['Budi', 'budi@example.test']]);
  buffer = Buffer.from(await workbook.xlsx.writeBuffer());
});

beforeEach(() => {
  jest.resetAllMocks();
  mock(getCurrentDatabaseProfileId).mockReturnValue('default');
  mock(prisma.zohoConnection.findFirst).mockResolvedValue({ id: 'conn-1', organizationId: 'org-1', organizationName: 'Botanica' });
  mock(getZohoRuntimeGate).mockResolvedValue({ mode: 'LIVE', connectionId: 'conn-1', masterFrozen: false });
  mock(getActiveZohoClient).mockResolvedValue({ connection: { id: 'conn-1' }, request, listAll });
  mock(prisma.$transaction).mockImplementation(async (work) => work(prisma));
  mock(prisma.integrationEvent.createMany).mockResolvedValue({ count: 1 });
  mock(prisma.integrationEvent.findMany).mockResolvedValue([{ id: 'event-1', status: 'PENDING' }]);
  listAll.mockResolvedValue([]);
  request.mockResolvedValue({ code: 0, contact: { contact_id: 'contact-1' } });
});

async function preview() {
  return previewExcelImport('user-1', buffer, { type: 'customer', sheetId: 1, headerRow: 1, mapping: { name: '1', email: '2' } });
}
async function commitInput() {
  const result = await preview();
  return { type: 'customer', rows: result.normalizedRows, proof: result.proof, confirmed: true };
}
function event(type = 'customer'): IntegrationEvent {
  return { eventType: EXCEL_IMPORT_EVENT, payload: { type, connectionId: 'conn-1', importedById: 'user-1', row: { rowNumber: 2, name: 'Budi', email: 'budi@example.test', ...(type === 'item' ? { sku: 'SKU-1', rate: 50, unit: 'pcs' } : {}) } } } as unknown as IntegrationEvent;
}

describe('Zoho Excel import preview, queue and transport simulation', () => {
  it('preview never queues or calls Zoho and stays usable when disconnected', async () => {
    mock(prisma.zohoConnection.findFirst).mockResolvedValue(null);
    mock(getZohoRuntimeGate).mockResolvedValue({ mode: 'OFF', connectionId: null });
    const result = await preview();
    expect(result).toMatchObject({ validCount: 1, errorCount: 0, proof: null, readyToQueue: false, organization: null });
    expect(request).not.toHaveBeenCalled();
    expect(prisma.integrationEvent.createMany).not.toHaveBeenCalled();
  });

  it('queues confirmed, signed rows atomically with repeat-upload deduplication', async () => {
    const input = await commitInput();
    expect(await enqueueExcelImport('user-1', input)).toMatchObject({ queued: 1, alreadyQueued: 0 });
    const first = mock(prisma.integrationEvent.createMany).mock.calls[0][0];
    expect(first.skipDuplicates).toBe(true);
    expect(first.data[0]).toMatchObject({ eventType: EXCEL_IMPORT_EVENT, aggregateType: 'ZOHO_EXCEL_MASTER', payload: { importedById: 'user-1', connectionId: 'conn-1' } });
    mock(prisma.integrationEvent.createMany).mockResolvedValue({ count: 0 });
    expect(await enqueueExcelImport('user-1', input)).toMatchObject({ queued: 0, alreadyQueued: 1 });
    expect(mock(prisma.integrationEvent.createMany).mock.calls[1][0].data[0].aggregateId).toBe(first.data[0].aggregateId);
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects changed rows, another user, another database and missing confirmation', async () => {
    const input = await commitInput();
    await expect(enqueueExcelImport('user-1', { ...input, rows: [{ ...input.rows[0], name: 'Tampered' }] })).rejects.toMatchObject({ code: 'ZOHO_IMPORT_PREVIEW_MISMATCH' });
    await expect(enqueueExcelImport('other-user', input)).rejects.toMatchObject({ code: 'ZOHO_IMPORT_PREVIEW_MISMATCH' });
    mock(getCurrentDatabaseProfileId).mockReturnValue('other-db');
    await expect(enqueueExcelImport('user-1', input)).rejects.toMatchObject({ code: 'ZOHO_IMPORT_PREVIEW_MISMATCH' });
    await expect(enqueueExcelImport('user-1', { ...input, confirmed: false })).rejects.toThrow();
    expect(prisma.integrationEvent.createMany).not.toHaveBeenCalled();
  });

  it('rejects expired and incorrectly signed previews', async () => {
    const input = await commitInput();
    const proof = jwt.sign({ userId: 'user-1' }, `${env.JWT_ACCESS_SECRET}:zoho-excel-import`, { expiresIn: -1, issuer: 'raho-api', audience: 'zoho-excel-import' });
    await expect(enqueueExcelImport('user-1', { ...input, proof })).rejects.toMatchObject({ code: 'ZOHO_IMPORT_PREVIEW_EXPIRED' });
    await expect(enqueueExcelImport('user-1', { ...input, proof: 'invalid' })).rejects.toMatchObject({ code: 'ZOHO_IMPORT_PREVIEW_EXPIRED' });
  });

  it.each(['OFF', 'DRY_RUN', 'CANARY', 'FROZEN', 'CHANGED'])('does not bypass %s gate on commit', async (mode) => {
    const input = await commitInput();
    mock(getZohoRuntimeGate).mockResolvedValue({ mode: ['FROZEN', 'CHANGED'].includes(mode) ? 'LIVE' : mode, connectionId: mode === 'CHANGED' ? 'conn-2' : 'conn-1', masterFrozen: mode === 'FROZEN' });
    await expect(enqueueExcelImport('user-1', input)).rejects.toMatchObject({ code: 'ZOHO_IMPORT_NOT_READY' });
    expect(prisma.integrationEvent.createMany).not.toHaveBeenCalled();
  });

  it('creates only a whitelisted contact payload through the existing Zoho client', async () => {
    expect(await handleExcelImportEvent(event())).toEqual({ outcome: 'CREATED', zohoEntityId: 'contact-1', type: 'customer' });
    expect(request).toHaveBeenCalledWith('/books/v3/contacts', { method: 'POST', data: expect.objectContaining({ contact_name: 'Budi', contact_type: 'customer' }) });
    expect(listAll).toHaveBeenCalledWith('/books/v3/contacts', 'contacts', expect.objectContaining({ contact_name: 'Budi' }));
  });

  it('skips existing manual contacts and products without updating anything', async () => {
    listAll.mockResolvedValue([{ contact_id: 'manual-1', contact_name: 'BUDI' }]);
    expect(await handleExcelImportEvent(event())).toMatchObject({ outcome: 'SKIPPED_EXISTING', zohoEntityId: 'manual-1' });
    listAll.mockResolvedValue([{ item_id: 'item-1', sku: 'sku-1' }]);
    expect(await handleExcelImportEvent(event('item'))).toMatchObject({ outcome: 'SKIPPED_EXISTING', zohoEntityId: 'item-1' });
    expect(request).not.toHaveBeenCalled();
  });

  it('looks up again after a timeout so an already-created contact is not sent twice', async () => {
    request.mockRejectedValueOnce(new Error('network timeout'));
    await expect(handleExcelImportEvent(event())).rejects.toThrow('timeout');
    listAll.mockResolvedValue([{ contact_id: 'created-before-timeout', contact_name: 'Budi' }]);
    expect(await handleExcelImportEvent(event())).toMatchObject({ outcome: 'SKIPPED_EXISTING' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('refuses worker writes to a different organization or frozen master', async () => {
    mock(getActiveZohoClient).mockResolvedValue({ connection: { id: 'conn-2' }, request, listAll });
    await expect(handleExcelImportEvent(event())).rejects.toMatchObject({ code: 'ZOHO_IMPORT_TARGET_CHANGED' });
    mock(getZohoRuntimeGate).mockResolvedValue({ mode: 'LIVE', connectionId: 'conn-1', masterFrozen: true });
    await expect(handleExcelImportEvent(event())).rejects.toMatchObject({ code: 'ZOHO_IMPORT_TARGET_CHANGED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('never marks an unconfirmed Zoho response as success', async () => {
    request.mockResolvedValue({ code: 4, message: 'Invalid' });
    await expect(handleExcelImportEvent(event())).rejects.toMatchObject({ code: 'ZOHO_IMPORT_RESPONSE_INVALID' });
  });

  it('holds writes if the organization changes while Zoho lookup is running', async () => {
    mock(getZohoRuntimeGate).mockResolvedValueOnce({ mode: 'LIVE', connectionId: 'conn-1' })
      .mockResolvedValueOnce({ mode: 'LIVE', connectionId: 'conn-2' });
    await expect(handleExcelImportEvent(event())).rejects.toMatchObject({ code: 'ZOHO_IMPORT_TARGET_CHANGED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('creates vendor and product masters without stock or financial transactions', async () => {
    request.mockResolvedValueOnce({ code: 0, contact: { contact_id: 'vendor-1' } });
    expect(await handleExcelImportEvent(event('vendor'))).toMatchObject({ outcome: 'CREATED', type: 'vendor' });
    request.mockResolvedValueOnce({ code: 0, item: { item_id: 'item-1' } });
    expect(await handleExcelImportEvent(event('item'))).toMatchObject({ outcome: 'CREATED', type: 'item' });
    expect(request).toHaveBeenLastCalledWith('/books/v3/items', { method: 'POST', data: { name: 'Budi', sku: 'SKU-1', rate: 50, unit: 'pcs', product_type: 'goods', item_type: 'sales' } });
  });

  it('reuses a batch SKU index but refreshes it after a timeout/retry', async () => {
    const first = { ...event('item'), attempts: 1 };
    first.payload = { ...(first.payload as object), batchId: 'sku-cache-test' };
    request.mockResolvedValueOnce({ code: 0, item: { item_id: 'item-created' } });
    await handleExcelImportEvent(first);
    expect(await handleExcelImportEvent(first)).toMatchObject({ outcome: 'SKIPPED_EXISTING', zohoEntityId: 'item-created' });
    expect(listAll).toHaveBeenCalledTimes(1);
    listAll.mockResolvedValueOnce([{ sku: 'SKU-1', item_id: 'fresh-remote-id' }]);
    expect(await handleExcelImportEvent({ ...first, attempts: 2 })).toMatchObject({ outcome: 'SKIPPED_EXISTING', zohoEntityId: 'fresh-remote-id' });
    expect(listAll).toHaveBeenCalledTimes(2);
  });
});
