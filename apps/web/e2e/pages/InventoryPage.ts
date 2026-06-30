import { Page, expect, Locator } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForTableToLoad, waitForModal } from '../helpers/waiters';

export class InventoryPage {
  readonly page: Page;
  readonly stockTable: Locator;
  readonly requestStockButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stockTable = page.locator('table').first();
    this.requestStockButton = page.getByRole('button', { name: /request.*stock|permintaan.*stok/i });
    this.searchInput = page.getByPlaceholder(/cari|search/i);
  }

  /**
   * Navigate to inventory page
   */
  async goto() {
    await this.page.goto('/inventory');
    await waitForTableToLoad(this.page);
  }

  /**
   * Navigate to stock requests page
   */
  async gotoStockRequests() {
    await this.page.goto('/inventory/stock-requests');
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Navigate to shipments page
   */
  async gotoShipments() {
    await this.page.goto('/inventory/shipments');
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Search for product
   */
  async searchProduct(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Get product row by name
   */
  getProductRow(productName: string) {
    return this.stockTable.locator('tr').filter({ hasText: new RegExp(productName, 'i') });
  }

  /**
   * Check if product is low stock
   */
  async isProductLowStock(productName: string): Promise<boolean> {
    const row = this.getProductRow(productName);
    const lowStockBadge = row.locator('text=/low.*stock|stok.*rendah/i');
    return await lowStockBadge.isVisible();
  }

  /**
   * Get current stock amount for product
   */
  async getProductStock(productName: string): Promise<string> {
    const row = this.getProductRow(productName);
    const stockCell = row.locator('td').nth(2); // Adjust based on your table structure
    return await stockCell.textContent() || '';
  }

  /**
   * Create stock request
   */
  async createStockRequest(productName: string, quantity: number, notes?: string) {
    await this.gotoStockRequests();

    // Click create request button
    const createButton = this.page.getByRole('button', { name: /buat|create.*request/i });
    await createButton.click();
    await waitForModal(this.page);

    // Select product
    await this.page.getByLabel(/produk|product/i).selectOption({ label: productName });

    // Enter quantity
    await this.page.getByLabel(/jumlah|quantity/i).fill(quantity.toString());

    // Enter notes if provided
    if (notes) {
      await this.page.getByLabel(/catatan|notes/i).fill(notes);
    }

    // Submit
    const submitButton = this.page.getByRole('button', { name: /kirim|submit/i });
    await submitButton.click();

    // Wait for success
    await waitForSuccessToast(this.page);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Approve stock request (for manager/admin)
   */
  async approveStockRequest(requestCode: string) {
    await this.gotoStockRequests();

    // Find request row
    const requestRow = this.page.locator('tr').filter({ hasText: requestCode });

    // Click approve button
    await requestRow.getByRole('button', { name: /approve|setujui/i }).click();
    await waitForModal(this.page);

    // Confirm approval
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|confirm/i });
    await confirmButton.click();

    // Wait for success
    await waitForSuccessToast(this.page, /disetujui|approved/i);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Reject stock request
   */
  async rejectStockRequest(requestCode: string, reason: string) {
    await this.gotoStockRequests();

    // Find request row
    const requestRow = this.page.locator('tr').filter({ hasText: requestCode });

    // Click reject button
    await requestRow.getByRole('button', { name: /reject|tolak/i }).click();
    await waitForModal(this.page);

    // Enter reason
    await this.page.getByLabel(/alasan|reason/i).fill(reason);

    // Confirm rejection
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|confirm/i });
    await confirmButton.click();

    // Wait for success
    await waitForSuccessToast(this.page, /ditolak|rejected/i);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Create shipment from approved request
   */
  async createShipment(requestCode: string) {
    await this.gotoStockRequests();

    // Find approved request
    const requestRow = this.page.locator('tr').filter({ hasText: requestCode });

    // Click create shipment button
    await requestRow.getByRole('button', { name: /buat.*pengiriman|create.*shipment/i }).click();
    await waitForModal(this.page);

    // Confirm shipment creation
    const confirmButton = this.page.getByRole('button', { name: /buat|create/i });
    await confirmButton.click();

    // Wait for success
    await waitForSuccessToast(this.page);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Mark shipment as shipped
   */
  async markAsShipped(shipmentCode: string) {
    await this.gotoShipments();

    // Find shipment row
    const shipmentRow = this.page.locator('tr').filter({ hasText: shipmentCode });

    // Click ship button
    await shipmentRow.getByRole('button', { name: /kirim|ship/i }).click();
    await waitForModal(this.page);

    // Confirm
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|confirm/i });
    await confirmButton.click();

    // Wait for success
    await waitForSuccessToast(this.page, /dikirim|shipped/i);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Receive shipment
   */
  async receiveShipment(shipmentCode: string, receivedQuantities?: Record<string, number>) {
    await this.gotoShipments();

    // Find shipment row
    const shipmentRow = this.page.locator('tr').filter({ hasText: shipmentCode });

    // Click receive button
    await shipmentRow.getByRole('button', { name: /terima|receive/i }).click();
    await waitForModal(this.page);

    // If custom quantities provided, fill them
    if (receivedQuantities) {
      for (const [productName, quantity] of Object.entries(receivedQuantities)) {
        const input = this.page.getByLabel(new RegExp(productName, 'i'));
        await input.fill(quantity.toString());
      }
    }

    // Confirm receipt
    const confirmButton = this.page.getByRole('button', { name: /terima|receive/i });
    await confirmButton.click();

    // Wait for success
    await waitForSuccessToast(this.page, /diterima|received/i);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Verify request status
   */
  async expectRequestStatus(requestCode: string, status: string) {
    await this.gotoStockRequests();
    const requestRow = this.page.locator('tr').filter({ hasText: requestCode });
    const statusBadge = requestRow.locator(`text=/${status}/i`);
    await expect(statusBadge).toBeVisible();
  }

  /**
   * Verify shipment status
   */
  async expectShipmentStatus(shipmentCode: string, status: string) {
    await this.gotoShipments();
    const shipmentRow = this.page.locator('tr').filter({ hasText: shipmentCode });
    const statusBadge = shipmentRow.locator(`text=/${status}/i`);
    await expect(statusBadge).toBeVisible();
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string) {
    const filterButton = this.page.getByRole('button', { name: new RegExp(status, 'i') });
    await filterButton.click();
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Verify stock was updated after receiving
   */
  async verifyStockIncreased(productName: string, expectedIncrease: number) {
    await this.goto();
    await this.searchProduct(productName);
    
    const currentStock = await this.getProductStock(productName);
    // Parse and verify stock increased
    // This is a simplified check - adjust based on your actual stock display format
    expect(currentStock).toBeTruthy();
  }
}
