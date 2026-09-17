jest.mock('@config/env', () => ({ env: {
  NODE_ENV: 'test',
  OPENCLAW_GATEWAY_URL: 'http://127.0.0.1:18789',
  OPENCLAW_GATEWAY_TOKEN: 'test-gateway-token-value',
  OPENCLAW_AGENT_ID: 'rain',
  OPENCLAW_REQUEST_TIMEOUT_MS: 10_000,
} }));

import { chatThroughOpenClaw, resolveOpenClawSession } from '../openclaw.service';

describe('OpenClaw ERP session bridge', () => {
  afterEach(() => jest.restoreAllMocks());

  it('binds an opaque session locally and sends no ERP credential to OpenClaw', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Jawaban RAIN' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const user = { userId: 'user-1', fullName: 'James', role: 'ADMIN_LAYANAN', staffCode: 'MSO001' };
    const result = await chatThroughOpenClaw(user, 'Kinerja hari ini', '2dc2e222-f555-447a-81b8-e03d5731f1b9');

    expect(result).toMatchObject({ mode: 'openclaw', reply: 'Jawaban RAIN', user: { id: 'user-1' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-gateway-token-value');
    expect(headers['x-openclaw-session-key']).toMatch(/^agent:rain:rain-erp-[a-f0-9]{32}$/);
    expect(String(init?.body)).not.toContain('user-1');
    const payload = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
    expect(payload.messages[0]).toEqual(expect.objectContaining({ role: 'system', content: expect.stringContaining('James') }));
    expect(payload.messages[1]).toEqual({ role: 'user', content: '[RAIN_AUTH_CONTEXT display_name="James"]\nKinerja hari ini' });
    const key = headers['x-openclaw-session-key'].split(':').at(-1);
    expect(resolveOpenClawSession(key)).toEqual(user);
  });
});
