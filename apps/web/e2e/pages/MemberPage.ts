import { Page, expect, Locator } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForModal, waitForModalClose, waitForTableToLoad } from '../helpers/waiters';
import { CONFIRM_BUTTON_NAME, SELECTORS, activeModal, searchInput, tableLocator, waitForDebounce } from '../helpers/selectors';

const memberDetailUrlPattern = /\/members\/(?!new(?:$|[?#]))[^/?#]+$/;

async function waitForMemberDetailName(page: Page, memberName: string, timeout = 10000): Promise<boolean> {
  await waitForLoadingToFinish(page);
  return page
    .getByText(memberName)
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

export interface MemberData {
  name: string;
  username: string;
  phone: string;
  nik?: string;
  address?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: 'L' | 'P' | 'MALE' | 'FEMALE';
  password?: string;
}

export class MemberPage {
  readonly page: Page;
  readonly addMemberButton: Locator;
  readonly searchInput: Locator;
  readonly memberTable: Locator;
  private createdMemberUrls = new Map<string, string>();

  constructor(page: Page) {
    this.page = page;
    this.addMemberButton = page.getByRole('button', { name: /daftarkan.*member|tambah.*member|add.*member/i });
    this.searchInput = searchInput(page);
    this.memberTable = tableLocator(page);
  }

  /**
   * Navigate to members page
   */
  async goto() {
    await this.page.goto('/members');
    await waitForTableToLoad(this.page);
  }

  /**
   * Click add member button
   */
  async clickAddMember() {
    await this.addMemberButton.click();
    await this.page.waitForURL(/\/members\/new/);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Fill member form
   */
  async fillMemberForm(data: MemberData) {
    const nik = data.nik || `32${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 16).padEnd(16, '0');
    const gender = data.gender === 'MALE' ? 'L' : data.gender === 'FEMALE' ? 'P' : data.gender || 'L';

    await this.page.locator('[name="fullName"]').fill(data.name);
    await this.page.locator('[name="nik"]').fill(nik);
    await this.page.locator('[name="phone"]').fill(data.phone);
    await this.page.locator('[name="birthPlace"]').fill(data.birthPlace || 'Jakarta');
    await this.page.locator('[name="birthDate"]').fill(data.birthDate || '1990-01-01');
    await this.page.locator('[name="gender"]').selectOption(gender);
    await this.page.locator('[name="address"]').fill(data.address || 'Jl. Test No. 123');
    await this.page.locator('[name="memberUsername"]').fill(data.username);
    await this.page.locator('[name="memberPassword"]').fill(data.password || 'Member123!');
  }

  /**
   * Submit member form
   */
  async submitForm() {
    const submitButton = this.page.getByRole('button', { name: /daftarkan.*member|simpan|save|submit/i });
    await submitButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Create new member
   */
  async createMember(data: MemberData) {
    await this.clickAddMember();
    await this.fillMemberForm(data);

    const createResponsePromise = this.page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/v1/members') &&
          response.request().method() === 'POST',
        { timeout: 30000 },
      )
      .catch(() => undefined);
    const detailNavigationPromise = this.page
      .waitForURL(memberDetailUrlPattern, { timeout: 30000 })
      .catch(() => undefined);

    await this.submitForm();

    const createResponse = await createResponsePromise;
    if (!createResponse) {
      throw new Error('Create member API response was not observed.');
    }

    if (!createResponse.ok()) {
      throw new Error(`Create member API failed: ${createResponse.status()} ${await createResponse.text()}`);
    }

    const responseBody = await createResponse.json().catch(() => undefined);
    const memberId =
      responseBody?.data?.memberId ||
      responseBody?.data?.data?.memberId ||
      responseBody?.data?.member?.id ||
      responseBody?.data?.data?.member?.id ||
      responseBody?.memberId ||
      responseBody?.member?.id;
    if (memberId) {
      this.createdMemberUrls.set(data.name, `/members/${memberId}`);
    } else {
      await detailNavigationPromise;
      if (memberDetailUrlPattern.test(this.page.url())) {
        this.createdMemberUrls.set(data.name, new URL(this.page.url()).pathname);
      }
    }

    await this.goto();
  }

  /**
   * Search for member
   */
  async searchMember(query: string) {
    await this.searchInput.fill(query);
    await waitForDebounce(this.page);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Get member row by name
   */
  getMemberRow(name: string) {
    return this.memberTable.locator('tr').filter({ hasText: name });
  }

  /**
   * Click edit button for a member
   */
  async editMember(memberName: string) {
    await this.goto();
    await this.searchMember(memberName);
    const row = this.getMemberRow(memberName).first();
    await expect(row).toBeVisible();
    await row.click();
    await this.page.waitForURL(memberDetailUrlPattern);
    await waitForLoadingToFinish(this.page);
    await this.page.getByRole('button', { name: /edit|ubah|sunting/i }).first().click();
    await waitForModal(this.page);
  }

  /**
   * Click view button for a member
   */
  async viewMember(memberName: string) {
    if (memberDetailUrlPattern.test(this.page.url()) && (await waitForMemberDetailName(this.page, memberName, 2000))) {
      return;
    }

    const createdMemberUrl = this.createdMemberUrls.get(memberName);
    if (createdMemberUrl) {
      await this.page.goto(createdMemberUrl);
      if (memberDetailUrlPattern.test(this.page.url()) && (await waitForMemberDetailName(this.page, memberName))) {
        return;
      }
    }

    await this.goto();
    await this.searchMember(memberName);

    const row = this.getMemberRow(memberName).first();
    await expect(row).toBeVisible();
    await row.click();
    await this.page.waitForURL(memberDetailUrlPattern);
    this.createdMemberUrls.set(memberName, this.page.url());
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Delete member
   */
  async deleteMember(memberName: string) {
    await this.viewMember(memberName);
    await this.page.getByRole('button', { name: /hapus.*member/i }).click();
    
    // Confirm deletion in dialog
    await waitForModal(this.page);
    const dialog = activeModal(this.page);
    const confirmButton = dialog.getByRole('button', { name: CONFIRM_BUTTON_NAME });
    await confirmButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page, /berhasil dihapus|deleted successfully/i);
    await this.page.waitForURL(/\/members(?:$|[?#])/, { timeout: 10000 }).catch(() => undefined);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Verify member exists in table
   */
  async expectMemberExists(memberName: string) {
    const row = this.getMemberRow(memberName);
    await expect(row).toBeVisible();
  }

  /**
   * Verify member does not exist in table
   */
  async expectMemberNotExists(memberName: string) {
    const row = this.getMemberRow(memberName);
    await expect(row).not.toBeVisible();
  }

  /**
   * Get member count
   */
  async getMemberCount(): Promise<number> {
    const rows = await this.memberTable.locator(SELECTORS.tableRow).count();
    return rows;
  }

  private async openAssignmentDialog(memberName: string): Promise<Locator> {
    await this.viewMember(memberName);
    await this.page.getByRole('tab', { name: 'Paket', exact: true }).click();
    await waitForLoadingToFinish(this.page);
    await this.page.getByRole('button', { name: /assign|tambah.*paket/i }).click();
    await waitForModal(this.page);

    return this.page.getByRole('dialog').last();
  }

  /**
   * Assign package to member
   */
  async assignPackage(memberName: string, packageName: string) {
    const dialog = await this.openAssignmentDialog(memberName);
    const packageOption = dialog
      .locator('label')
      .filter({ hasText: new RegExp(packageName, 'i') })
      .first();

    if (await packageOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await packageOption.click();
    } else {
      await dialog.locator('input[type="checkbox"]').first().check();
    }

    await dialog.getByRole('button', { name: /^Assign \d+ Item$/ }).click();
    await waitForSuccessToast(this.page);
    await waitForModalClose(this.page);
  }

  /**
   * Purchase a standalone add-on without requiring a therapy package.
   */
  async assignAddOn(memberName: string, addOnName: string, discountPercent = 0) {
    const dialog = await this.openAssignmentDialog(memberName);
    await dialog
      .locator('label')
      .filter({ hasText: new RegExp(addOnName, 'i') })
      .first()
      .click();

    if (discountPercent > 0) {
      await dialog.getByRole('textbox', { name: 'Diskon (%)', exact: true })
        .fill(String(discountPercent));
    }

    const purchaseResponse = this.page.waitForResponse(
      (response) => /\/api\/v1\/members\/[^/]+\/packages$/.test(response.url())
        && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /^Assign 1 Item$/ }).click();

    const response = await purchaseResponse;
    const requestPayload = response.request().postDataJSON();
    expect(
      response.ok(),
      `Pembelian add-on gagal: ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
    expect(requestPayload.addOns).toEqual([
      expect.objectContaining({ name: addOnName, quantity: 1 }),
    ]);
    if (discountPercent > 0) {
      expect(requestPayload.discountPercent).toBe(discountPercent);
    }

    await waitForSuccessToast(this.page);
    await waitForModalClose(this.page);
  }

  /**
   * Verify package is assigned
   */
  async expectPackageAssigned() {
    await this.page.getByRole('tab', { name: 'Paket', exact: true }).click();
    await waitForLoadingToFinish(this.page);

    const packageSection = this.page.locator('.member-detail-tab-content');
    await expect(packageSection).toContainText(/Paket Member/i);
    await expect(packageSection).toContainText(/PKG-|Pending Payment|sesi/i);
  }
}
