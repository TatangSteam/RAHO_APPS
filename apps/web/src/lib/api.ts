import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

// We import the store getter directly to avoid React hook rules outside components
import { useAuthStore } from '@/stores/authStore';

// ── Base Instance ─────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Request Interceptor ───────────────────────────────────────
// Attach Bearer token on every request

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Response Interceptor ──────────────────────────────────────
// On 401 AUTH_TOKEN_EXPIRED → auto-refresh → retry original request

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(token: string | null, error: unknown = null): void {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const errCode = (error.response?.data as { error?: { code?: string } })?.error?.code;
    const is401Expired =
      error.response?.status === 401 && errCode === 'AUTH_TOKEN_EXPIRED';

    if (!is401Expired || originalRequest._retry) {
      // Non-401 or already retried → just reject
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request while refresh is in progress
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const { refreshToken, setAccessToken, clearAuth } = useAuthStore.getState();

    if (!refreshToken) {
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post<{
        data: { accessToken: string; refreshToken: string };
      }>(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken });

      const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
      setAccessToken(newAccess, newRefresh);
      processQueue(newAccess);

      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(null, refreshError);
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Typed API Error ───────────────────────────────────────────

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
    return data?.error?.message ?? 'Terjadi kesalahan. Silakan coba lagi.';
  }
  return 'Terjadi kesalahan yang tidak diketahui.';
}

export function getApiErrorCode(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
    return data?.error?.code ?? null;
  }
  return null;
}
