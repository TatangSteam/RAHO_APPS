export type ZohoMasterEntityType =
  | 'MASTER_PRODUCT'
  | 'PACKAGE_PRICING'
  | 'BRANCH_LOCATION'
  | 'STOCK_LOCATION';

export type ZohoItemEntityType = Extract<ZohoMasterEntityType, 'MASTER_PRODUCT' | 'PACKAGE_PRICING'>;
export type ZohoLocationEntityType = Extract<ZohoMasterEntityType, 'BRANCH_LOCATION' | 'STOCK_LOCATION'>;

export const ITEM_ACCOUNT_ROLES = ['ITEM_SALES', 'ITEM_PURCHASE', 'ITEM_INVENTORY'] as const;
export type ItemAccountRole = typeof ITEM_ACCOUNT_ROLES[number];

export type ItemAccountConfig = {
  salesAccountId?: string;
  purchaseAccountId?: string;
  inventoryAccountId?: string;
};

export type ZohoAccountCandidate = {
  zohoId: string;
  name: string;
  payload: unknown;
};

const ITEM_ACCOUNT_DEFAULTS: Record<ItemAccountRole, { name: string; accountType: string }> = {
  ITEM_SALES: { name: 'sales', accountType: 'income' },
  ITEM_PURCHASE: { name: 'cost of goods sold', accountType: 'cost_of_goods_sold' },
  ITEM_INVENTORY: { name: 'inventory asset', accountType: 'stock' },
};

function accountType(account: ZohoAccountCandidate): string {
  if (!account.payload || typeof account.payload !== 'object' || Array.isArray(account.payload)) return '';
  const value = (account.payload as Record<string, unknown>).account_type;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidItemAccount(role: ItemAccountRole, account: ZohoAccountCandidate): boolean {
  return accountType(account) === ITEM_ACCOUNT_DEFAULTS[role].accountType;
}

export function findDefaultItemAccount(
  role: ItemAccountRole,
  accounts: ZohoAccountCandidate[],
): ZohoAccountCandidate | null {
  const expected = ITEM_ACCOUNT_DEFAULTS[role];
  const matches = accounts.filter(
    (account) => normalized(account.name) === expected.name && isValidItemAccount(role, account),
  );
  return matches.length === 1 ? matches[0] : null;
}

export type LocalItemSnapshot = {
  entityType: ZohoItemEntityType;
  localEntityId: string;
  externalKey: string;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  rate: number | null;
  isActive: boolean;
  duplicateSkuCount: number;
};

export type LocalLocationSnapshot = {
  entityType: ZohoLocationEntityType;
  localEntityId: string;
  externalKey: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
  eligible: boolean;
  excludedReason: string | null;
};

export type ZohoItemCandidate = {
  item_id: string;
  name: string;
  sku?: string;
  status?: string;
  product_type?: string;
};

export type ZohoLocationCandidate = {
  location_id: string;
  location_name: string;
  status?: string;
  type?: string;
};

export type MasterMatchDecision<T> =
  | { kind: 'CREATE'; candidates: T[] }
  | { kind: 'AUTO_MATCH'; candidate: T; candidates: T[] }
  | { kind: 'REVIEW'; candidates: T[]; reason: string };

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('id-ID') : '';
}

export function validateItemSnapshot(
  snapshot: LocalItemSnapshot,
  accounts: ItemAccountConfig,
): string[] {
  const issues: string[] = [];
  if (!snapshot.sku?.trim()) issues.push('SKU/product code wajib diisi.');
  if (snapshot.duplicateSkuCount > 1) issues.push('SKU/product code digunakan lebih dari satu master aktif.');
  if (!accounts.salesAccountId) issues.push('Sales account Zoho belum dipetakan.');
  if (!snapshot.unit?.trim()) issues.push('UOM belum dipetakan ke unit Zoho.');
  if (snapshot.entityType === 'MASTER_PRODUCT') {
    if (!accounts.purchaseAccountId) issues.push('Purchase account Zoho belum dipetakan.');
    if (!accounts.inventoryAccountId) issues.push('Inventory account Zoho belum dipetakan.');
  }
  return issues;
}

export function buildZohoItemPayload(
  snapshot: LocalItemSnapshot,
  accounts: ItemAccountConfig,
): Record<string, unknown> {
  if (snapshot.entityType === 'PACKAGE_PRICING') {
    return {
      name: snapshot.name,
      sku: snapshot.sku,
      product_type: 'service',
      item_type: 'sales',
      unit: snapshot.unit,
      rate: snapshot.rate,
      account_id: accounts.salesAccountId,
      ...(snapshot.description ? { description: snapshot.description } : {}),
    };
  }
  return {
    name: snapshot.name,
    sku: snapshot.sku,
    product_type: 'goods',
    item_type: 'inventory',
    unit: snapshot.unit,
    account_id: accounts.salesAccountId,
    purchase_account_id: accounts.purchaseAccountId,
    inventory_account_id: accounts.inventoryAccountId,
    ...(snapshot.description ? { description: snapshot.description } : {}),
  };
}

export function decideItemMatch(
  snapshot: LocalItemSnapshot,
  candidates: ZohoItemCandidate[],
): MasterMatchDecision<ZohoItemCandidate> {
  const exactSku = candidates.filter((candidate) => normalized(candidate.sku) === normalized(snapshot.sku));
  const expectedProductType = snapshot.entityType === 'PACKAGE_PRICING' ? 'service' : 'goods';
  if (exactSku.length === 1 && normalized(exactSku[0].product_type) === expectedProductType) {
    return { kind: 'AUTO_MATCH', candidate: exactSku[0], candidates: exactSku };
  }
  if (exactSku.length) {
    return {
      kind: 'REVIEW',
      candidates: exactSku,
      reason: exactSku.length > 1
        ? 'Lebih dari satu item Zoho memiliki SKU yang sama.'
        : 'SKU sama ditemukan, tetapi tipe goods/service berbeda.',
    };
  }
  const sameName = candidates.filter((candidate) => normalized(candidate.name) === normalized(snapshot.name));
  if (sameName.length) {
    return {
      kind: 'REVIEW',
      candidates: sameName,
      reason: sameName.length > 1
        ? 'Beberapa item Zoho memiliki nama yang sama.'
        : 'Nama item sama ditemukan tanpa SKU yang cocok.',
    };
  }
  return { kind: 'CREATE', candidates: [] };
}

export function buildZohoLocationPayload(snapshot: LocalLocationSnapshot): Record<string, unknown> {
  return {
    location_name: snapshot.name,
    phone: snapshot.phone || undefined,
    country: 'Indonesia',
    address: {
      street_address1: snapshot.address || undefined,
      city: snapshot.city || undefined,
      country: 'Indonesia',
    },
  };
}

export function decideLocationMatch(
  snapshot: LocalLocationSnapshot,
  candidates: ZohoLocationCandidate[],
): MasterMatchDecision<ZohoLocationCandidate> {
  const exactName = candidates.filter(
    (candidate) => normalized(candidate.location_name) === normalized(snapshot.name),
  );
  if (exactName.length === 1) {
    return { kind: 'AUTO_MATCH', candidate: exactName[0], candidates: exactName };
  }
  if (exactName.length > 1) {
    return {
      kind: 'REVIEW',
      candidates: exactName,
      reason: 'Lebih dari satu Zoho Location memakai nama/kode RAHO yang sama.',
    };
  }
  return { kind: 'CREATE', candidates: [] };
}
