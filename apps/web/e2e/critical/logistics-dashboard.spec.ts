import { expect, test } from '../fixtures/base';

const branchId = 'branch-hq';
const mockDashboard = {
  generatedAt: '2026-08-21T03:08:59.000Z',
  filter: { branchId, startDate: '2026-07-23', endDate: '2026-08-21', timeZone: 'Asia/Jakarta' },
  stockSnapshot: { onHandQty: '3144', availableQty: '3144', reservedQty: '0', quarantineQty: '0', inTransitQty: '0', lowStockItems: 7, outOfStockItems: 0, expiringBatchCount: 0 },
  valuation: { layerValue: '0', inTransitValue: '0', totalAssetValue: '0', valuedLayerQty: '0', pendingValuationQty: '3144', layerMismatchCount: 0 },
  movements: { postingCount: 0, byType: {}, trend: [] },
  usage: { usageLines: 0, actualCost: '0', topProducts: [] },
  requests: { total: 0, byStatus: {} },
  shipments: { total: 0, byStatus: {}, sentQty: '0', receivedQty: '0', quarantineQty: '0', averageLeadTimeHours: null },
  discrepancies: { total: 0, open: 0, resolved: 0, quarantineQty: '0', byType: {} },
  opnames: { total: 0, byStatus: {}, absoluteDifferenceQty: '0', differenceValue: '0' },
};

