import { Prisma, ZohoDiscoveryResourceType } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient, ZohoClient, ZohoOrganization } from './zoho.client';
import { sanitizeForAudit } from './zoho.sanitizer';

type ZohoRecord = Record<string, unknown>;
type DiscoveryItem = {
  zohoId: string;
  name: string;
  code?: string;
  isActive: boolean;
  payload: ZohoRecord;
};

const PAYMENT_MODES = [
  'cash',
  'check',
  'creditcard',
  'banktransfer',
  'bankremittance',
  'autotransaction',
  'others',
] as const;

function text(record: ZohoRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function active(record: ZohoRecord): boolean {
  if (typeof record.is_active === 'boolean') return record.is_active;
  if (typeof record.status === 'string') return record.status.toLowerCase() !== 'inactive';
  return true;
}

function item(record: ZohoRecord, idKey: string, nameKey: string, codeKey?: string): DiscoveryItem {
  const zohoId = text(record, idKey);
  const name = text(record, nameKey);
  if (!zohoId || !name) {
    throw new AppError(502, 'ZOHO_DISCOVERY_INVALID_RESPONSE', `Respons Zoho tidak memiliki ${idKey} atau ${nameKey}.`);
  }
  return {
    zohoId,
    name,
    code: codeKey ? text(record, codeKey) : undefined,
    isActive: active(record),
    payload: sanitizeForAudit(record) as ZohoRecord,
  };
}

async function fetchOrganizations(client: ZohoClient): Promise<DiscoveryItem[]> {
  const response = await client.request<{ organizations?: ZohoOrganization[] }>(
    '/books/v3/organizations',
    { organizationScoped: false },
  );
  const organizations = response.organizations || [];
  const selected = organizations.find(
    (organization) => organization.organization_id === client.connection.organizationId,
  );
  if (!selected) {
    throw new AppError(
      409,
      'ZOHO_ORGANIZATION_MISMATCH',
      'Organisasi aktif ERP tidak lagi tersedia pada akun Zoho. Pilih atau hubungkan ulang organisasi.',
    );
  }
  return organizations.map((organization) =>
    item(organization as unknown as ZohoRecord, 'organization_id', 'name', 'currency_code'),
  );
}

async function fetchAll(client: ZohoClient) {
  const [accounts, taxes, locations, bankAccounts] = await Promise.all([
    client.listAll<ZohoRecord>('/books/v3/chartofaccounts', 'chartofaccounts'),
    client.listAll<ZohoRecord>('/books/v3/settings/taxes', 'taxes'),
    client.listAll<ZohoRecord>('/books/v3/locations', 'locations'),
    client.listAll<ZohoRecord>('/books/v3/bankaccounts', 'bankaccounts', { filter_by: 'Status.All' }),
  ]);
  return {
    [ZohoDiscoveryResourceType.ACCOUNT]: accounts.map((value) => item(value, 'account_id', 'account_name', 'account_code')),
    [ZohoDiscoveryResourceType.TAX]: taxes.map((value) => item(value, 'tax_id', 'tax_name')),
    [ZohoDiscoveryResourceType.LOCATION]: locations.map((value) => item(value, 'location_id', 'location_name')),
    [ZohoDiscoveryResourceType.BANK_ACCOUNT]: bankAccounts.map((value) => item(value, 'account_id', 'account_name', 'account_code')),
    [ZohoDiscoveryResourceType.PAYMENT_MODE]: PAYMENT_MODES.map((mode) => ({
      zohoId: mode,
      name: mode,
      code: mode,
      isActive: true,
      payload: { mode, source: 'ZOHO_BOOKS_SUPPORTED_PAYMENT_MODE' },
    })),
  };
}

async function fetchContactExternalIdField(client: ZohoClient) {
  const fields = await client.listAll<ZohoRecord>('/books/v3/settings/fields', 'fields', {
    entity: 'contact',
    filter_custom_fields: true,
    skip_inactive_fields: true,
  });
  const matches = fields.filter((field) => {
    const identity = `${text(field, 'label') || ''} ${text(field, 'api_name') || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ');
    return identity.includes('raho') && (identity.includes('external') || identity.includes('id'));
  });
  if (matches.length !== 1) return null;
  return {
    fieldId: text(matches[0], 'field_id') || null,
    apiName: text(matches[0], 'api_name') || null,
    isUnique: matches[0].is_unique === true,
  };
}

async function replaceResource(
  connectionId: string,
  resourceType: ZohoDiscoveryResourceType,
  items: DiscoveryItem[],
): Promise<void> {
  const fetchedAt = new Date();
  const ids = items.map((entry) => entry.zohoId);
  await prisma.$transaction(async (tx) => {
    await tx.zohoDiscoveryCache.updateMany({
      where: {
        zohoConnectionId: connectionId,
        resourceType,
        ...(ids.length ? { zohoId: { notIn: ids } } : {}),
      },
      data: { isActive: false, fetchedAt },
    });
    for (const entry of items) {
      await tx.zohoDiscoveryCache.upsert({
        where: {
          zohoConnectionId_resourceType_zohoId: {
            zohoConnectionId: connectionId,
            resourceType,
            zohoId: entry.zohoId,
          },
        },
        create: {
          zohoConnectionId: connectionId,
          resourceType,
          zohoId: entry.zohoId,
          name: entry.name,
          code: entry.code,
          isActive: entry.isActive,
          payload: entry.payload as Prisma.InputJsonValue,
          fetchedAt,
        },
        update: {
          name: entry.name,
          code: entry.code,
          isActive: entry.isActive,
          payload: entry.payload as Prisma.InputJsonValue,
          fetchedAt,
        },
      });
    }
    await tx.zohoEntityMapping.updateMany({
      where: {
        zohoConnectionId: connectionId,
        zohoEntityType: resourceType,
        zohoEntityId: { in: ids },
        status: 'INACTIVE',
      },
      data: { status: 'ACTIVE' },
    });
    const inactive = await tx.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connectionId, resourceType, isActive: false },
      select: { zohoId: true },
    });
    if (inactive.length) {
      await tx.zohoEntityMapping.updateMany({
        where: {
          zohoConnectionId: connectionId,
          zohoEntityType: resourceType,
          zohoEntityId: { in: inactive.map((entry) => entry.zohoId) },
          status: 'ACTIVE',
        },
        data: { status: 'NEEDS_REVIEW' },
      });
    }
  });
}

export async function runDiscovery() {
  const client = await getActiveZohoClient(true);
  const [organizations, resources, contactExternalIdField] = await Promise.all([
    fetchOrganizations(client),
    fetchAll(client),
    fetchContactExternalIdField(client),
  ]);

  await replaceResource(client.connection.id, ZohoDiscoveryResourceType.ORGANIZATION, organizations);
  for (const [resourceType, items] of Object.entries(resources)) {
    await replaceResource(client.connection.id, resourceType as ZohoDiscoveryResourceType, items);
  }

  const selected = organizations.find((entry) => entry.zohoId === client.connection.organizationId);
  const selectedPayload = selected?.payload;
  await prisma.zohoConnection.update({
    where: { id: client.connection.id },
    data: {
      organizationCurrencyId: selectedPayload ? text(selectedPayload, 'currency_id') : undefined,
      organizationCurrencyCode: selectedPayload ? text(selectedPayload, 'currency_code') : undefined,
      organizationTimeZone: selectedPayload ? text(selectedPayload, 'time_zone') : undefined,
      contactExternalIdFieldId: contactExternalIdField?.fieldId ?? null,
      contactExternalIdApiName: contactExternalIdField?.apiName ?? null,
      contactExternalIdIsUnique: contactExternalIdField?.isUnique ?? null,
      discoveryLastRunAt: new Date(),
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });

  return getDiscovery();
}

export async function getDiscovery(resourceType?: ZohoDiscoveryResourceType) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const items = await prisma.zohoDiscoveryCache.findMany({
    where: { zohoConnectionId: connection.id, ...(resourceType ? { resourceType } : {}) },
    orderBy: [{ resourceType: 'asc' }, { name: 'asc' }],
  });
  const counts = await prisma.zohoDiscoveryCache.groupBy({
    by: ['resourceType'],
    where: { zohoConnectionId: connection.id, isActive: true },
    _count: { _all: true },
  });
  return {
    organizationId: connection.organizationId,
    lastRunAt: connection.discoveryLastRunAt,
    contactExternalIdField: {
      fieldId: connection.contactExternalIdFieldId,
      apiName: connection.contactExternalIdApiName,
      isUnique: connection.contactExternalIdIsUnique,
      ready: Boolean(
        connection.contactExternalIdFieldId
        && connection.contactExternalIdApiName
        && connection.contactExternalIdIsUnique,
      ),
    },
    counts: Object.fromEntries(counts.map((entry) => [entry.resourceType, entry._count._all])),
    items,
  };
}
