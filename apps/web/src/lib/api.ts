import { assertCaughtError } from '@/lib/caughtError';
import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

// We import the store getter directly to avoid React hook rules outside components
import { useAuthStore } from '@/stores/authStore';
import { devLog } from '@/lib/logger';
import { startApiLoading, endApiLoading } from '@/lib/apiLoadingTracking';

// ── Base Instance ─────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30_000,
});

type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
};

type ApiRequestConfig = InternalAxiosRequestConfig & {
  skipLoading?: boolean;
  _retry?: boolean;
};

function shouldSkipLoading(config?: InternalAxiosRequestConfig): boolean {
  return (config as ApiRequestConfig | undefined)?.skipLoading === true;
}

let tokenRefreshState: {
  sourceToken: string;
  promise: Promise<RefreshedTokens>;
} | null = null;

async function requestFreshTokens(refreshToken: string): Promise<RefreshedTokens> {
  const { data } = await axios.post<{
    data: { accessToken: string; refreshToken: string };
  }>(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken });

  return data.data;
}

/**
 * Reuse one in-flight refresh across the timer, request interceptor, and
 * response interceptor. Without this guard, several API calls made as a token
 * expires can all rotate the same refresh token at once.
 */
async function refreshTokens(refreshToken: string): Promise<RefreshedTokens> {
  if (!tokenRefreshState || tokenRefreshState.sourceToken !== refreshToken) {
    const trackedPromise = requestFreshTokens(refreshToken).finally(() => {
      if (tokenRefreshState?.promise === trackedPromise) {
        tokenRefreshState = null;
      }
    });
    tokenRefreshState = { sourceToken: refreshToken, promise: trackedPromise };
  }

  return tokenRefreshState.promise;
}

// ── Token Expiry Checker ──────────────────────────────────────
// Check token expiry periodically and logout if expired

let tokenCheckInterval: NodeJS.Timeout | null = null;
let lastActivityTime: number = Date.now();
let activityListenersAttached: boolean = false;
let throttleTimeout: NodeJS.Timeout | null = null;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'scroll',
  'touchstart',
];

// Activity detection
function updateLastActivity(): void {
  lastActivityTime = Date.now();
  devLog('[Activity] User activity detected, last activity updated');
}

// Throttled activity update (max once per second)
function throttledActivityUpdate(): void {
  if (!throttleTimeout) {
    updateLastActivity();
    throttleTimeout = setTimeout(() => {
      throttleTimeout = null;
    }, 1000); // Update at most once per second
  }
}

function attachActivityListeners(): void {
  if (activityListenersAttached || typeof window === 'undefined') return;
  
  ACTIVITY_EVENTS.forEach(event => {
    window.addEventListener(event, throttledActivityUpdate, { passive: true });
  });
  
  activityListenersAttached = true;
  devLog('[Activity] Activity listeners attached');
}

function detachActivityListeners(): void {
  if (!activityListenersAttached || typeof window === 'undefined') return;
  
  ACTIVITY_EVENTS.forEach(event => {
    window.removeEventListener(event, throttledActivityUpdate);
  });
  
  // Clear throttle timeout
  if (throttleTimeout) {
    clearTimeout(throttleTimeout);
    throttleTimeout = null;
  }
  
  activityListenersAttached = false;
  devLog('[Activity] Activity listeners detached');
}

export function startTokenExpiryCheck(): void {
  // A successful login/rehydration starts a fresh session, so future expiry
  // must be allowed to show one logout notification again.
  hasShownLogoutNotification = false;

  // Clear existing interval if any
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }

  // Attach activity listeners
  attachActivityListeners();
  
  // Reset last activity time
  lastActivityTime = Date.now();

  // Check token periodically. Active users may refresh shortly before expiry;
  // inactive users are logged out when the 3-hour access token expires.
  tokenCheckInterval = setInterval(async () => {
    const { accessToken, refreshToken, setAccessToken } = useAuthStore.getState();
    
    if (!accessToken) {
      return; // No token, skip check
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiryTime = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      const timeSinceActivity = now - lastActivityTime;

      // If user was active in last 30 seconds and token is about to expire
      if (timeSinceActivity < 30000 && timeUntilExpiry > 0 && timeUntilExpiry < 60000) {
        // Try to refresh token
        if (refreshToken) {
          try {
            const { accessToken: newAccess, refreshToken: newRefresh } = await refreshTokens(refreshToken);
            setAccessToken(newAccess, newRefresh);
            
            return; // Skip expiry check since we just refreshed
          } catch {
            // Continue to expiry check below
          }
        }
      }

      // If token is expired, logout
      if (now >= expiryTime) {
        if (refreshToken) {
          try {
            const { accessToken: newAccess, refreshToken: newRefresh } = await refreshTokens(refreshToken);
            setAccessToken(newAccess, newRefresh);
            lastActivityTime = Date.now();
            return;
          } catch {
            // Refresh token is also no longer valid, continue to logout below.
          }
        }

        handleUnauthorizedLogout();
      }
    } catch {
      // Error checking token expiry
    }
  }, 30000);
}

