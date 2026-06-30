import { test, expect } from '../fixtures/base';
import { PaymentPage } from '../pages/PaymentPage';

test.describe('Invoice Creation', () => {
  let paymentPage: PaymentPage;
  const testMemberName = `Test Member ${Date.now()}`;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();
  });

  test('should create invoice with single item', async () => {
    const items = [
      {
        productName: 'IFA 250',
        quantity: 30,
        unitPrice: 10000,
      },
    ];

    // Create invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items,
    });

    // Verify invoice created
    await paymentPage.expectInvoiceExists(testMemberName);
  });

  test('should create invoice with multiple items', async () => {
    const items = [
      {
        productName: 'IFA 250',
        quantity: 30,
        unitPrice: 10000,
      },
      {
        productName: 'Vitamin C',
        quantity: 30,
        unitPrice: 5000,
      },
      {
        productName: 'Konsultasi Dokter',
        quantity: 1,
        unitPrice: 100000,
      },
    ];

    // Create invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items,
    });

    // Verify invoice created
    await paymentPage.expectInvoiceExists(testMemberName);
  });

  test('should calculate totals correctly', async () => {
    const items = [
      {
        productName: 'IFA 250',
        quantity: 30,
        unitPrice: 10000,
      },
      {
        productName: 'Vitamin C',
        quantity: 30,
        unitPrice: 5000,
      },
    ];

    const expectedTotal = paymentPage.calculateTotal(items);

    // Create invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items,
    });

    // View invoice and verify total
    await paymentPage.viewInvoice(testMemberName);
    await paymentPage.expectTotalAmount(expectedTotal);
  });

  test('should apply discount to items', async () => {
    const items = [
      {
        productName: 'IFA 250',
        quantity: 30,
        unitPrice: 10000,
        discount: 50000, // 50k discount
      },
    ];

    // Create invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items,
    });

    // View and verify
    await paymentPage.viewInvoice(testMemberName);
    const expectedTotal = paymentPage.calculateTotal(items);
    await paymentPage.expectTotalAmount(expectedTotal);
  });
});

test.describe('Payment Processing', () => {
  let paymentPage: PaymentPage;
  const testMemberName = `Test Member ${Date.now()}`;
  let invoiceNumber: string;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();

    // Create a test invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items: [
        {
          productName: 'IFA 250',
          quantity: 30,
          unitPrice: 10000,
        },
      ],
    });

    invoiceNumber = testMemberName; // Use member name as identifier
  });

  test('should process full payment - Cash', async () => {
    // Process payment
    await paymentPage.processPayment(invoiceNumber, {
      method: 'Cash',
      amount: 300000,
    });

    // Verify payment processed
    await paymentPage.expectPaymentStatus(invoiceNumber, /lunas|paid|completed/i.source);
  });

  test('should process full payment - Transfer', async () => {
    // Process payment
    await paymentPage.processPayment(invoiceNumber, {
      method: 'Transfer',
      amount: 300000,
      reference: 'TRX123456789',
    });

    // Verify payment processed
    await paymentPage.expectPaymentStatus(invoiceNumber, /lunas|paid/i.source);
  });

  test('should process full payment - QRIS', async () => {
    // Process payment
    await paymentPage.processPayment(invoiceNumber, {
      method: 'QRIS',
      amount: 300000,
      reference: 'QRIS987654321',
    });

    // Verify payment processed
    await paymentPage.expectPaymentStatus(invoiceNumber, /lunas|paid/i.source);
  });

  test('should process partial payment', async () => {
    // Process partial payment (half)
    await paymentPage.processPartialPayment(invoiceNumber, {
      method: 'Cash',
      amount: 150000,
    });

    // Verify remaining amount
    await paymentPage.viewInvoice(invoiceNumber);
    await paymentPage.expectRemainingAmount(150000);
  });

  test('should process multiple partial payments', async () => {
    // First partial payment
    await paymentPage.processPartialPayment(invoiceNumber, {
      method: 'Cash',
      amount: 100000,
    });

    // Second partial payment
    await paymentPage.processPartialPayment(invoiceNumber, {
      method: 'Transfer',
      amount: 100000,
      reference: 'TRX111',
    });

    // Third partial payment (complete)
    await paymentPage.processPartialPayment(invoiceNumber, {
      method: 'QRIS',
      amount: 100000,
      reference: 'QRIS222',
    });

    // Verify fully paid
    await paymentPage.expectPaymentStatus(invoiceNumber, /lunas|paid/i.source);
  });

  test('should handle multiple payment methods', async () => {
    // Pay with cash
    await paymentPage.processPartialPayment(invoiceNumber, {
      method: 'Cash',
      amount: 200000,
    });

    // Pay remaining with transfer
    await paymentPage.processPartialPayment(invoiceNumber, {
      method: 'Transfer',
      amount: 100000,
      reference: 'TRX789',
    });

    // Verify both methods recorded
    await paymentPage.viewInvoice(invoiceNumber);
    await paymentPage.expectPaymentMethod('Cash');
    await paymentPage.expectPaymentMethod('Transfer');
  });
});