const mockValuation = {
  generatedAt: '2026-08-21T03:08:59.000Z',
  filter: { branchId, masterProductId: null, stockLocationId: null },
  summary: { onHandQty: '3144', reservedQty: '0', quarantineQty: '0', inTransitQty: '0', valuedQty: '0', pendingValuationQty: '3144', layerValue: '0', inTransitValue: '0', totalAssetValue: '0', inTransitValueIncluded: true },
  data: [{
    id: 'balance-1', inventoryItemId: 'item-1', onHandQty: '3144', reservedQty: '0', quarantineQty: '0', inTransitQty: '0', valuedQty: '0', pendingValuationQty: '3144', inventoryValue: '0', averageUnitCost: null, quantityReconciled: true,
    branch: { id: branchId, branchCode: 'HQ', name: 'Head Office' },
    masterProduct: { id: 'product-1', sku: 'PRD-TEST-001', name: 'Produk Pending Valuation', unit: 'pcs' },
    stockLocation: { id: 'location-1', code: 'MAIN', name: 'Main', warehouse: { id: 'warehouse-1', code: 'HQ', name: 'HQ' } },
    batch: null,
    costLayers: [{ id: 'layer-1', sourceType: 'OPENING', sourceId: 'opening-1', remainingQty: '3144', unitCost: null, valuationStatus: 'PENDING_VALUATION', receivedAt: '2026-07-23T00:00:00.000Z' }],
  }],
  meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

test.describe('Logistics dashboard valuation', () => {
  test('labels incomplete valuation and remains usable on mobile', async ({ page, request }) => {
    void request;
    const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
    await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'user-1' })).toString('base64'), domain: 'localhost', path: '/' }]);
    await page.addInitScript(({ accessToken, selectedBranchId }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { userId: 'user-1', email: 'superadmin@raho.id', role: 'SUPER_ADMIN', branchId: selectedBranchId, branchCode: 'HQ', fullName: 'Super Administrator', staffCode: null, branches: [selectedBranchId] }, accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, activeBranchId: selectedBranchId, assignedBranches: [selectedBranchId] }, version: 0 }));
    }, { accessToken: token, selectedBranchId: branchId });
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      let data: unknown = [];
      if (url.includes('/branches')) data = [{ id: branchId, branchCode: 'HQ', name: 'Head Office' }];
      else if (url.includes('/inventory/reports/logistics-dashboard')) data = mockDashboard;
      else if (url.includes('/inventory/reports/valuation')) data = mockValuation;
      else if (url.includes('/inventory/items')) data = { items: [{ id: 'item-1', masterProduct: mockValuation.data[0].masterProduct }] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await page.goto('/inventory/dashboard');

    await expect(page).toHaveURL(/\/inventory\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard Logistik' })).toBeVisible();
    await expect(page.getByText('Pending valuation', { exact: true })).toBeVisible();
    await expect(page.getByText('Mismatch quantity/layer', { exact: true })).toBeVisible();

    const assetCard = page.getByText('Nilai aset inventory', { exact: true }).locator('..');
    if (await page.getByText('Nilai inventory belum lengkap.').count()) {
      await expect(assetCard.locator('strong')).toHaveText('Belum lengkap');
    } else {
      await expect(assetCard.locator('strong')).toContainText('Rp');
    }

    await page.getByRole('button', { name: 'Nilai Stok', exact: true }).click();
    await expect(page.getByText('Stok sudah dinilai', { exact: true })).toBeVisible();
    const pendingText = await page.getByText('Stok perlu HPP', { exact: true }).locator('..').locator('strong').innerText();
    const pendingQty = Number(pendingText.replace(/\./g, '').replace(',', '.'));
    const totalAsset = page.getByText('Total aset', { exact: true }).locator('..').locator('strong');
    if (pendingQty > 0) await expect(totalAsset).toHaveText('Belum lengkap');
    else await expect(totalAsset).toContainText('Rp');

    await page.screenshot({ path: test.info().outputPath('logistics-dashboard-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Isi HPP' })).toBeVisible();
    const mobileLayout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 8)
        .map((element) => ({ tag: element.tagName, text: element.innerText?.slice(0, 80), className: element.className })),
    }));
    expect(mobileLayout.overflow, JSON.stringify(mobileLayout.offenders)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath('logistics-dashboard-mobile.png'), fullPage: true });
  });

  test('values existing stock from a short form without changing quantity', async ({ page }) => {
    const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
    await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'user-1' })).toString('base64'), domain: 'localhost', path: '/' }]);
    await page.addInitScript(({ accessToken, selectedBranchId }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { userId: 'user-1', email: 'superadmin@raho.id', role: 'SUPER_ADMIN', branchId: selectedBranchId, branchCode: 'HQ', fullName: 'Super Administrator', staffCode: null, branches: [selectedBranchId] }, accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, activeBranchId: selectedBranchId, assignedBranches: [selectedBranchId] }, version: 0 }));
    }, { accessToken: token, selectedBranchId: branchId });

    let savedPayload: Record<string, unknown> | null = null;
    let valued = false;
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      let data: unknown = [];
      if (url.includes('/branches')) data = [{ id: branchId, branchCode: 'HQ', name: 'Head Office' }];
      else if (url.includes('/inventory/reports/logistics-dashboard')) data = valued ? { ...mockDashboard, valuation: { ...mockDashboard.valuation, layerValue: '47160000', totalAssetValue: '47160000', valuedLayerQty: '3144', pendingValuationQty: '0' } } : mockDashboard;
      else if (url.includes('/inventory/reports/valuation')) data = valued
        ? { ...mockValuation, summary: { ...mockValuation.summary, valuedQty: '3144', pendingValuationQty: '0', layerValue: '47160000', totalAssetValue: '47160000' }, data: url.includes('pendingOnly=true') ? [] : [{ ...mockValuation.data[0], valuedQty: '3144', pendingValuationQty: '0', inventoryValue: '47160000', averageUnitCost: '15000', costLayers: [{ ...mockValuation.data[0].costLayers[0], unitCost: '15000', valuationStatus: 'VALUED' }] }], meta: { ...mockValuation.meta, total: url.includes('pendingOnly=true') ? 0 : 1, totalPages: url.includes('pendingOnly=true') ? 0 : 1 } }
        : mockValuation;
      else if (url.includes('/inventory/items/item-1/adjust-stock') && route.request().method() === 'PATCH') {
        savedPayload = route.request().postDataJSON();
        valued = true;
        data = { valuation: { inventoryItemId: 'item-1', quantityValued: '3144', unitCost: '15000', totalValue: '47160000' } };
      }
      else if (url.includes('/inventory/items')) data = { items: [{ id: 'item-1', masterProduct: mockValuation.data[0].masterProduct }] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });

    await page.goto('/inventory/dashboard');
    await page.getByRole('button', { name: 'Nilai Stok', exact: true }).click();
    await page.getByRole('button', { name: 'Isi HPP' }).click();
    const dialog = page.getByRole('dialog', { name: 'Isi HPP stok lama' });
    await dialog.getByLabel('HPP per pcs').fill('15000');
    await dialog.getByLabel('Nomor invoice / PO / dokumen saldo awal').fill('OPENING-2026-001');
    await dialog.getByLabel('Catatan dasar HPP').fill('Harga dari dokumen stok awal');
    await expect(dialog.getByText('Rp 47.160.000')).toBeVisible();
    await dialog.getByRole('button', { name: 'Simpan HPP' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'Tidak ada stok yang menunggu HPP.' })).toBeVisible();
    expect(savedPayload).toMatchObject({ adjustment: 0, unitCost: '15000', valuationDocumentReference: 'OPENING-2026-001', reasonCode: 'LEGACY_OPENING_VALUATION', stockLocationId: 'location-1' });
  });

  test('shows a searched SKU with no cost layer and lets Super Admin value it', async ({ page }) => {
    const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
    await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'user-1' })).toString('base64'), domain: 'localhost', path: '/' }]);
    await page.addInitScript(({ accessToken, selectedBranchId }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { userId: 'user-1', email: 'superadmin@raho.id', role: 'SUPER_ADMIN', branchId: selectedBranchId, branchCode: 'HQ', fullName: 'Super Administrator', staffCode: null, branches: [selectedBranchId] }, accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, activeBranchId: selectedBranchId, assignedBranches: [selectedBranchId] }, version: 0 }));
    }, { accessToken: token, selectedBranchId: branchId });

    const noLayer = {
      ...mockValuation,
      summary: { ...mockValuation.summary, pendingValuationQty: '0', missingCostLayerQty: '72' },
      data: [{ ...mockValuation.data[0], onHandQty: '72', pendingValuationQty: '0', quantityReconciled: false, costLayers: [], masterProduct: { ...mockValuation.data[0].masterProduct, sku: 'PRD-ANN-BRU-001', name: 'Air Nano Biru 600ml' } }],
      skuLookup: { sku: 'PRD-ANN-BRU-001', productName: 'Air Nano Biru 600ml', baseUnit: 'Botol', inventoryItemId: 'item-1', stockLocationId: 'location-1', valuationBatchId: null, valuationBatchNumber: null, mirrorQty: '72', onHandQty: '72', readyQty: '0', pendingQty: '0', missingLayerQty: '72', canValue: true, status: 'NO_COST_LAYER' },
    };
    let savedPayload: Record<string, unknown> | null = null;
    let valued = false;
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      let data: unknown = [];
      if (url.includes('/branches')) data = [{ id: branchId, branchCode: 'HQ', name: 'Head Office' }];
      else if (url.includes('/inventory/reports/logistics-dashboard')) data = { ...mockDashboard, valuation: { ...mockDashboard.valuation, pendingValuationQty: '0', layerMismatchCount: valued ? 0 : 1, layerValue: valued ? '864000' : '0', totalAssetValue: valued ? '864000' : '0' } };
      else if (url.includes('/inventory/reports/valuation')) data = url.includes('search=PRD-ANN-BRU-001')
        ? valued
          ? { ...noLayer, summary: { ...noLayer.summary, missingCostLayerQty: '0', valuedQty: '72', layerValue: '864000', totalAssetValue: '864000' }, data: [], meta: { ...noLayer.meta, total: 0, totalPages: 0 }, skuLookup: { ...noLayer.skuLookup, status: 'READY', canValue: false, readyQty: '72', missingLayerQty: '0' } }
          : noLayer
        : { ...mockValuation, data: [], meta: { ...mockValuation.meta, total: 0, totalPages: 0 } };
      else if (url.includes('/inventory/items/item-1/adjust-stock') && route.request().method() === 'PATCH') {
        savedPayload = route.request().postDataJSON();
        valued = true;
        data = { valuation: { quantityValued: '72', unitCost: '12000', totalValue: '864000' } };
      }
      else if (url.includes('/inventory/items')) data = { items: [{ id: 'item-1', masterProduct: noLayer.data[0].masterProduct }] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });

    await page.goto('/inventory/dashboard');
    await page.getByRole('button', { name: 'Nilai Stok', exact: true }).click();
    await page.getByLabel('Cari produk').fill('PRD-ANN-BRU-001');
    await page.getByRole('button', { name: 'Cari', exact: true }).click();
    await expect(page.getByText('Stok ada, cost layer belum ada: PRD-ANN-BRU-001')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Isi HPP tanpa menambah stok' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Isi HPP tanpa menambah stok' })).toBeVisible();
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath('sku-no-cost-layer-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Isi HPP tanpa menambah stok' }).click();
    const dialog = page.getByRole('dialog', { name: 'Isi HPP stok lama' });
    await dialog.getByLabel('HPP per Botol').fill('12000');
    await dialog.getByLabel('Nomor invoice / PO / dokumen saldo awal').fill('OPENING-2026-BRU');
    await dialog.getByLabel('Catatan dasar HPP').fill('Dokumen stok awal Air Nano');
    await expect(dialog.getByText('Cost layer yang hilang akan dipulihkan dahulu')).toBeVisible();
    await dialog.getByRole('button', { name: 'Simpan HPP' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('Stok bernilai siap jual: PRD-ANN-BRU-001')).toBeVisible();
    expect(savedPayload).toMatchObject({ adjustment: 0, unitCost: '12000', valuationDocumentReference: 'OPENING-2026-BRU', stockLocationId: 'location-1' });
  });

  test('explains when the SKU is not assigned to the selected branch', async ({ page }) => {
    const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
    await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'user-1' })).toString('base64'), domain: 'localhost', path: '/' }]);
    await page.addInitScript(({ accessToken, selectedBranchId }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { userId: 'user-1', email: 'superadmin@raho.id', role: 'SUPER_ADMIN', branchId: selectedBranchId, branchCode: 'HQ', fullName: 'Super Administrator', staffCode: null, branches: [selectedBranchId] }, accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, activeBranchId: selectedBranchId, assignedBranches: [selectedBranchId] }, version: 0 }));
    }, { accessToken: token, selectedBranchId: branchId });
    const notAssigned = {
      ...mockValuation,
      data: [], meta: { ...mockValuation.meta, total: 0, totalPages: 0 },
      skuLookup: { sku: 'PRD-ANN-BRU-001', productName: 'Air Nano Biru 600ml', baseUnit: 'Botol', inventoryItemId: null, stockLocationId: null, valuationBatchId: null, valuationBatchNumber: null, mirrorQty: '0', onHandQty: '0', readyQty: '0', pendingQty: '0', missingLayerQty: '0', canValue: false, status: 'NOT_ASSIGNED_TO_BRANCH' },
    };
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      let data: unknown = [];
      if (url.includes('/branches')) data = [{ id: branchId, branchCode: 'HQ', name: 'Head Office' }];
      else if (url.includes('/inventory/reports/logistics-dashboard')) data = mockDashboard;
      else if (url.includes('/inventory/reports/valuation')) data = url.includes('search=PRD-ANN-BRU-001') ? notAssigned : { ...mockValuation, data: [], meta: { ...mockValuation.meta, total: 0, totalPages: 0 } };
      else if (url.includes('/inventory/items')) data = { items: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });

    await page.goto('/inventory/dashboard');
    await page.getByRole('button', { name: 'Nilai Stok', exact: true }).click();
    await page.getByLabel('Cari produk').fill('PRD-ANN-BRU-001');
    await page.getByRole('button', { name: 'Cari', exact: true }).click();
    await expect(page.getByText('Produk belum ada di cabang ini: PRD-ANN-BRU-001')).toBeVisible();
    await expect(page.getByText('Pastikan cabang ini adalah cabang transaksi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Isi HPP tanpa menambah stok' })).toHaveCount(0);
  });
});
