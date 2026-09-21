import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { prisma, runWithDatabaseProfile } from '@lib/prisma';
import { getActiveZohoApiConfig, getZohoApiConfig, bindZohoOrganizationToApiProfile } from '@modules/runtime/runtime.service';
import { exchangeAuthorizationCode, listOrganizationsWithToken, getActiveZohoClient } from '../zoho.client';
import { handleCallback, testConnection } from '../zoho.service';

jest.mock('@lib/prisma', () => ({
  getCurrentDatabaseProfileId: jest.fn(() => 'db-main'),
  runWithDatabaseProfile: jest.fn((_id: string, callback: () => unknown) => callback()),
  prisma: {
    user: { findFirst: jest.fn() },
    zohoConnection: { updateMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@modules/runtime/runtime.service', () => ({
  getActiveZohoApiConfig: jest.fn(), getZohoApiConfig: jest.fn(),
  bindZohoOrganizationToApiProfile: jest.fn(),
}));
jest.mock('../zoho.crypto', () => ({ encryptToken: jest.fn((value: string) => `encrypted:${value}`) }));
jest.mock('../zoho.client', () => ({
  ...jest.requireActual('../zoho.client'),
  exchangeAuthorizationCode: jest.fn(), listOrganizationsWithToken: jest.fn(), getActiveZohoClient: jest.fn(),
}));

describe('Zoho OAuth callback persistence', () => {
  const config = { id: 'api-pinned', accountsBaseUrl: 'https://accounts.zoho.com', apiBaseUrl: 'https://www.zohoapis.com' };
  const originalKey = env.ZOHO_TOKEN_ENCRYPTION_KEY;
  const state = () => jwt.sign({ userId: 'super-admin', purpose: 'zoho-oauth', databaseProfileId: 'db-pinned', zohoApiProfileId: 'api-pinned' }, `${env.JWT_ACCESS_SECRET}:zoho-oauth`, { expiresIn: '10m', issuer: 'raho-api', audience: 'zoho-oauth' });

  beforeEach(() => {
    jest.clearAllMocks();
    env.ZOHO_TOKEN_ENCRYPTION_KEY = 'test-only';
    (getZohoApiConfig as jest.Mock).mockResolvedValue(config);
    (getActiveZohoApiConfig as jest.Mock).mockResolvedValue(config);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'super-admin' });
    (exchangeAuthorizationCode as jest.Mock).mockResolvedValue({ access_token: 'test-access', refresh_token: 'test-refresh', api_domain: 'https://www.zohoapis.eu', expires_in: 3600 });
    (listOrganizationsWithToken as jest.Mock).mockResolvedValue([{ organization_id: 'org-1', name: 'Test Organization' }]);
    (prisma.$transaction as jest.Mock).mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  });
  afterAll(() => { env.ZOHO_TOKEN_ENCRYPTION_KEY = originalKey; });

  it('saves encrypted tokens, activates organization and binds the original API/database profiles', async () => {
    const redirect = await handleCallback('test-code', state(), 'https://accounts.zoho.eu');
    expect(new URL(redirect).searchParams.get('zoho')).toBe('success');
    expect(runWithDatabaseProfile).toHaveBeenCalledWith('db-pinned', expect.any(Function));
    expect(getZohoApiConfig).toHaveBeenCalledWith('api-pinned');
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith('test-code', 'https://accounts.zoho.eu', config);
    expect(listOrganizationsWithToken).toHaveBeenCalledWith('https://www.zohoapis.eu', 'test-access');
    expect(prisma.zohoConnection.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      create: expect.objectContaining({ isActive: true, encryptedAccessToken: 'encrypted:test-access', encryptedRefreshToken: 'encrypted:test-refresh' }),
    }));
    expect(bindZohoOrganizationToApiProfile).toHaveBeenCalledWith('org-1', 'api-pinned');
  });
  it('rejects invalid state before token exchange or database writes', async () => {
    await expect(handleCallback('test-code', 'invalid')).rejects.toMatchObject({ code: 'ZOHO_STATE_INVALID' });
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects non-admin or inactive user before token exchange', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handleCallback('test-code', state())).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' });
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });
  it.each([
    ['invalid_code', 'ZOHO_AUTHORIZATION_CODE_INVALID'],
    ['invalid_client', 'ZOHO_CLIENT_INVALID'],
    ['invalid_redirect_uri', 'ZOHO_REDIRECT_INVALID'],
  ])('handles HTTP 200 token error %s without changing connections', async (error, expectedCode) => {
    (exchangeAuthorizationCode as jest.Mock).mockResolvedValue({ error });
    await expect(handleCallback('test-code', state())).rejects.toMatchObject({ code: expectedCode });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('explains a missing refresh token without deactivating existing connections', async () => {
    (exchangeAuthorizationCode as jest.Mock).mockResolvedValue({ access_token: 'test-access' });
    await expect(handleCallback('test-code', state())).rejects.toMatchObject({ code: 'ZOHO_REFRESH_TOKEN_MISSING' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects accounts without an accessible Zoho Books organization', async () => {
    (listOrganizationsWithToken as jest.Mock).mockResolvedValue([]);
    await expect(handleCallback('test-code', state())).rejects.toMatchObject({ code: 'ZOHO_ORGANIZATION_NOT_FOUND' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('does not expose upstream response details when organization retrieval fails', async () => {
    (listOrganizationsWithToken as jest.Mock).mockRejectedValue(new Error('sensitive upstream body'));
    await expect(handleCallback('test-code', state())).rejects.toMatchObject({ code: 'ZOHO_ORGANIZATIONS_FAILED' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('awaits configuration validation before testing a connection', async () => {
    (getActiveZohoApiConfig as jest.Mock).mockResolvedValue(null);
    await expect(testConnection()).rejects.toMatchObject({ code: 'ZOHO_NOT_CONFIGURED' });
    expect(getActiveZohoClient).not.toHaveBeenCalled();
  });
});