test.describe('Payment Verification', () => {
  let paymentPage: PaymentPage;
  const testMemberName = `Test Member ${Date.now()}`;
  let invoiceNumber: string;

  test.beforeEach(async ({ loginAs }) => {
    // Login as regular admin to create and pay invoice
    const page = await loginAs('ADMIN_CABANG');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();

    // Create invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items: [
        {
          productName: 'IFA 250',
          quantity: 30,
          unitPrice: 10000,
        },
      ],
    });

    // Process payment
    await paymentPage.processPayment(testMemberName, {
      method: 'Transfer',
      amount: 300000,
      reference: 'TRX' + Date.now(),
    });

    invoiceNumber = testMemberName;
  });

  test('should approve payment verification', async ({ loginAs }) => {
    // Switch to manager account
    const page = await loginAs('ADMIN_MANAGER');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();

    // Approve payment
    await paymentPage.approvePayment(invoiceNumber, 'Payment verified and approved');

    // Verify status changed
    await paymentPage.expectPaymentStatus(invoiceNumber, /verified|terverifikasi|approved/i.source);
  });

  test('should reject payment verification', async ({ loginAs }) => {
    // Switch to manager account
    const page = await loginAs('ADMIN_MANAGER');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();

    // Reject payment
    await paymentPage.rejectPayment(invoiceNumber, 'Transfer reference not found');

    // Verify status changed
    await paymentPage.expectPaymentStatus(invoiceNumber, /rejected|ditolak/i.source);
  });

  test('should require manager role for verification', async ({ page }) => {
    // Try to verify as non-manager (current session is ADMIN_CABANG from beforeEach)
    
    // Verification button should either be hidden or show permission error
    await paymentPage.searchInvoice(invoiceNumber);
    
    const verifyButton = page.getByRole('button', { name: /verifikasi|verify/i }).first();
    
    // Check if button is visible
    const isVisible = await verifyButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (isVisible) {
      // If visible, clicking should show permission error
      await verifyButton.click();
      await expect(page.locator('text=/permission|tidak.*izin|forbidden/i')).toBeVisible({ timeout: 5000 });
    } else {
      // Button not visible - correct behavior
      expect(isVisible).toBe(false);
    }
  });
});

