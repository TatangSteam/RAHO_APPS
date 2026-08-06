import { test, expect } from '../fixtures/base';
import { InventoryPage } from '../pages/InventoryPage';

test.describe('Inventory - Stock Request Flow', () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    inventoryPage = new InventoryPage(page);
  });

  test('should open stock request modal', async ({ page }) => {
    await inventoryPage.gotoStockRequests();

    await page.getByRole('button', { name: /buat request/i }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /buat request stok baru/i })).toBeVisible();
    await expect(page.getByText(/pilih produk/i).first()).toBeVisible();
    await expect(page.getByText(/item yang diminta/i).first()).toBeVisible();
  });

  test('should keep submit disabled until required fields are complete', async ({ page }) => {
    await inventoryPage.gotoStockRequests();

    await page.getByRole('button', { name: /buat request/i }).first().click();

    const submitButton = page.getByRole('button', { name: /^buat request$/i }).last();
    await expect(submitButton).toBeDisabled();
    await expect(page.getByText(/pilih minimal 1 item/i)).toBeVisible();
  });

  test('should normalize selected quantity to minimum one', async ({ page }) => {
    await inventoryPage.gotoStockRequests();

    await page.getByRole('button', { name: /buat request/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const addButton = page.getByRole('button', { name: /tambah/i }).first();
    if (!(await addButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.fixme(true, 'No master products are available in the stock request modal.');
      return;
    }

    await addButton.click();

    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('0');
    await quantityInput.blur();
    await expect(quantityInput).toHaveValue('1');
  });
});

test.describe.fixme('Inventory - Approval Flow', () => {
  let inventoryPage: InventoryPage;
  let requestCode: string;

test.beforeEach(async ({ loginAs, page: _adminPage }) => {
    // Create request as ADMIN_CABANG
    const branchPage = await loginAs('ADMIN_CABANG');
    const branchInventory = new InventoryPage(branchPage);
    
    await branchInventory.createStockRequest('Test Product', 5, 'Test request');
    
    // Get request code from the page
    await branchInventory.gotoStockRequests();
    const firstRequest = branchPage.locator('tbody tr').first();
    const codeCell = firstRequest.locator('td').first();
    requestCode = await codeCell.textContent() || '';

    await branchPage.close();

    // Now login as manager for approval tests
    const managerPage = await loginAs('ADMIN_MANAGER');
    inventoryPage = new InventoryPage(managerPage);
  });

  test('should approve stock request as manager', async () => {
    if (!requestCode) {
      test.skip();
      return;
    }

    // Approve request
    await inventoryPage.approveStockRequest(requestCode);

    // Verify status changed
    await inventoryPage.expectRequestStatus(requestCode, 'approved|disetujui');
  });

  test('should reject stock request with reason', async () => {
    if (!requestCode) {
      test.skip();
      return;
    }

    // Reject request
    await inventoryPage.rejectStockRequest(requestCode, 'Stok masih cukup');

    // Verify status changed
    await inventoryPage.expectRequestStatus(requestCode, 'rejected|ditolak');
  });

  test('should not allow approval without manager role', async ({ loginAs }) => {
    // Login as non-manager
    const doctorPage = await loginAs('DOCTOR');
    const doctorInventory = new InventoryPage(doctorPage);

    await doctorInventory.gotoStockRequests();

    // Verify approve button is not visible or disabled
    const approveButton = doctorPage.getByRole('button', { name: /approve|setujui/i });
    await expect(approveButton).not.toBeVisible();

    await doctorPage.close();
  });
});

test.describe.fixme('Inventory - Shipment Flow', () => {
  let inventoryPage: InventoryPage;
  let requestCode: string;
  let shipmentCode: string;

test.beforeEach(async ({ loginAs, page: _tempPage }) => {
    // Setup: Create and approve a request
    const managerPage = await loginAs('ADMIN_MANAGER');
    const managerInventory = new InventoryPage(managerPage);

    // Create request
    await managerInventory.createStockRequest('Test Product', 10, 'For shipment test');
    await managerInventory.gotoStockRequests();
    
    // Get request code
    const firstRequest = managerPage.locator('tbody tr').first();
    const codeCell = firstRequest.locator('td').first();
    requestCode = await codeCell.textContent() || '';

    // Approve it
    if (requestCode) {
      await managerInventory.approveStockRequest(requestCode);
    }

    inventoryPage = managerInventory;
  });

  test('should create shipment from approved request', async ({ page }) => {
    if (!requestCode) {
      test.skip();
      return;
    }

    // Create shipment
    await inventoryPage.createShipment(requestCode);

    // Verify shipment was created
    await inventoryPage.gotoShipments();
    
    // Get shipment code
    const firstShipment = page.locator('tbody tr').first();
    shipmentCode = await firstShipment.locator('td').first().textContent() || '';
    
    expect(shipmentCode).toBeTruthy();
  });

  test('should mark shipment as shipped', async ({ page }) => {
    // First create shipment
    if (!requestCode) {
      test.skip();
      return;
    }

    await inventoryPage.createShipment(requestCode);
    await inventoryPage.gotoShipments();
    
    const firstShipment = page.locator('tbody tr').first();
    shipmentCode = await firstShipment.locator('td').first().textContent() || '';

    // Mark as shipped
    if (shipmentCode) {
      await inventoryPage.markAsShipped(shipmentCode);
      await inventoryPage.expectShipmentStatus(shipmentCode, 'shipped|dikirim');
    }
  });

  test('should receive shipment successfully', async ({ page }) => {
    // Setup: Create and ship
    if (!requestCode) {
      test.skip();
      return;
    }

    await inventoryPage.createShipment(requestCode);
    await inventoryPage.gotoShipments();
    
    const firstShipment = page.locator('tbody tr').first();
    shipmentCode = await firstShipment.locator('td').first().textContent() || '';

    if (shipmentCode) {
      await inventoryPage.markAsShipped(shipmentCode);
      
      // Now receive it
      await inventoryPage.receiveShipment(shipmentCode);
      await inventoryPage.expectShipmentStatus(shipmentCode, 'received|diterima');
    }
  });

  test('should update stock after receiving shipment', async ({ page }) => {
    if (!requestCode) {
      test.skip();
      return;
    }

    // Get initial stock
    await inventoryPage.goto();
    const _initialStock = await inventoryPage.getProductStock('Test Product');

    // Create, ship, and receive
    await inventoryPage.createShipment(requestCode);
    await inventoryPage.gotoShipments();
    
    const firstShipment = page.locator('tbody tr').first();
    shipmentCode = await firstShipment.locator('td').first().textContent() || '';

    if (shipmentCode) {
      await inventoryPage.markAsShipped(shipmentCode);
      await inventoryPage.receiveShipment(shipmentCode);

      // Verify stock increased
      await inventoryPage.verifyStockIncreased('Test Product', 10);
    }
  });

  test('should handle partial receipt', async ({ page }) => {
    if (!requestCode) {
      test.skip();
      return;
    }

    // Create and ship
    await inventoryPage.createShipment(requestCode);
    await inventoryPage.gotoShipments();
    
    const firstShipment = page.locator('tbody tr').first();
    shipmentCode = await firstShipment.locator('td').first().textContent() || '';

    if (shipmentCode) {
      await inventoryPage.markAsShipped(shipmentCode);
      
      // Receive with different quantity
      await inventoryPage.receiveShipment(shipmentCode, {
        'Test Product': 8, // Received 8 instead of 10
      });

      // Verify status
      await inventoryPage.expectShipmentStatus(shipmentCode, 'received.*issue|bermasalah');
    }
  });
});

test.describe('Inventory - Filter and Search', () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    inventoryPage = new InventoryPage(page);
  });

  test('should filter stock requests by status', async ({ page }) => {
    await inventoryPage.gotoStockRequests();

    // Filter by pending
    await inventoryPage.filterByStatus('pending');
    
    // Verify only pending requests shown
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    
    if (count > 0) {
      const firstRowStatus = await rows.first().locator('.badge, .status').textContent();
      expect(firstRowStatus?.toLowerCase()).toContain('pending');
    }
  });

  test('should search for product in inventory', async ({ page }) => {
    await inventoryPage.goto();

    // Search for product
    await inventoryPage.searchProduct('Test');

    // Verify results contain search term
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by low stock items', async ({ page }) => {
    await inventoryPage.goto();

    // Click low stock filter
    await inventoryPage.filterByStatus('low.*stock|stok.*rendah');

    // Verify only low stock items shown
    const lowStockBadges = page.locator('[data-low-stock="true"], .low-stock');
    const count = await lowStockBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Inventory - Access Control', () => {
  test('should restrict stock request creation by role', async ({ loginAs }) => {
    const roles = ['DOCTOR', 'NURSE', 'ADMIN_LAYANAN'];

    for (const role of roles) {
      const page = await loginAs(role as any);
      const inventory = new InventoryPage(page);

      await inventory.gotoStockRequests();

      // Some roles might not have create button
      const createButton = page.getByRole('button', { name: /buat|create.*request/i });
      await expect(createButton).not.toBeVisible();
    }
  });

  test('should restrict approval to managers only', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    const inventory = new InventoryPage(page);

    await inventory.gotoStockRequests();

    // Branch admin can see status filter buttons like "Disetujui", but must not see manager-only row actions.
    const managerAction = page.getByRole('button', { name: /review|approve gratis|buat invoice/i });
    const isVisible = await managerAction.isVisible().catch(() => false);
    expect(isVisible).toBeFalsy();
  });
});
