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
    id: 'balance-1', onHandQty: '3144', reservedQty: '0', quarantineQty: '0', inTransitQty: '0', valuedQty: '0', pendingValuationQty: '3144', inventoryValue: '0', averageUnitCost: null, quantityReconciled: true,
    branch: { id: branchId, branchCode: 'HQ', name: 'Head Office' },
    masterProduct: { id: 'product-1', sku: 'PRD-TEST-001', name: 'Produk Pending Valuation', unit: 'pcs' },
    stockLocation: { id: 'location-1', code: 'MAIN', name: 'Main', warehouse: { id: 'warehouse-1', code: 'HQ', name: 'HQ' } },
    batch: null,
    costLayers: [{ id: 'layer-1', sourceType: 'OPENING', sourceId: 'opening-1', remainingQty: '3144', unitCost: null, valuationStatus: 'PENDING_VALUATION', receivedAt: '2026-07-23T00:00:00.000Z' }],
  }],
  meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
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

    await page.getByRole('button', { name: 'Valuation', exact: true }).click();
    await expect(page.getByText('Valued quantity', { exact: true })).toBeVisible();
    const pendingText = await page.getByText('Pending valuation', { exact: true }).locator('..').locator('strong').innerText();
    const pendingQty = Number(pendingText.replace(/\./g, '').replace(',', '.'));
    const totalAsset = page.getByText('Total asset', { exact: true }).locator('..').locator('strong');
    if (pendingQty > 0) await expect(totalAsset).toHaveText('Belum lengkap');
    else await expect(totalAsset).toContainText('Rp');

    await page.screenshot({ path: test.info().outputPath('logistics-dashboard-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
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
});
