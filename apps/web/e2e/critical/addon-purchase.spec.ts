import { test, expect } from '../fixtures/base';
import { MemberPage, type MemberData } from '../pages/MemberPage';
import { PaymentPage } from '../pages/PaymentPage';

function uniqueMember(): MemberData {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `E2E Add-On ${suffix}`,
    username: `addon${suffix}`,
    phone: `081${suffix.slice(-9).padStart(9, '0')}`,
    address: 'Jl. Test Add-On',
    birthDate: '1990-01-01',
    gender: 'MALE',
  };
}

test.describe('Add-on purchase', () => {
  test('standalone Air Nano purchase creates the correct pending invoice', async ({ page, loginAs }) => {
    await loginAs('ADMIN_CABANG');
    const memberPage = new MemberPage(page);
    const member = uniqueMember();

    await memberPage.goto();
    await memberPage.createMember(member);
    await memberPage.assignAddOn(member.name, 'Air Nano Kuning 600ml 1 Botol', 10);

    const paymentPage = new PaymentPage(page);
    await paymentPage.goto();
    await paymentPage.searchInvoice(member.name);
    await paymentPage.expectInvoiceExists(member.name);

    const invoiceRow = page.locator('tbody tr').filter({ hasText: member.name });
    await expect(invoiceRow).toHaveCount(1);
    await expect(invoiceRow).toContainText(/Rp\s*13\.500/);
    await expect(invoiceRow).toContainText(/Menunggu Pembayaran/i);
  });
});
