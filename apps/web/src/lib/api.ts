import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

// We import the store getter directly to avoid React hook rules outside components
import { useAuthStore } from '@/stores/authStore';
import { devLog } from '@/lib/logger';

// ── Base Instance ─────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30_000,
});

// ── Token Expiry Checker ──────────────────────────────────────
// Check token expiry periodically and logout if expired

let tokenCheckInterval: NodeJS.Timeout | null = null;
let lastActivityTime: number = Date.now();
let activityListenersAttached: boolean = false;
let throttleTimeout: NodeJS.Timeout | null = null;

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
  
  // Listen to user activities
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  events.forEach(event => {
    window.addEventListener(event, throttledActivityUpdate, { passive: true });
  });
  
  activityListenersAttached = true;
  devLog('[Activity] Activity listeners attached');
}

function detachActivityListeners(): void {
  if (!activityListenersAttached || typeof window === 'undefined') return;
  
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
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
  // Clear existing interval if any
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }

  // Attach activity listeners
  attachActivityListeners();
  
  // Reset last activity time
  lastActivityTime = Date.now();

  // Check token every 5 seconds (for testing - change to 30000 for production)
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
            const { data } = await axios.post<{
              data: { accessToken: string; refreshToken: string };
            }>(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken });

            const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
            setAccessToken(newAccess, newRefresh);
            
            return; // Skip expiry check since we just refreshed
          } catch (refreshError) {
            // Continue to expiry check below
          }
        }
      }

      // If token is expired, logout
      if (now >= expiryTime) {
        stopTokenExpiryCheck();
        
        // Clear auth and force redirect
        const { clearAuth } = useAuthStore.getState();
        clearAuth();
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('logoutMessage', 'Sesi Anda telah berakhir. Silakan login kembali.');
          
          // Clear auth cookie for middleware
          document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          
          setTimeout(() => {
            window.location.replace('/login');
          }, 100);
        }
      }
    } catch (e) {
      // Error checking token expiry
    }
  }, 5000); // Check every 5 seconds for testing (change to 30000 for production)
}

export function stopTokenExpiryCheck(): void {
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }
  
  detachActivityListeners();
}

// ── Request Interceptor ───────────────────────────────────────
// Attach Bearer token on every request and check if token is expired

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken, clearAuth } = useAuthStore.getState();
  
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
        // Token expired, logout immediately
        const { clearAuth } = useAuthStore.getState();
        clearAuth();
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('logoutMessage', 'Sesi Anda telah berakhir. Silakan login kembali.');
          
          // Clear auth cookie for middleware
          document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          
          setTimeout(() => {
            window.location.replace('/login');
          }, 100);
        }
        
        return Promise.reject(new Error('Token expired'));
      }
    } catch (e) {
      // Invalid token format, logout
      const { clearAuth } = useAuthStore.getState();
      clearAuth();
      
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('logoutMessage', 'Token tidak valid. Silakan login kembali.');
        
        // Clear auth cookie for middleware
        document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        setTimeout(() => {
          window.location.replace('/login');
        }, 100);
      }
      
      return Promise.reject(new Error('Invalid token'));
    }
    
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
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const errCode = (error.response?.data as { error?: { code?: string } })?.error?.code;
    const is401 = error.response?.status === 401;
    const is401Expired = is401 && errCode === 'AUTH_TOKEN_EXPIRED';

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
          const { data } = await axios.post<{
            data: { accessToken: string; refreshToken: string };
          }>(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken });

          const { accessToken: newAccess, refreshToken: newRefresh } = data.data;
          setAccessToken(newAccess, newRefresh);
          processQueue(newAccess);

          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh token failed or expired → force logout
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
