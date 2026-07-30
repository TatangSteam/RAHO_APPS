import { test, expect } from '../fixtures/base';

const memberId = 'legacy-member-ui';
const branchId = 'branch-legacy';

const legacyMember = {
  memberId,
  memberNo: 'MBR-LEGACY-001',
  user: {
    email: 'legacy@example.com',
    username: 'legacy.member',
    isActive: true,
  },
  profile: {
    fullName: 'Member Data Lama',
    phone: '081234567890',
    avatarUrl: null,
  },
  registrationBranch: {
    id: branchId,
    name: 'RAHO Premier Jakarta',
    branchCode: 'PST',
  },
  branchAccess: [],
  documents: [],
  nik: '3201010101900001',
  dateOfBirth: '1990-01-01T00:00:00.000Z',
  age: 36,
  jenisKelamin: 'P',
  address: 'Jakarta',
  voucherCount: 1,
  isConsentToPhoto: true,
  isActive: true,
  isDeceased: false,
  createdAt: '2025-01-01T00:00:00.000Z',
};

const legacyPackages = [
  {
    isGroup: true,
    purchaseGroupId: 'legacy-purchase-group',
    basics: [
      {
        id: 'legacy-package-id',
        packageId: 'legacy-package-id',
        packageCode: 'PKG-LEGACY-001',
        packagePricingId: null,
        productCode: null,
        serviceType: null,
        packageType: 'BASIC',
        totalSessions: 7,
        usedSessions: 0,
        remainingSessions: 7,
        finalPrice: 12500000,
        discountPercent: 0,
        discountAmount: 0,
        status: 'PENDING_PAYMENT',
        paymentPlanType: 'FULL_PAYMENT',
        totalVerifiedPaid: 0,
        branchId,
        branchName: 'RAHO Premier Jakarta',
        assignedBy: 'Admin Layanan',
        createdAt: '2025-01-01T00:00:00.000Z',
        purchaseGroupId: 'legacy-purchase-group',
      },
    ],
    boosters: [],
    addOns: [],
    totalPrice: 12500000,
    status: 'PENDING_PAYMENT',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

const pricings = [
  {
    id: 'pricing-basic-7',
    branchId,
    packageType: 'BASIC',
    boosterType: null,
    serviceType: 'PS',
    productCode: 'TNB-P7-PS',
    name: 'Terapi Nano Bubble 7X',
    totalSessions: 7,
    price: 12500000,
    isActive: true,
  },
  {
    id: 'pricing-basic-15',
    branchId,
    packageType: 'BASIC',
    boosterType: null,
    serviceType: 'PS',
    productCode: 'TNB-P15-PS',
    name: 'Terapi Nano Bubble 15X',
    totalSessions: 15,
    price: 22500000,
    isActive: true,
  },
];

test('admin layanan can edit legacy package once without duplicate submission', async ({ loginAs }) => {
  const page = await loginAs('ADMIN_LAYANAN');
  let editRequestCount = 0;
  let submittedPayload: any;

  await page.route(
    new RegExp(`/api/v1/members/${memberId}/packages(?:\\?.*)?$`),
    route => route.fulfill({ json: { success: true, data: legacyPackages } }),
  );
  await page.route(
    new RegExp(`/api/v1/members/${memberId}(?:\\?.*)?$`),
    route => route.fulfill({ json: { success: true, data: legacyMember } }),
  );
  await page.route(
    /\/api\/v1\/package-pricings(?:\?.*)?$/,
    route => route.fulfill({ json: { success: true, data: { pricings } } }),
  );
  await page.route(
    /\/api\/v1\/packages\/legacy-purchase-group$/,
    async route => {
      editRequestCount += 1;
      submittedPayload = route.request().postDataJSON();
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.fulfill({
        json: {
          success: true,
          data: {
            packages: [{ ...legacyPackages[0].basics[0], packagePricingId: 'pricing-basic-15' }],
            invoice: null,
          },
        },
      });
    },
  );

  await page.goto(`/members/${memberId}`);
  await page.getByRole('tab', { name: 'Paket', exact: true }).click();
  await expect(page.getByText('Paket Bundling').first()).toBeVisible();
  await page.getByText('Paket Bundling').first().click();
  await page.getByRole('button', { name: /Edit/ }).first().click();

  await expect(page.getByText('Edit Pembelian Paket')).toBeVisible();
  const sevenSessionOption = page.locator('label').filter({ hasText: 'Terapi Nano Bubble 7X' });
  const fifteenSessionOption = page.locator('label').filter({ hasText: 'Terapi Nano Bubble 15X' });
  await expect(sevenSessionOption.locator('input[type="checkbox"]')).toBeChecked();

  await sevenSessionOption.click();
  await fifteenSessionOption.click();

  const saveButton = page.getByRole('button', { name: /Simpan Perubahan/ });
  await expect(saveButton).toBeEnabled();
  await saveButton.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });

  await expect(page.getByText('Paket berhasil diupdate')).toBeVisible();
  await expect(page.getByText('Edit Pembelian Paket')).not.toBeVisible();
  expect(editRequestCount).toBe(1);
  expect(submittedPayload.packages).toEqual([
    expect.objectContaining({
      pricingId: 'pricing-basic-15',
      quantity: 1,
    }),
  ]);
});
