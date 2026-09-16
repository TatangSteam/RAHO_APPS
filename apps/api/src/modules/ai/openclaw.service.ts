import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { env } from '@config/env';
import { AppError } from '@middleware/errorHandler';
import { RainUser } from './ai.service';

type OpenClawCompletion = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

type SessionBinding = { user: RainUser; expiresAt: number };
const sessionBindings = new Map<string, SessionBinding>();

let cachedLocalToken: string | null = null;

async function gatewayToken(): Promise<string> {
  if (env.OPENCLAW_GATEWAY_TOKEN) return env.OPENCLAW_GATEWAY_TOKEN;
  if (env.NODE_ENV === 'production') {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Konfigurasi OpenClaw belum tersedia.');
  }
  if (cachedLocalToken) return cachedLocalToken;
  const configPath = env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), '.openclaw', 'openclaw.json');
  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf8')) as {
      gateway?: { auth?: { token?: unknown } };
    };
    const token = parsed.gateway?.auth?.token;
    if (typeof token !== 'string' || token.length < 16) throw new Error('missing token');
    cachedLocalToken = token;
    return token;
  } catch {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Konfigurasi OpenClaw lokal tidak dapat dibaca.');
  }
}

function sessionKey(userId: string, conversationId: string): string {
  return `rain-erp-${createHash('sha256').update(`${userId}:${conversationId}`).digest('hex').slice(0, 32)}`;
}

export function resolveOpenClawSession(key: string | undefined): RainUser | null {
  if (!key || !/^rain-erp-[a-f0-9]{32}$/.test(key)) return null;
  const binding = sessionBindings.get(key);
  if (!binding) return null;
  if (binding.expiresAt <= Date.now()) {
    sessionBindings.delete(key);
    return null;
  }
  return binding.user;
}

async function openClawRequest(pathname: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OPENCLAW_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(new URL(pathname, env.OPENCLAW_GATEWAY_URL), {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${await gatewayToken()}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'TIMEOUT', 'OpenClaw melewati batas waktu.');
    }
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'OpenClaw tidak dapat dihubungi.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatThroughOpenClaw(
  user: RainUser,
  message: string,
  conversationId: string,
) {
  const key = sessionKey(user.userId, conversationId);
  sessionBindings.set(key, { user, expiresAt: Date.now() + 5 * 60_000 });

  const response = await openClawRequest('/v1/chat/completions', {
    method: 'POST',
    headers: { 'x-openclaw-session-key': `agent:${env.OPENCLAW_AGENT_ID}:${key}` },
    body: JSON.stringify({
      model: `openclaw/${env.OPENCLAW_AGENT_ID}`,
      stream: false,
      messages: [{ role: 'user', content: message }],
    }),
  });
  let body: OpenClawCompletion;
  try {
    body = await response.json() as OpenClawCompletion;
  } catch {
    throw new AppError(503, 'INVALID_RESPONSE', 'Respons OpenClaw tidak valid.');
  }
  if (!response.ok) {
    throw new AppError(
      response.status === 504 ? 504 : 503,
      response.status === 504 ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE',
      'OpenClaw belum dapat menjawab. Silakan coba lagi.',
    );
  }
  const reply = body.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new AppError(503, 'INVALID_RESPONSE', 'OpenClaw tidak mengembalikan jawaban.');
  return {
    contractVersion: 'rain.v1' as const,
    success: true as const,
    source: 'erp' as const,
    isDemo: false,
    asOf: new Date().toISOString(),
    user: { id: user.userId },
    mode: 'openclaw' as const,
    intent: 'agent' as const,
    reply,
    conversationId,
    context: null,
    data: null,
  };
}
