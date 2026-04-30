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
// On other 401 errors → logout immediately

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

// Track if we've already shown logout notification to avoid duplicates
let hasShownLogoutNotification = false;

function handleUnauthorizedLogout(message: string = 'Sesi Anda telah berakhir. Silakan login kembali.'): void {
  const { clearAuth } = useAuthStore.getState();
  clearAuth();
  
  // Show notification only once
  if (!hasShownLogoutNotification) {
    hasShownLogoutNotification = true;
    
    // Store message in sessionStorage to show after redirect
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('logoutMessage', message);
    }
  }
  
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const errCode = (error.response?.data as { error?: { code?: string } })?.error?.code;
    const is401 = error.response?.status === 401;
    const is401Expired = is401 && errCode === 'AUTH_TOKEN_EXPIRED';

    // If 401 and not a retry attempt
    if (is401 && !originalRequest._retry) {
      // If it's AUTH_TOKEN_EXPIRED, try to refresh
      if (is401Expired) {
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
          handleUnauthorizedLogout('Token tidak valid. Silakan login kembali.');
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
          handleUnauthorizedLogout('Sesi Anda telah berakhir. Silakan login kembali.');
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // Any other 401 error (invalid token, unauthorized, etc.) → logout immediately
        handleUnauthorizedLogout('Akses tidak diizinkan. Silakan login kembali.');
        return Promise.reject(error);
      }
    }

    // Non-401 or already retried → just reject
    return Promise.reject(error);
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
