import {
  buildZohoItemPayload,
  buildZohoLocationPayload,
  decideItemMatch,
  decideLocationMatch,
  findDefaultItemAccount,
  isValidItemAccount,
  LocalItemSnapshot,
  LocalLocationSnapshot,
  validateItemSnapshot,
} from '../zoho.master.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

const goods: LocalItemSnapshot = {
  entityType: 'MASTER_PRODUCT',
  localEntityId: 'product-1',
  externalKey: 'RAHO:ITEM:product-1',
  sku: 'INF-001',
  name: 'Infusion Set',
  description: 'Alat infus',
  unit: 'pcs',
  rate: null,
  isActive: true,
  duplicateSkuCount: 1,
};

const accounts = {
  salesAccountId: 'sales-1',
  purchaseAccountId: 'purchase-1',
  inventoryAccountId: 'inventory-1',
};

describe('Zoho Sprint 4 item policy', () => {
  it('blocks empty or duplicate SKU', () => {
    expect(validateItemSnapshot({ ...goods, sku: null }, accounts)).toContain('SKU/product code wajib diisi.');
    expect(validateItemSnapshot({ ...goods, duplicateSkuCount: 2 }, accounts))
      .toContain('SKU/product code digunakan lebih dari satu master aktif.');
  });

  it('requires UOM and all inventory accounts for goods', () => {
    const issues = validateItemSnapshot({ ...goods, unit: null }, {});
    expect(issues).toEqual(expect.arrayContaining([
      'UOM belum dipetakan ke unit Zoho.',
      'Sales account Zoho belum dipetakan.',
      'Purchase account Zoho belum dipetakan.',
      'Inventory account Zoho belum dipetakan.',
    ]));
  });

  it('builds goods payload without opening stock, batch, expiry, or BOM', () => {
    const payload = buildZohoItemPayload(goods, accounts);
    expect(payload).toMatchObject({
      sku: 'INF-001',
      product_type: 'goods',
      item_type: 'inventory',
      account_id: 'sales-1',
      purchase_account_id: 'purchase-1',
      inventory_account_id: 'inventory-1',
    });
    expect(JSON.stringify(payload)).not.toMatch(/opening|initial_stock|batch|expiry|bom/i);
  });

  it('builds a service item with rate but without inventory fields', () => {
    const service: LocalItemSnapshot = {
      ...goods,
      entityType: 'PACKAGE_PRICING',
      sku: 'BST-NO-P1-HC',
      name: 'Booster NO',
      unit: 'paket',
      rate: 850_000,
    };
    const payload = buildZohoItemPayload(service, accounts);
    expect(payload).toMatchObject({
      sku: 'BST-NO-P1-HC',
      product_type: 'service',
      item_type: 'sales',
      rate: 850_000,
    });
    expect(payload).not.toHaveProperty('purchase_account_id');
    expect(payload).not.toHaveProperty('inventory_account_id');
  });

  it('auto-matches one exact SKU with the correct product type', () => {
    expect(decideItemMatch(goods, [{
      item_id: 'z-item-1',
      name: goods.name,
      sku: goods.sku!,
      product_type: 'goods',
    }]).kind).toBe('AUTO_MATCH');
  });

  it('requires review for duplicate SKU or a wrong goods/service type', () => {
    expect(decideItemMatch(goods, [
      { item_id: 'z-1', name: goods.name, sku: goods.sku!, product_type: 'goods' },
      { item_id: 'z-2', name: goods.name, sku: goods.sku!, product_type: 'goods' },
    ]).kind).toBe('REVIEW');
    expect(decideItemMatch(goods, [
      { item_id: 'z-service', name: goods.name, sku: goods.sku!, product_type: 'service' },
    ]).kind).toBe('REVIEW');
  });

  it('requests official settings write scopes for Item and Location', () => {
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.settings.READ',
      'ZohoBooks.settings.CREATE',
      'ZohoBooks.settings.UPDATE',
    ]));
    expect(ZOHO_REQUIRED_SCOPES).not.toContain('ZohoBooks.items.READ');
  });

  it('selects only the unambiguous default account for each item role', () => {
    const discovered = [
      { zohoId: 'sales', name: 'Sales', payload: { account_type: 'income' } },
      { zohoId: 'cogs', name: 'Cost of Goods Sold', payload: { account_type: 'cost_of_goods_sold' } },
      { zohoId: 'stock', name: 'Inventory Asset', payload: { account_type: 'stock' } },
    ];
    expect(findDefaultItemAccount('ITEM_SALES', discovered)?.zohoId).toBe('sales');
    expect(findDefaultItemAccount('ITEM_PURCHASE', discovered)?.zohoId).toBe('cogs');
    expect(findDefaultItemAccount('ITEM_INVENTORY', discovered)?.zohoId).toBe('stock');
    expect(isValidItemAccount('ITEM_INVENTORY', discovered[0])).toBe(false);
  });
});

describe('Zoho Sprint 4 location policy', () => {
  const location: LocalLocationSnapshot = {
    entityType: 'BRANCH_LOCATION',
    localEntityId: 'branch-1',
    externalKey: 'RAHO:BRANCH:JKT01',
    code: 'JKT01',
    name: '[JKT01] RAHO Jakarta',
    address: 'Jalan Sehat',
    city: 'Jakarta',
    phone: '080000000',
    isActive: true,
    eligible: true,
    excludedReason: null,
  };

  it('includes the stable branch code in location name and Indonesian address', () => {
    expect(buildZohoLocationPayload(location)).toMatchObject({
      location_name: '[JKT01] RAHO Jakarta',
      country: 'Indonesia',
      address: { city: 'Jakarta', country: 'Indonesia' },
    });
  });

  it('auto-matches one exact coded name and reviews duplicates', () => {
    expect(decideLocationMatch(location, [{
      location_id: 'loc-1',
      location_name: location.name,
    }]).kind).toBe('AUTO_MATCH');
    expect(decideLocationMatch(location, [
      { location_id: 'loc-1', location_name: location.name },
      { location_id: 'loc-2', location_name: location.name },
    ]).kind).toBe('REVIEW');
  });
});
