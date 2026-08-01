import { test, expect } from '../fixtures/base';
import { MemberPage } from '../pages/MemberPage';

test.describe('Diagnosis doctor directory', () => {
  test('doctor can load branch doctor options in the diagnosis modal', async ({ loginAs }) => {
    const page = await loginAs('DOCTOR');
    const memberPage = new MemberPage(page);

    await memberPage.goto();
    await memberPage.searchMember('Budi Santoso');

    const memberRow = memberPage.getMemberRow('Budi Santoso').first();
    await expect(memberRow).toBeVisible();
    await memberRow.click();
    await expect(page).toHaveURL(/\/members\/[^/]+$/);

    await page.getByRole('tab', { name: 'Diagnosis', exact: true }).click();
    await expect(page.getByText('Diagnosa Member')).toBeVisible();

    const directoryResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/staff/DOCTOR') &&
        response.request().method() === 'GET',
    );

    await page.getByRole('button', { name: 'Buat Diagnosa', exact: true }).click();

    const directoryResponse = await directoryResponsePromise;
    const directoryPayload = await directoryResponse.json();
    expect(
      directoryResponse.ok(),
      `Doctor directory failed: ${directoryResponse.status()} ${JSON.stringify(directoryPayload)}`,
    ).toBeTruthy();
    expect(Array.isArray(directoryPayload.data)).toBe(true);
    expect(directoryPayload.data.length).toBeGreaterThan(0);

    const doctorSelect = page.getByLabel('Dokter Pemeriksa *', { exact: true });
    await expect(doctorSelect).toBeEnabled();
    await expect(doctorSelect.locator('option')).toHaveCount(directoryPayload.data.length + 1);
  });
});
