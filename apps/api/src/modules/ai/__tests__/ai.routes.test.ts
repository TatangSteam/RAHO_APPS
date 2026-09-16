import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { aiRouter } from '../ai.routes';

jest.mock('@lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@middleware/authenticate', () => ({
  authenticate: jest.fn((req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED' } });
    req.user = { userId: 'token-user', fullName: 'James', role: req.headers.authorization === 'Bearer member' ? 'MEMBER' : 'ADMIN_LAYANAN', staffCode: 'MSO001' };
    next();
  }),
}));
const tx = { $executeRaw: jest.fn(), $queryRaw: jest.fn(), teamTask: { groupBy: jest.fn(), count: jest.fn() } };
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai', aiRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/ai`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation((work) => work(tx));
  tx.$executeRaw.mockResolvedValue(0); tx.$queryRaw.mockResolvedValue([]);
  tx.teamTask.groupBy.mockResolvedValue([]); tx.teamTask.count.mockResolvedValue(0);
});
const get = (path: string, authorization = 'Bearer staff') => fetch(`${base}${path}`, { headers: authorization ? { Authorization: authorization } : {} });
describe('RAIN HTTP API contract', () => {
  it.each([
    '/me/performance/today', '/me/performance?period=today',
    '/me/performance/compare?periodA=this_week&periodB=last_week',
    '/me/tasks?period=today&status=OPEN', '/me/tasks/overdue',
  ])('serves authenticated read-only endpoint %s with no-store', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ contractVersion: 'rain.v1', success: true, source: 'erp', isDemo: false, user: { id: 'token-user' } });
  });
  it('normalizes missing authentication and denies MEMBER without task queries', async () => {
    const missing = await get('/me/performance/today', '');
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    const member = await get('/me/performance/today', 'Bearer member');
    expect(member.status).toBe(403);
    expect(await member.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    '/me/performance/today?userId=other', '/me/performance?period=today&role=SUPER_ADMIN',
    '/me/tasks?period=today&branchId=other', '/me/tasks/overdue?status=TODO',
    '/me/performance?period=custom&startDate=2026-02-30&endDate=2026-03-01',
  ])('rejects invalid/scope-changing arguments %s', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_ARGUMENT' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('shares daily shortcut metrics with period=today', async () => {
    const A = await (await get('/me/performance/today')).json() as any;
    const B = await (await get('/me/performance?period=today')).json() as any;
    expect(A.performance).toEqual(B.performance);
    expect(A.period).toEqual(B.period);
  });
  it('does not accept user identity in the chat body', async () => {
    const response = await fetch(`${base}/chat`, { method: 'POST', headers: { Authorization: 'Bearer staff', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Kinerja hari ini', userId: 'other' }) });
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('serves chat from the same personal service, without modifying task state', async () => {
    const response = await fetch(`${base}/chat`, { method: 'POST', headers: { Authorization: 'Bearer staff', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Kinerja hari ini' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'rules', intent: 'performance', data: { performance: { totalTasks: 0, completionRate: null } } });
    expect(tx.teamTask.groupBy.mock.calls[0][0].where.assignments.some.userId).toBe('token-user');
  });
  it('maps database failure to 503 rather than empty success or internal details', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('secret connection string'));
    const response = await get('/me/performance/today');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: { code: 'SERVICE_UNAVAILABLE' } });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
  it('maps transaction timeout to 504', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Prisma.PrismaClientKnownRequestError('timeout', { code: 'P2028', clientVersion: 'test' }));
    const response = await get('/me/performance/today');
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'TIMEOUT' } });
  });
});