export function stopTokenExpiryCheck(): void {
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }
  
  detachActivityListeners();
}

// ── Request Interceptor ───────────────────────────────────────
// Attach Bearer token on every request and refresh it first when possible

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Start loading tracking (unless explicitly disabled)
  const skipLoading = shouldSkipLoading(config);
  if (!skipLoading) {
    startApiLoading();
  }

  const rejectRequest = (error: Error) => {
    if (!skipLoading) {
      endApiLoading();
    }

    return Promise.reject(error);
  };
  
  const { accessToken, refreshToken, setAccessToken } = useAuthStore.getState();
  
  // Set Content-Type based on data type
  if (config.data instanceof FormData) {
    // Let browser set Content-Type with boundary for multipart/form-data
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    // Default to JSON for non-FormData requests
    config.headers['Content-Type'] = 'application/json';
  }
  
  if (accessToken) {
    // Check if token is expired before sending request
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const isExpired = Date.now() >= payload.exp * 1000;
      
      if (isExpired) {
        if (refreshToken) {
          try {
            const { accessToken: newAccess, refreshToken: newRefresh } = await refreshTokens(refreshToken);
            setAccessToken(newAccess, newRefresh);
            config.headers.Authorization = `Bearer ${newAccess}`;
            return config;
          } catch {
            // Fall through to logout below if refresh also fails.
          }
        }

        handleUnauthorizedLogout();
        return rejectRequest(new Error('Token expired'));
      }
    } catch {
      handleUnauthorizedLogout('Token tidak valid. Silakan login kembali.');
      return rejectRequest(new Error('Invalid token'));
    }
    
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  
  return config;
}, (error) => {
  // End loading on request error
  endApiLoading();
  return Promise.reject(error);
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
  
  // Clear auth state first
  clearAuth();
  
  // Show notification only once
  if (!hasShownLogoutNotification) {
    hasShownLogoutNotification = true;
    
    // Store message in sessionStorage to show after redirect
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('logoutMessage', message);
      
      // Clear auth cookie for middleware
      document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      
      // Force redirect using replace (no back button)
      // Use setTimeout to ensure cookie is cleared first
      setTimeout(() => {
        window.location.replace('/login');
      }, 100);
    }
  }
}

api.interceptors.response.use(
  (response) => {
    // End loading on success
    const skipLoading = shouldSkipLoading(response.config);
    if (!skipLoading) {
      endApiLoading();
    }
    return response;
  },
  async (error: AxiosError) => {
    // End loading on error (will be called in finally block or here)
    const skipLoading = shouldSkipLoading(error.config);
    if (!skipLoading) {
      endApiLoading();
    }
    
    const originalRequest = error.config as ApiRequestConfig;

    const errCode = (error.response?.data as { error?: { code?: string } })?.error?.code;
    const is401 = error.response?.status === 401;
    const is401Expired = is401 && errCode === 'AUTH_TOKEN_EXPIRED';
    const isDatabaseChanged = is401 && errCode === 'AUTH_DATABASE_CHANGED';
    const isAuthTokenError = is401 && [
      'AUTH_TOKEN_INVALID',
      'AUTH_TOKEN_MISSING',
      'AUTH_DATABASE_CHANGED',
    ].includes(errCode ?? '');

    // Skip unauthorized handling for auth endpoints (login, register, etc.)
    // These endpoints return 401 for invalid credentials, not for expired tokens
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');
    
    // If 401 and not a retry attempt and not an auth endpoint
    if (is401 && !originalRequest._retry && !isAuthEndpoint) {
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

        const { refreshToken, setAccessToken } = useAuthStore.getState();

        if (!refreshToken) {
          isRefreshing = false;
          handleUnauthorizedLogout('Token tidak valid. Silakan login kembali.');
          return Promise.reject(error);
        }

        try {
          const { accessToken: newAccess, refreshToken: newRefresh } = await refreshTokens(refreshToken);
          setAccessToken(newAccess, newRefresh);
          processQueue(newAccess);

          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch (refreshError) {
      assertCaughtError(refreshError);
          // Refresh token failed or expired → force logout
          processQueue(null, refreshError);
          handleUnauthorizedLogout('Sesi Anda telah berakhir. Silakan login kembali.');
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // Any other 401 error (invalid token, unauthorized, etc.) → logout immediately
        if (!isAuthTokenError) {
          return Promise.reject(error);
        }

        handleUnauthorizedLogout(
          isDatabaseChanged
            ? 'Database aktif telah berubah. Silakan login kembali.'
            : 'Sesi Anda tidak valid. Silakan login kembali.',
        );
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
    details?: Array<{ field?: string; message?: string } | string>;
  };
}

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
    const message = data?.error?.message ?? 'Terjadi kesalahan. Silakan coba lagi.';
    const detailMessages = data?.error?.details
      ?.map((detail) => typeof detail === 'string' ? detail : detail.message)
      .filter((detail): detail is string => Boolean(detail));
    return detailMessages?.length ? `${message}: ${detailMessages.join('; ')}` : message;
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
