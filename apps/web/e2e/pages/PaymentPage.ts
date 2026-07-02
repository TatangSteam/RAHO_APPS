import { Page, expect } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForModal, waitForModalToClose, waitForTableLoad } from '../helpers/waiters';
import { goToPayments } from '../helpers/navigation';
import { EMPTY_STATE_TEXT, SELECTORS, searchInput } from '../helpers/selectors';

export interface InvoiceData {
  sessionId?: string;
  memberId?: string;
  memberName?: string;
  items?: InvoiceItem[];
  notes?: string;
}

export interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface PaymentData {
  method: string;
  amount: number;
  reference?: string;
  notes?: string;
}

export class PaymentPage {
  constructor(public page: Page) {}

  async goto() {
    await goToPayments(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Create invoice for a session
   */
  async createInvoice(data: InvoiceData) {
    // Click create invoice button
    const createButton = this.page.getByRole('button', { name: /buat.*invoice|create.*invoice|tambah.*invoice/i });
    await createButton.click();

    await waitForModal(this.page);
    await waitForLoadingToFinish(this.page);

    // Select session or member
    if (data.sessionId || data.memberName) {
      const sessionSelect = this.page.getByLabel(/sesi|session|member|pasien/i);
      await sessionSelect.click();
      await sessionSelect.fill(data.memberName || '');
      await this.page.waitForTimeout(500);
      
      const option = this.page.getByText(data.memberName || '').first();
      await option.click();
    }

    // Add items if provided
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await this.addInvoiceItem(item);
      }
    }

    // Fill notes
    if (data.notes) {
      await this.page.getByLabel(/catatan|notes/i).fill(data.notes);
    }

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Add item to invoice (during creation or editing)
   */
  async addInvoiceItem(item: InvoiceItem) {
    // Click add item button
    const addItemButton = this.page.getByRole('button', { name: /tambah.*item|add.*item/i });
    await addItemButton.click();

    await this.page.waitForTimeout(300);

    // Select product/service
    const productSelect = this.page.getByLabel(/produk|product|layanan|service/i).last();
    await productSelect.click();
    await productSelect.fill(item.productName);
    await this.page.waitForTimeout(500);
    
    const productOption = this.page.getByText(item.productName).first();
    await productOption.click();

    // Fill quantity
    const quantityField = this.page.getByLabel(/jumlah|quantity/i).last();
    await quantityField.fill(item.quantity.toString());

    // Fill unit price (if editable)
    const priceField = this.page.getByLabel(/harga|price/i).last();
    if (await priceField.isEditable({ timeout: 1000 })) {
      await priceField.fill(item.unitPrice.toString());
    }

    // Fill discount if provided
    if (item.discount) {
      const discountField = this.page.getByLabel(/diskon|discount/i).last();
      if (await discountField.isVisible({ timeout: 1000 })) {
        await discountField.fill(item.discount.toString());
      }
    }
  }

  /**
   * Search invoice by invoice number or member name
   */
  async searchInvoice(query: string) {
    await searchInput(this.page).fill(query);
    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * View invoice details
   */
  async viewInvoice(identifier: string) {
    await this.searchInvoice(identifier);

    // Click detail button or invoice number
    const detailButton = this.page.getByRole('button', { name: /detail|view|lihat/i }).first();
    await detailButton.click();

    await waitForLoadingToFinish(this.page);
  }

  /**
   * Process payment for an invoice
   */
  async processPayment(identifier: string, payment: PaymentData) {
    await this.searchInvoice(identifier);

    // Click payment button
    const payButton = this.page.getByRole('button', { name: /bayar|pay|payment/i }).first();
    await payButton.click();

    await waitForModal(this.page);

    // Select payment method
    const methodSelect = this.page.getByLabel(/metode|method|cara.*bayar/i);
    await methodSelect.click();
    
    const methodOption = this.page.getByRole('option', { name: new RegExp(payment.method, 'i') });
    await methodOption.click();

    // Fill amount
    const amountField = this.page.getByLabel(/jumlah|amount|nominal/i);
    await amountField.fill(payment.amount.toString());

    // Fill reference number if provided
    if (payment.reference) {
      const refField = this.page.getByLabel(/referensi|reference|no.*transaksi/i);
      if (await refField.isVisible({ timeout: 1000 })) {
        await refField.fill(payment.reference);
      }
    }

    // Fill notes
    if (payment.notes) {
      const notesField = this.page.getByLabel(/catatan|notes/i);
      if (await notesField.isVisible({ timeout: 1000 })) {
        await notesField.fill(payment.notes);
      }
    }

    // Submit
    await this.submitForm();
    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Process partial payment
   */
  async processPartialPayment(identifier: string, payment: PaymentData) {
    await this.processPayment(identifier, payment);
  }

  /**
   * Verify payment (for manager/admin)
   */
  async verifyPayment(identifier: string) {
    await this.searchInvoice(identifier);

    // Click verify button
    const verifyButton = this.page.getByRole('button', { name: /verifikasi|verify/i }).first();
    await verifyButton.click();

    await waitForModal(this.page);
  }

  /**
   * Approve payment verification
   */
  async approvePayment(identifier: string, notes?: string) {
    await this.searchInvoice(identifier);

    // Click approve button
    const approveButton = this.page.getByRole('button', { name: /^approve$|setuju|terima/i }).first();
    await approveButton.click();

    await waitForModal(this.page);
    const dialog = this.page.getByRole('dialog');

    // Fill notes if provided
    if (notes) {
      const notesField = dialog.getByLabel(/catatan|notes/i);
      if (await notesField.isVisible({ timeout: 1000 })) {
        await notesField.fill(notes);
      }
    }

    // Confirm approval
    const confirmButton = dialog.getByRole('button', { name: /ya.*setuju|setuju|approve/i });
    await confirmButton.click();

    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Reject payment verification
   */
  async rejectPayment(identifier: string, reason: string) {
    await this.searchInvoice(identifier);

    // Click reject button
    const rejectButton = this.page.getByRole('button', { name: /^reject$|tolak/i }).first();
    await rejectButton.click();

    await waitForModal(this.page);
    const dialog = this.page.getByRole('dialog');

    // Fill rejection reason
    const reasonField = dialog.getByLabel(/alasan|reason/i);
    await reasonField.fill(reason);

    // Confirm rejection
    const confirmButton = dialog.getByRole('button', { name: /ya.*tolak|tolak|reject/i });
    await confirmButton.click();

    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Refund payment
   */
  async refundPayment(identifier: string, amount: number, reason: string) {
    await this.searchInvoice(identifier);

    // Click refund button
    const refundButton = this.page.getByRole('button', { name: /refund|pengembalian/i }).first();
    await refundButton.click();

    await waitForModal(this.page);
    const dialog = this.page.getByRole('dialog');

    // Fill refund amount
    const amountField = dialog.getByLabel(/jumlah|amount/i);
    await amountField.fill(amount.toString());

    // Fill reason
    const reasonField = dialog.getByLabel(/alasan|reason/i);
    await reasonField.fill(reason);

    // Confirm refund
    const confirmButton = dialog.getByRole('button', { name: /confirm refund|refund/i });
    await confirmButton.click();

    await waitForSuccessToast(this.page, /berhasil|success/i);
    await waitForModalToClose(this.page);
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoicePDF(identifier: string) {
    await this.viewInvoice(identifier);

    // Click PDF/print button
    const pdfButton = this.page.getByRole('button', { name: /pdf|print|cetak/i });
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
    await pdfButton.click();
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toMatch(/invoice|faktur/i);
  }

  /**
   * Print receipt
   */
  async printReceipt(identifier: string) {
    await this.viewInvoice(identifier);

    // Click receipt button
    const receiptButton = this.page.getByRole('button', { name: /receipt|struk|bukti/i });
    
    // Handle print dialog (just verify button works)
    await receiptButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Submit current form
   */
  async submitForm() {
    const submitButton = this.page.getByRole('button', { name: /simpan|save|submit|proses/i });
    await submitButton.click();
  }

  /**
   * Expect invoice exists in list
   */
  async expectInvoiceExists(identifier: string) {
    const row = this.page.locator(SELECTORS.tableRow).filter({ hasText: identifier });
    await expect(row).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expect payment status
   */
  async expectPaymentStatus(identifier: string, status: string) {
    await this.searchInvoice(identifier);
    
    const row = this.page.locator(SELECTORS.tableRow).filter({ hasText: identifier });
    await expect(row).toContainText(new RegExp(status, 'i'));
  }

  /**
   * Expect total amount in invoice detail
   */
  async expectTotalAmount(amount: number) {
    const detailDialog = this.page.getByRole('dialog');
    const totalElement = detailDialog.getByText(new RegExp(`Total\\s+${amount}`, 'i'));
    await expect(totalElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect payment method displayed
   */
  async expectPaymentMethod(method: string) {
    const detailDialog = this.page.getByRole('dialog');
    const methodElement = detailDialog.getByText(new RegExp(method, 'i'));
    await expect(methodElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Expect remaining amount (for partial payment)
   */
  async expectRemainingAmount(amount: number) {
    const remainingElement = this.page.locator('text=/sisa|remaining/i').locator('..').getByText(amount.toString());
    await expect(remainingElement).toBeVisible({ timeout: 5000 });
  }

  /**
   * Filter invoices by status
   */
  async filterByStatus(status: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    const statusOption = this.page.getByLabel(/status/i);
    await statusOption.click();
    
    const option = this.page.getByRole('option', { name: new RegExp(status, 'i') });
    await option.click();

    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply/i });
    await applyButton.click();

    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Filter invoices by date range
   */
  async filterByDateRange(startDate: string, endDate: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    await this.page.getByLabel(/tanggal.*mulai|start.*date/i).fill(startDate);
    await this.page.getByLabel(/tanggal.*akhir|end.*date/i).fill(endDate);

    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply/i });
    await applyButton.click();

    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Filter invoices by payment method
   */
  async filterByPaymentMethod(method: string) {
    const filterButton = this.page.getByRole('button', { name: /filter|saring/i });
    await filterButton.click();

    await this.page.waitForTimeout(300);

    const methodOption = this.page.getByLabel(/metode|method/i);
    await methodOption.click();
    
    const option = this.page.getByRole('option', { name: new RegExp(method, 'i') });
    await option.click();

    // Apply filter
    const applyButton = this.page.getByRole('button', { name: /terapkan|apply/i });
    await applyButton.click();

    await waitForLoadingToFinish(this.page);
    await waitForTableLoad(this.page);
  }

  /**
   * Get invoice count
   */
  async getInvoiceCount(): Promise<number> {
    const rows = this.page.locator(SELECTORS.tableRow).filter({ hasNotText: EMPTY_STATE_TEXT });
    return await rows.count();
  }

  /**
   * Calculate expected total from items
   */
  calculateTotal(items: InvoiceItem[]): number {
    return items.reduce((total, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const discount = item.discount || 0;
      return total + (itemTotal - discount);
    }, 0);
  }
}
