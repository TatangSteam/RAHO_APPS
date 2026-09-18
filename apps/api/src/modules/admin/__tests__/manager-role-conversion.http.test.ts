import express, { NextFunction, Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import { adminRoutes } from '../admin.routes';
import { AdminService } from '../admin.service';
import { ImpersonationService } from '../services/impersonation.service';

// These unrelated handlers are not exercised by the role-management routes.
jest.mock('../../users/users.controller', () => ({ getAllDoctors: jest.fn() }));
jest.mock('../member-historical-import.controller', () => ({
  dryRunMemberHistoricalImport: jest.fn(), executeMemberHistoricalImport: jest.fn(),
}));

jest.mock('@middleware/authenticate', () => ({
  authenticate: (req: Request, res: Response, next: NextFunction) => {
    const role = req.headers['x-test-role'];
    if (!role) { res.status(401).json({ success: false }); return; }
    req.user = { id: 'actor', userId: 'actor', role: String(role), email: 'actor@example.test',
      branchId: null, branchCode: null, fullName: 'Actor', staffCode: null };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);
app.use((error: { statusCode?: number; status?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.statusCode || error.status || 500).json({ error: { code: error.code } });
});

describe('role grant/revocation HTTP authorization and validation', () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  async function send(path: string, role?: string, body?: unknown) {
    const response = await fetch(baseUrl + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    await response.text();
    return response;
  }
  let convert: jest.SpyInstance;
  let list: jest.SpyInstance;
  beforeEach(() => {
    convert = jest.spyOn(AdminService.prototype, 'convertAdminManagerRole').mockResolvedValue({
      id: 'target', email: 'target@example.test', role: 'ADMIN_MANAGER', isActive: true,
      roleTemplate: null, profile: null, assignedBranchCount: 0, historyPreserved: true, accessRevoked: true,
    });
    list = jest.spyOn(ImpersonationService.prototype, 'getAdminManagers').mockResolvedValue({
      managers: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_MANAGER'])('allows Super Admin to request %s', async (targetRole) => {
    const response = await send('/api/v1/admin/managers/target/convert-role', 'SUPER_ADMIN', { targetRole, currentUserId: 'forged-actor' });
    expect(response.status).toBe(200);
    expect(convert).toHaveBeenCalledWith('target', targetRole, 'actor');
  });
  it.each(['ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'])('rejects %s attempting revocation', async (role) => {
    const response = await send('/api/v1/admin/managers/target/convert-role', role, { targetRole: 'ADMIN_MANAGER' });
    expect(response.status).toBe(403);
    expect(convert).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated changes', async () => {
    const response = await send('/api/v1/admin/managers/target/convert-role', undefined, { targetRole: 'ADMIN_MANAGER' });
    expect(response.status).toBe(401);
    expect(convert).not.toHaveBeenCalled();
  });
  it('rejects a target role outside the reviewed three roles', async () => {
    const response = await send('/api/v1/admin/managers/target/convert-role', 'SUPER_ADMIN', { targetRole: 'SUPER_ADMIN' });
    expect(response.status).toBe(400);
    expect(convert).not.toHaveBeenCalled();
  });
  it('lists converted accounts with the parsed role and status filters', async () => {
    const response = await send('/api/v1/admin/managers?role=ADMIN_LOGISTIK&isActive=false', 'SUPER_ADMIN');
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ role: 'ADMIN_LOGISTIK', isActive: false }));
  });
});
