import { test, expect } from '../fixtures/base';
import { MemberPage, type MemberData } from '../pages/MemberPage';

function uniqueMember(overrides: Partial<MemberData> = {}): MemberData {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    name: `Test Member ${suffix}`,
    username: `test${suffix}`,
    phone: `081${suffix.slice(-9).padStart(9, '0')}`,
    address: 'Jl. Test No. 123',
    birthDate: '1990-01-01',
    gender: 'MALE',
    ...overrides,
  };
}

test.describe('Member CRUD', () => {
  let memberPage: MemberPage;

  test.beforeEach(async ({ loginAs }) => {
    // Login as admin who can manage members
    const page = await loginAs('ADMIN_CABANG');
    memberPage = new MemberPage(page);
    await memberPage.goto();
  });

  test('should create a new member', async () => {
    const member = uniqueMember();

    // Create member
    await memberPage.createMember(member);

    // Verify member appears in list
    await memberPage.searchMember(member.name);
    await memberPage.expectMemberExists(member.name);
  });

  test('member baru dapat login menggunakan username', async ({ page }) => {
    const member = uniqueMember({ password: 'Member123!' });

    await memberPage.createMember(member);

    await page.context().clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto('/login');

    await page.getByLabel('Username atau Email').fill(member.username);
    await page.getByLabel('Password', { exact: true }).fill(member.password!);

    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/login') &&
        response.request().method() === 'POST',
    );
    await page.locator('#btn-login').click();

    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
      throw new Error(`Login member gagal: ${loginResponse.status()} ${await loginResponse.text()}`);
    }
    expect(loginResponse.request().postDataJSON()).toMatchObject({
      identifier: member.username,
      password: member.password,
    });
    await expect(page).toHaveURL(/\/me\/dashboard(?:$|[?#])/);
    await expect(page.getByText(/Portal Member RAHO Premier Club/i)).toBeVisible();
  });

  test('should search for a member', async () => {
    const member = uniqueMember();
    await memberPage.createMember(member);

    // Search for specific member
    await memberPage.searchMember(member.name);
    
    // Verify search results
    const count = await memberPage.getMemberCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should view member details', async ({ page }) => {
    const member = uniqueMember();

    // Create a test member first
    await memberPage.createMember(member);

    // Search and view
    await memberPage.searchMember(member.name);
    await memberPage.viewMember(member.name);

    // Verify we're on detail page
    await expect(page).toHaveURL(/\/members\/[^/]+$/);
    await expect(page.getByText(member.name).first()).toBeVisible();
  });

  test('should edit member information', async ({ page, loginAs }) => {
    const member = uniqueMember();

    // Create a test member first
    await memberPage.createMember(member);
    await memberPage.viewMember(member.name);
    const memberDetailPath = new URL(page.url()).pathname;

    await loginAs('SUPER_ADMIN');
    await page.goto(memberDetailPath);
    await expect(page.getByText(member.name).first()).toBeVisible();
    await page.getByRole('button', { name: /edit|ubah|sunting/i }).first().click();
    await expect(page.locator('[name="fullName"]')).toBeVisible();

    // Update name
    const updatedName = `${member.name} Updated`;
    await page.locator('[name="fullName"]').fill(updatedName);
    const updateResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/v1/members/') &&
          response.request().method() === 'PATCH',
        { timeout: 30000 },
      )
      .catch(() => undefined);

    await page.getByRole('button', { name: /simpan perubahan/i }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse, 'Update member API response was not observed.').toBeTruthy();
    expect(updateResponse!.ok(), `Update member API failed: ${updateResponse!.status()} ${await updateResponse!.text()}`).toBeTruthy();

    // Verify update
    await page.goto(memberDetailPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(updatedName).first()).toBeVisible();
  });

  test('should delete a member', async ({ page, loginAs }) => {
    const member = uniqueMember();

    // Create a test member first
    await memberPage.createMember(member);
    await memberPage.viewMember(member.name);
    const memberDetailPath = new URL(page.url()).pathname;
    await expect(page.getByRole('button', { name: /hapus.*member/i })).toHaveCount(0);

    // Delete member with authorized role
    await loginAs('SUPER_ADMIN');
    memberPage = new MemberPage(page);
    await page.goto(memberDetailPath);
    await expect(page.getByText(member.name).first()).toBeVisible();
    await memberPage.deleteMember(member.name);

    // Verify member is deleted
    await memberPage.goto();
    await memberPage.searchMember(member.name);
    await memberPage.expectMemberNotExists(member.name);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to create member without required fields
    await memberPage.clickAddMember();
    
    // Submit empty form
    const submitButton = page.getByRole('button', { name: /daftarkan.*member|simpan|save/i });
    await submitButton.click();

    const fullNameMissing = await page.locator('[name="fullName"]').evaluate((element) => {
      return (element as HTMLInputElement).validity.valueMissing;
    });
    expect(fullNameMissing).toBe(true);
  });

  test('should validate username format', async ({ page }) => {
    await memberPage.clickAddMember();

    // Fill with invalid username
    await page.locator('[name="fullName"]').fill('Test User');
    await page.locator('[name="nik"]').fill(`32${Date.now()}`.slice(0, 16).padEnd(16, '0'));
    await page.locator('[name="phone"]').fill('081234567890');
    await page.locator('[name="birthPlace"]').fill('Jakarta');
    await page.locator('[name="birthDate"]').fill('1990-01-01');
    await page.locator('[name="gender"]').selectOption('L');
    await page.locator('[name="address"]').fill('Jl. Test No. 123');
    await page.locator('[name="memberUsername"]').fill('invalid username!');
    await page.locator('[name="memberPassword"]').fill('Member123!');

    // Submit
    const submitButton = page.getByRole('button', { name: /daftarkan.*member|simpan|save/i });
    await submitButton.click();

    await expect(page.getByText(/username.*4-30|huruf.*angka|username.*valid/i).first()).toBeVisible();
    await expect(page.locator('[name="memberUsername"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('should handle duplicate username', async ({ page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const duplicateUsername = `duplicate${suffix}`;

    // Create first member
    await memberPage.createMember({
      name: `First Member ${suffix}`,
      username: duplicateUsername,
      phone: '081234567890',
      birthDate: '1991-01-01',
    });

    // Try to create second member with same username
    await memberPage.clickAddMember();
    await memberPage.fillMemberForm({
      name: `Second Member ${suffix}`,
      username: duplicateUsername,
      phone: '081234567891',
      birthDate: '1992-02-02',
    });

    const submitButton = page.getByRole('button', { name: /daftarkan.*member|simpan|save/i });
    await submitButton.click();

    // Verify error message
    await expect(
      page.locator('text=/username.*sudah.*digunakan|username.*already.*exists/i').first(),
    ).toBeVisible();
    await expect(page.locator('[name="memberUsername"]')).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('Member Package Assignment', () => {
  let memberPage: MemberPage;
  let testMember: MemberData;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    memberPage = new MemberPage(page);
    await memberPage.goto();
    testMember = uniqueMember();

    // Create a test member
    await memberPage.createMember(testMember);
  });

  test('should assign therapy package to member', async () => {
    // Assign package
    await memberPage.assignPackage(testMember.name, 'Basic Package');

    // Verify package is assigned
    await memberPage.expectPackageAssigned('Basic Package');
  });

  test('should assign multiple packages to member', async () => {
    // Assign first package
    await memberPage.assignPackage(testMember.name, 'Basic Package');
    await memberPage.expectPackageAssigned('Basic Package');

    // Assign second package
    await memberPage.assignPackage(testMember.name, 'Premium Package');
    await memberPage.expectPackageAssigned('Premium Package');

    // Verify both packages are visible
    await memberPage.expectPackageAssigned('Basic Package');
    await memberPage.expectPackageAssigned('Premium Package');
  });
});