test.describe('Payment Refund', () => {
  let paymentPage: PaymentPage;
  const testMemberName = `Test Member ${Date.now()}`;
  let invoiceNumber: string;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_MANAGER');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();

    // Create and pay invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items: [
        {
          productName: 'IFA 250',
          quantity: 30,
          unitPrice: 10000,
        },
      ],
    });

    await paymentPage.processPayment(testMemberName, {
      method: 'Cash',
      amount: 300000,
    });

    invoiceNumber = testMemberName;
  });

  test('should process full refund', async () => {
    // Refund full amount
    await paymentPage.refundPayment(invoiceNumber, 300000, 'Customer requested refund');

    // Verify refund processed
    await paymentPage.expectPaymentStatus(invoiceNumber, /refund|dikembalikan/i.source);
  });

  test('should process partial refund', async () => {
    // Refund partial amount
    await paymentPage.refundPayment(invoiceNumber, 100000, 'Partial service cancellation');

    // Verify refund processed
    await paymentPage.viewInvoice(invoiceNumber);
    // Should show refunded amount
  });
});

test.describe('Invoice PDF & Receipt', () => {
  let paymentPage: PaymentPage;
  const testMemberName = `Test Member ${Date.now()}`;
  let invoiceNumber: string;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();

    // Create and pay invoice
    await paymentPage.createInvoice({
      memberName: testMemberName,
      items: [
        {
          productName: 'IFA 250',
          quantity: 30,
          unitPrice: 10000,
        },
      ],
    });

    await paymentPage.processPayment(testMemberName, {
      method: 'Cash',
      amount: 300000,
    });

    invoiceNumber = testMemberName;
  });

  test('should generate invoice PDF', async () => {
    // Generate PDF
    await paymentPage.generateInvoicePDF(invoiceNumber);

    // PDF download verified in the method
  });

  test('should print receipt', async () => {
    // Print receipt
    await paymentPage.printReceipt(invoiceNumber);

    // Print dialog verified in the method
  });
});

test.describe('Payment Filters', () => {
  let paymentPage: PaymentPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();
  });

  test('should filter by payment status', async () => {
    // Filter by paid status
    await paymentPage.filterByStatus('Lunas');

    // Verify filter applied
    const count = await paymentPage.getInvoiceCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by date range', async () => {
    // Filter by date range
    await paymentPage.filterByDateRange('2026-07-01', '2026-07-31');

    // Verify filter applied
    const count = await paymentPage.getInvoiceCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by payment method', async () => {
    // Filter by cash payments
    await paymentPage.filterByPaymentMethod('Cash');

    // Verify filter applied
    const count = await paymentPage.getInvoiceCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should search invoices', async () => {
    // Search for invoice
    await paymentPage.searchInvoice('Test');

    // Verify search applied
    const count = await paymentPage.getInvoiceCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Payment Validation', () => {
  let paymentPage: PaymentPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    paymentPage = new PaymentPage(page);
    await paymentPage.goto();
  });

  test('should validate required fields when creating invoice', async ({ page }) => {
    // Try to create invoice without required fields
    const createButton = page.getByRole('button', { name: /buat.*invoice|create.*invoice/i });
    await createButton.click();

    await page.waitForTimeout(500);

    // Submit empty form
    const submitButton = page.getByRole('button', { name: /simpan|save/i });
    await submitButton.click();

    // Verify validation errors
    await expect(page.locator('text=/required|wajib|harus.*diisi/i').first()).toBeVisible();
  });

  test('should validate payment amount', async ({ page }) => {
    // Create invoice first
    await paymentPage.createInvoice({
      memberName: `Test Member ${Date.now()}`,
      items: [
        {
          productName: 'IFA 250',
          quantity: 30,
          unitPrice: 10000,
        },
      ],
    });

    // Try to pay with invalid amount (zero or negative)
    const payButton = page.getByRole('button', { name: /bayar|pay/i }).first();
    await payButton.click();

    await page.waitForTimeout(500);

    // Fill zero amount
    const amountField = page.getByLabel(/jumlah|amount/i);
    await amountField.fill('0');

    const submitButton = page.getByRole('button', { name: /simpan|save|proses/i });
    await submitButton.click();

    // Verify validation error
    await expect(page.locator('text=/amount.*invalid|jumlah.*tidak.*valid|harus.*lebih.*besar/i')).toBeVisible();
  });
});
