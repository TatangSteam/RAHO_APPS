import { api } from '@/lib/api';
import { LoginResponse, TokenPair } from '@/types/auth';

// ── Auth API calls ────────────────────────────────────────────

export async function loginApi(identifier: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<{ data: LoginResponse }>('/auth/login', {
    identifier,
    password,
  });
  return data.data;
}

export async function refreshApi(refreshToken: string): Promise<TokenPair> {
  const { data } = await api.post<{ data: TokenPair }>('/auth/refresh', {
    refreshToken,
  });
  return data.data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}

export async function getMeApi() {
  const { data } = await api.get<{ data: unknown }>('/auth/me');
  return data.data;
}
