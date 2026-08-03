import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures/base';
import { requireTestUser } from '../fixtures/test-users';
import { apiBaseURL, loginRequest } from '../helpers/auth';
import { E2E_API_HEADERS } from '../helpers/selectors';
import { MemberPage, type MemberData } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';

interface AccountingPeriodFixture {
  branchId: string | null;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
}

async function ensureCurrentGlobalAccountingPeriod(request: APIRequestContext): Promise<void> {
  const now = new Date();
  const fiscalYear = now.getFullYear();
  const periodNo = now.getMonth() + 1;
  const month = String(periodNo).padStart(2, '0');
  const lastDay = new Date(fiscalYear, periodNo, 0).getDate();
  const startDate = `${fiscalYear}-${month}-01`;
  const endDate = `${fiscalYear}-${month}-${String(lastDay).padStart(2, '0')}`;
  const currentTimestamp = now.getTime();
  const session = await loginRequest(request, requireTestUser('SUPER_ADMIN'));
  const headers = {
    ...E2E_API_HEADERS,
    Authorization: `Bearer ${session.accessToken}`,
  };

  const listResponse = await request.get(`${apiBaseURL()}/accounting/periods`, {
    headers,
    params: { fiscalYear },
  });
  expect(
    listResponse.ok(),
    `Gagal membaca periode akuntansi: ${listResponse.status()} ${await listResponse.text()}`,
  ).toBeTruthy();

  const listBody = await listResponse.json();
  const periods = (listBody.data || []) as AccountingPeriodFixture[];
  const currentPeriod = periods.find((period) =>
    period.branchId === null
      && new Date(period.startDate).getTime() <= currentTimestamp
      && new Date(period.endDate).getTime() >= currentTimestamp,
  );

  if (currentPeriod) {
    expect(currentPeriod.status, 'Periode akuntansi global saat ini harus OPEN.').toBe('OPEN');
    return;
  }

  const createResponse = await request.post(`${apiBaseURL()}/accounting/periods`, {
    headers,
    data: {
      name: `E2E ${fiscalYear}-${month}`,
      fiscalYear,
      periodNo,
      startDate,
      endDate,
      branchId: null,
    },
  });
  expect(
    createResponse.ok(),
    `Gagal menyiapkan periode akuntansi: ${createResponse.status()} ${await createResponse.text()}`,
  ).toBeTruthy();
}

function uniqueMember(): MemberData {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `E2E Local Core ${suffix}`,
    username: `core${suffix}`,
    phone: `081${suffix.slice(-9).padStart(9, '0')}`,
    address: 'Jl. Test Local Core',
    birthDate: '1990-01-01',
    gender: 'MALE',
  };
}

test.describe('Local core flow without Zoho worker', () => {
  test('package purchase creates an invoice, accepts cash, and posts after manager verification', async ({ page, request, loginAs }) => {
    await ensureCurrentGlobalAccountingPeriod(request);
    await loginAs('ADMIN_CABANG');
    const memberPage = new MemberPage(page);
    const member = uniqueMember();

    await memberPage.goto();
    await memberPage.createMember(member);
    await memberPage.assignPackage(member.name, 'Basic Package');
    await memberPage.expectPackageAssigned();

    const paymentPage = new PaymentPage(page);
    await paymentPage.goto();
    await paymentPage.searchInvoice(member.name);
    await paymentPage.expectInvoiceExists(member.name);

    const invoiceRow = page.locator('tbody tr').filter({ hasText: member.name });
    await expect(invoiceRow).toHaveCount(1);
    await invoiceRow.getByRole('button', { name: 'Bayar', exact: true }).click();

    const paymentDialog = page.getByRole('dialog', { name: 'Proses Pembayaran' });
    await expect(paymentDialog).toBeVisible();
    await expect(paymentDialog.getByLabel('Metode Pembayaran')).toContainText('Cash');
    const cashAccount = paymentDialog.getByLabel('Akun Kas/Bank');
    if (await cashAccount.inputValue() === '') {
      const accountOptions = cashAccount.locator('option');
      expect(await accountOptions.count(), 'Minimal satu akun kas wajib tersedia untuk pembayaran tunai.').toBeGreaterThan(1);
      await cashAccount.selectOption({ index: 1 });
    }
    await expect(cashAccount).not.toHaveValue('');
    await expect(paymentDialog.getByLabel('Jumlah Pembayaran')).not.toHaveValue('');

    const paymentResponse = page.waitForResponse(
      (response) => /\/api\/v1\/invoices\/[^/]+\/payment$/.test(response.url())
        && response.request().method() === 'POST',
    );
    await paymentDialog.getByRole('button', { name: 'Proses Pembayaran', exact: true }).click();
    const response = await paymentResponse;
    expect(response.ok(), `Pembayaran gagal: ${response.status()} ${await response.text()}`).toBeTruthy();
    await expect(page.getByText('Pembayaran diajukan dan menunggu verifikasi')).toBeVisible();

    await loginAs('ADMIN_MANAGER');
    await paymentPage.goto();
    await paymentPage.searchInvoice(member.name);

    const managerInvoiceRow = page.locator('tbody tr').filter({ hasText: member.name });
    await expect(managerInvoiceRow).toHaveCount(1);
    await managerInvoiceRow.getByRole('button', { name: /Verifikasi Rp/ }).click();

    const verificationDialog = page.getByRole('dialog', { name: 'Verifikasi Pembayaran' });
    await expect(verificationDialog).toBeVisible();
    const verificationResponse = page.waitForResponse(
      (verificationResult) => /\/api\/v1\/invoices\/payments\/[^/]+\/verify$/.test(verificationResult.url())
        && verificationResult.request().method() === 'POST',
    );
    await verificationDialog.getByRole('button', { name: 'Verifikasi & Posting' }).click();
    const verified = await verificationResponse;
    expect(verified.ok(), `Verifikasi gagal: ${verified.status()} ${await verified.text()}`).toBeTruthy();
    await expect(page.getByText('Pembayaran diverifikasi; evidence posting tersedia di layar')).toBeVisible();

    await paymentPage.searchInvoice(member.name);
    await expect(page.locator('tbody tr').filter({ hasText: member.name })).toContainText('Lunas');
  });
});
