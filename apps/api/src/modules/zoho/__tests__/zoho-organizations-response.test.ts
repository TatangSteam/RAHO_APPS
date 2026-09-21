import axios from 'axios';
import { listOrganizationsWithToken } from '../zoho.client';

jest.mock('axios');

describe('Zoho organization discovery response', () => {
  beforeEach(() => jest.clearAllMocks());
  it('accepts a valid organization response', async () => {
    const organizations = [{ organization_id: 'org-test', name: 'Test' }];
    (axios.get as jest.Mock).mockResolvedValue({ data: { code: 0, organizations } });
    expect(await listOrganizationsWithToken('https://www.zohoapis.com', 'test-only')).toEqual(organizations);
  });
  it('accepts an explicitly empty list', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { code: 0, organizations: [] } });
    expect(await listOrganizationsWithToken('https://www.zohoapis.com', 'test-only')).toEqual([]);
  });
  it('does not misinterpret an HTTP 200 API error as no organizations', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { code: 57, message: 'No access' } });
    await expect(listOrganizationsWithToken('https://www.zohoapis.com', 'test-only')).rejects.toMatchObject({ code: '57' });
  });
  it.each([{}, { organizations: 'invalid' }, { organizations: [{ name: 'missing id' }] }])('rejects a malformed response', async (data) => {
    (axios.get as jest.Mock).mockResolvedValue({ data });
    await expect(listOrganizationsWithToken('https://www.zohoapis.com', 'test-only')).rejects.toMatchObject({ code: 'ZOHO_ORGANIZATION_RESPONSE_INVALID' });
  });
});
