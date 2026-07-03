import fs from 'node:fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import type { E2ERole, E2EUser } from '../fixtures/test-users';
import { E2E_API_HEADERS } from './selectors';

type BrowserContext = ReturnType<Page['context']>;
type StorageCookie = Parameters<BrowserContext['addCookies']>[0][number];
type OriginStorage = {
  origin: string;
  localStorage?: Array<{ name: string; value: string }>;
};

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    userId: string;
    email: string;
    role: string;
    branchId: string | null;
    branchCode: string | null;
    fullName: string;
    staffCode: string | null;
    avatarUrl?: string | null;
    branches?: string[];
  };
}

const AUTH_STORAGE_KEY = 'auth-storage';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4000/api/v1';
const DEFAULT_WEB_BASE_URL = 'http://localhost:3000';

export function apiBaseURL(): string {
  return process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
}

export function storageStatePath(role: E2ERole): string {
  return `e2e/.auth/${role.toLowerCase().replace(/_/g, '-')}.json`;
}

function encodeAuthCookie(payload: { role: string; userId: string }): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function buildAuthStorageState(result: LoginResponse) {
  const assignedBranches = result.user.branches || (result.user.branchId ? [result.user.branchId] : []);

  return {
    state: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isAuthenticated: true,
      activeBranchId: result.user.branchId,
      assignedBranches,
    },
    version: 0,
  };
}

export async function loginRequest(request: APIRequestContext, user: E2EUser): Promise<LoginResponse> {
  const response = await request.post(`${apiBaseURL()}/auth/login`, {
    headers: E2E_API_HEADERS,
    data: {
      identifier: user.email,
      password: user.password,
    },
  });

  expect(response.ok(), `API login failed for ${user.role}: ${response.status()} ${await response.text()}`).toBeTruthy();

  const body = await response.json();
  return body.data as LoginResponse;
}

export async function persistAuthToBrowser(page: Page, result: LoginResponse): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const currentUrl = page.url().startsWith('http') ? page.url() : process.env.E2E_BASE_URL || DEFAULT_WEB_BASE_URL;
  const cookieDomain = new URL(currentUrl).hostname;

  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: AUTH_STORAGE_KEY,
      value: buildAuthStorageState(result),
    },
  );

  await page.context().addCookies([
    {
      name: 'raho-auth-token',
      value: encodeAuthCookie({ role: result.user.role, userId: result.user.userId }),
      domain: cookieDomain,
      path: '/',
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
  ]);
}

export async function restoreAuthFromStorageState(page: Page, role: E2ERole, expectedPath: string): Promise<boolean> {
  const statePath = storageStatePath(role);

  if (!fs.existsSync(statePath)) {
    return false;
  }

  const rawState = fs.readFileSync(statePath, 'utf8');
  const storageState = JSON.parse(rawState) as {
    cookies?: StorageCookie[];
    origins?: OriginStorage[];
  };

  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());

  if (storageState.cookies?.length) {
    await page.context().addCookies(storageState.cookies);
  }

  const currentOrigin = new URL(page.url()).origin;
  const originState = storageState.origins?.find((origin) => origin.origin === currentOrigin) || storageState.origins?.[0];

  if (originState?.localStorage?.length) {
    await page.evaluate((entries) => {
      for (const entry of entries) {
        window.localStorage.setItem(entry.name, entry.value);
      }
    }, originState.localStorage);
  }

  await page.goto(expectedPath, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(expectedPath.replace(/\//g, '\\/')));

  return true;
}

export async function loginByApi(page: Page, request: APIRequestContext, user: E2EUser): Promise<LoginResponse> {
  const result = await loginRequest(request, user);
  await persistAuthToBrowser(page, result);
  await page.goto(user.expectedPath, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(user.expectedPath.replace(/\//g, '\\/')));
  return result;
}

export async function loginByUi(page: Page, user: E2EUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username atau Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.locator('#btn-login').click();
  await expect(page).toHaveURL(new RegExp(user.expectedPath.replace(/\//g, '\\/')), { timeout: 30_000 });
  await expect(page.locator('body')).toBeVisible();
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByRole('button', { name: /keluar|logout/i }).click();
  await expect(page).toHaveURL(/\/login/);
}
