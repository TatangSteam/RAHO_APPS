import axios, { AxiosRequestConfig, Method } from 'axios';
import { ZohoConnection } from '@prisma/client';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { decryptToken, encryptToken } from './zoho.crypto';
import { normalizeZohoError, ZohoApiError } from './zoho.error';

export const ZOHO_SCOPE_VERSION = 7;
export const ZOHO_REQUIRED_SCOPES = [
  'ZohoBooks.settings.READ',
  'ZohoBooks.settings.CREATE',
  'ZohoBooks.settings.UPDATE',
  'ZohoBooks.banking.READ',
  'ZohoBooks.accountants.READ',
  'ZohoBooks.accountants.CREATE',
  'ZohoBooks.accountants.UPDATE',
  'ZohoBooks.contacts.READ',
  'ZohoBooks.contacts.CREATE',
  'ZohoBooks.contacts.UPDATE',
  'ZohoBooks.invoices.READ',
  'ZohoBooks.invoices.CREATE',
  'ZohoBooks.invoices.UPDATE',
  'ZohoBooks.invoices.DELETE',
  'ZohoBooks.customerpayments.READ',
  'ZohoBooks.customerpayments.CREATE',
  'ZohoBooks.customerpayments.UPDATE',
] as const;

export type ZohoTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  scope?: string;
  error?: string;
};

export type ZohoOrganization = {
  organization_id: string;
  name: string;
  currency_id?: string;
  currency_code?: string;
  time_zone?: string;
};

type RequestOptions = {
  method?: Method;
  params?: Record<string, unknown>;
  data?: unknown;
  organizationScoped?: boolean;
  headers?: Record<string, string>;
};

const refreshInFlight = new Map<string, Promise<string>>();

function configuredCredentials() {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET) {
    throw new AppError(503, 'ZOHO_NOT_CONFIGURED', 'Credential OAuth Zoho belum lengkap pada server.');
  }
  return { clientId: env.ZOHO_CLIENT_ID, clientSecret: env.ZOHO_CLIENT_SECRET };
}

export function parseGrantedScopes(scopes: string): Set<string> {
  return new Set(scopes.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean));
}

export function getMissingRequiredScopes(scopes: string): string[] {
  const granted = parseGrantedScopes(scopes);
  return ZOHO_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
}

export function assertCurrentScopes(connection: Pick<ZohoConnection, 'scopes' | 'scopeVersion'>): void {
  const missing = getMissingRequiredScopes(connection.scopes);
  if (connection.scopeVersion < env.ZOHO_REQUIRED_SCOPE_VERSION || missing.length) {
    throw new AppError(
      409,
      'ZOHO_RECONNECT_REQUIRED',
      `Izin Zoho perlu diperbarui. Hubungkan ulang aplikasi. Scope yang kurang: ${missing.join(', ') || 'versi izin terbaru'}.`,
    );
  }
}

export async function exchangeAuthorizationCode(code: string): Promise<ZohoTokenResponse> {
  const credentials = configuredCredentials();
  if (!env.ZOHO_REDIRECT_URI) {
    throw new AppError(503, 'ZOHO_NOT_CONFIGURED', 'Redirect URI Zoho belum dikonfigurasi.');
  }
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    redirect_uri: env.ZOHO_REDIRECT_URI,
    code,
  });
  const response = await axios.post<ZohoTokenResponse>(
    new URL('/oauth/v2/token', env.ZOHO_ACCOUNTS_BASE_URL).toString(),
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
  );
  return response.data;
}

export async function listOrganizationsWithToken(
  apiDomain: string,
  accessToken: string,
): Promise<ZohoOrganization[]> {
  try {
    const response = await axios.get<{ organizations: ZohoOrganization[] }>(
      new URL('/books/v3/organizations', apiDomain).toString(),
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }, timeout: 20_000 },
    );
    return response.data.organizations || [];
  } catch (error) {
    throw normalizeZohoError(error);
  }
}

export async function refreshZohoAccessToken(connection: ZohoConnection): Promise<string> {
  const existing = refreshInFlight.get(connection.id);
  if (existing) return existing;

  const promise = (async () => {
    const credentials = configuredCredentials();
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: decryptToken(connection.encryptedRefreshToken),
      });
      const response = await axios.post<ZohoTokenResponse>(
        new URL('/oauth/v2/token', env.ZOHO_ACCOUNTS_BASE_URL).toString(),
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
      );
      if (!response.data.access_token) {
        throw new ZohoApiError(
          response.data.error || 'Access token refresh failed',
          'ZOHO_REFRESH_FAILED',
          401,
          false,
        );
      }
      await prisma.zohoConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: encryptToken(response.data.access_token),
          accessTokenExpiresAt: new Date(Date.now() + (response.data.expires_in || 3_600) * 1_000),
          lastError: null,
        },
      });
      return response.data.access_token;
    } catch (error) {
      const normalized = normalizeZohoError(error);
      await prisma.zohoConnection.update({
        where: { id: connection.id },
        data: { lastCheckedAt: new Date(), lastError: `${normalized.code}: ${normalized.message}`.slice(0, 500) },
      });
      throw normalized;
    }
  })().finally(() => refreshInFlight.delete(connection.id));

  refreshInFlight.set(connection.id, promise);
  return promise;
}

export class ZohoClient {
  constructor(public readonly connection: ZohoConnection) {}

  private async token(forceRefresh = false): Promise<string> {
    if (forceRefresh || this.connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000) {
      return refreshZohoAccessToken(this.connection);
    }
    return decryptToken(this.connection.encryptedAccessToken);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const refreshedBeforeRequest = this.connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
    const execute = async (forceRefresh: boolean) => {
      const token = await this.token(forceRefresh);
      const params = { ...(options.params || {}) };
      if (options.organizationScoped !== false) params.organization_id = this.connection.organizationId;
      const config: AxiosRequestConfig = {
        method: options.method || 'GET',
        url: new URL(path, this.connection.apiDomain).toString(),
        headers: { Authorization: `Zoho-oauthtoken ${token}`, ...(options.headers || {}) },
        params,
        data: options.data,
        timeout: 20_000,
      };
      return axios.request<T>(config);
    };

    try {
      return (await execute(false)).data;
    } catch (firstError) {
      const normalized = normalizeZohoError(firstError);
      if (normalized.httpStatus !== 401 || refreshedBeforeRequest) throw normalized;
      try {
        return (await execute(true)).data;
      } catch (retryError) {
        const finalError = normalizeZohoError(retryError);
        await prisma.zohoConnection.update({
          where: { id: this.connection.id },
          data: { lastCheckedAt: new Date(), lastError: `${finalError.code}: ${finalError.message}`.slice(0, 500) },
        });
        throw finalError;
      }
    }
  }

  async listAll<T>(
    path: string,
    collectionKey: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    while (true) {
      const response = await this.request<Record<string, unknown>>(path, {
        params: { ...params, page, per_page: 200 },
      });
      const items = response[collectionKey];
      if (Array.isArray(items)) results.push(...(items as T[]));
      const pageContext = response.page_context as { has_more_page?: boolean } | undefined;
      if (!pageContext?.has_more_page) break;
      page += 1;
    }
    return results;
  }
}

export async function getActiveZohoClient(requireCurrentScopes = true): Promise<ZohoClient> {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  if (requireCurrentScopes) assertCurrentScopes(connection);
  return new ZohoClient(connection);
}
