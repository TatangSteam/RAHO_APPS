import { Page, expect, Locator } from '@playwright/test';
import { waitForLoadingToFinish, waitForSuccessToast, waitForModal, waitForModalClose, waitForTableToLoad } from '../helpers/waiters';

export interface MemberData {
  name: string;
  email: string;
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
    this.searchInput = page.getByPlaceholder(/cari|search/i);
    this.memberTable = page.locator('table').first();
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
    await this.page.locator('[name="memberEmail"]').fill(data.email);
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
    await this.submitForm();

    await this.page.waitForURL(/\/members\/[^/]+$/, { timeout: 30000 });
    this.createdMemberUrls.set(data.name, this.page.url());
    await this.goto();
  }

  /**
   * Search for member
   */
  async searchMember(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
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
    const row = this.getMemberRow(memberName);
    await row.click();
    await this.page.waitForURL(/\/members\/[^/]+$/);
    await waitForLoadingToFinish(this.page);
    await this.page.getByRole('button', { name: /edit|ubah|sunting/i }).first().click();
    await waitForModal(this.page);
  }

  /**
   * Click view button for a member
   */
  async viewMember(memberName: string) {
    const createdMemberUrl = this.createdMemberUrls.get(memberName);
    if (createdMemberUrl) {
      await this.page.goto(createdMemberUrl);
      await waitForLoadingToFinish(this.page);
      return;
    }

    const row = this.getMemberRow(memberName);
    await row.click();
    await this.page.waitForURL(/\/members\/[^/]+$/);
    await waitForLoadingToFinish(this.page);
  }

  /**
   * Delete member
   */
  async deleteMember(memberName: string) {
    const row = this.getMemberRow(memberName);
    
    // Click delete button
    await row.getByRole('button', { name: /delete|hapus/i }).click();
    
    // Confirm deletion in dialog
    await waitForModal(this.page);
    const confirmButton = this.page.getByRole('button', { name: /ya|yes|konfirmasi|confirm/i });
    await confirmButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page, /berhasil dihapus|deleted successfully/i);
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
    const rows = await this.memberTable.locator('tbody tr').count();
    return rows;
  }

  /**
   * Assign package to member
   */
  async assignPackage(memberName: string, packageName: string) {
    await this.viewMember(memberName);

    await this.page.getByRole('button', { name: /paket/i }).first().click();
    await waitForLoadingToFinish(this.page);
    
    // Click assign package button
    const assignButton = this.page.getByRole('button', { name: /assign|tambah.*paket/i });
    await assignButton.click();
    
    // Wait for modal
    await waitForModal(this.page);
    
    const packageOption = this.page.locator('label').filter({ hasText: new RegExp(packageName, 'i') }).first();
    if (await packageOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await packageOption.click();
    } else {
      await this.page.locator('input[type="checkbox"]').first().check();
    }
    
    // Submit
    const submitButton = this.page.getByRole('button', { name: 'Assign Paket', exact: true });
    await submitButton.click();
    
    // Wait for success
    await waitForSuccessToast(this.page);
    await waitForModalClose(this.page);
  }

  /**
   * Verify package is assigned
   */
  async expectPackageAssigned(packageName: string) {
    await this.page.getByRole('button', { name: /paket/i }).first().click();
    await waitForLoadingToFinish(this.page);

    const packageCard = this.page
      .locator('[data-testid="package-card"], .package-item, .member-package-card, .card')
      .filter({ hasText: /paket|invoice|menunggu|aktif|lunas|termin/i })
      .first();
    await expect(packageCard.or(this.page.getByText(/paket berhasil|paket member/i).first())).toBeVisible();
  }
}
