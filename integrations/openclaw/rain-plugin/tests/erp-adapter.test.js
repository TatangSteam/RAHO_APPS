import assert from 'node:assert/strict';
import test from 'node:test';
import { createErpAdapter } from '../erp-adapter.js';

const performance = {
  totalTasks: 2, eligibleTasks: 2, unfinished: 1, completed: 1, inProgress: 1,
  todo: 0, submitted: 0, needsRevision: 0, cancelled: 0, overdue: 0, completionRate: 50,
};
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const envelope = { contractVersion: 'rain.v1', success: true, source: 'erp', isDemo: false, asOf: '2026-09-16T10:00:00+07:00', user: { id: 'user-1' } };

test('calls the personal ERP endpoint with the bound session key', async () => {
  let captured;
  const adapter = createErpAdapter({
    baseUrl: 'http://127.0.0.1:4000',
    resolveIdentity: async () => ({ authenticated: true, sessionKey: 'rain-erp-session' }),
    fetchImpl: async (url, init) => { captured = { url: String(url), init }; return response({ ...envelope, performance }); },
  });
  const result = await adapter.request('performance', { period: 'this_week' }, { sessionKey: 'session' });
  assert.equal(result.success, true);
  assert.match(captured.url, /\/api\/v1\/ai\/me\/performance\?period=this_week$/);
  assert.equal(captured.init.headers['X-RAIN-Session-Key'], 'rain-erp-session');
});

test('fails closed when ERP envelope is invalid', async () => {
  const adapter = createErpAdapter({
    baseUrl: 'http://127.0.0.1:4000',
    resolveIdentity: async () => ({ authenticated: true, sessionKey: 'rain-erp-session' }),
    fetchImpl: async () => response({ ...envelope, contractVersion: 'wrong', performance }),
  });
  const result = await adapter.request('daily', {}, {});
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'INVALID_RESPONSE');
});

test('serializes comparison periods to the ERP flat query contract', async () => {
  let requested;
  const adapter = createErpAdapter({
    baseUrl: 'http://127.0.0.1:4000',
    resolveIdentity: async () => ({ authenticated: true, sessionKey: 'rain-erp-session' }),
    fetchImpl: async (url) => {
      requested = String(url);
      return response({ ...envelope, periodA: { performance }, periodB: { performance }, comparison: { direction: 'A_MINUS_B' } });
    },
  });
  const result = await adapter.request('compare', { periodA: { period: 'this_week' }, periodB: { period: 'last_week' } }, {});
  assert.equal(result.success, true);
  assert.match(requested, /periodA=this_week/);
  assert.match(requested, /periodB=last_week/);
});
