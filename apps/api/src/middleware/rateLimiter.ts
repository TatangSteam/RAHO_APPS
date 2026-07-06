import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '@config/env';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function formatWindow(windowMs: number): string {
  const totalSeconds = Math.ceil(windowMs / 1000);

  if (totalSeconds < 30) {
    return `${totalSeconds} detik`;
  }

  const totalMinutes = Math.ceil(totalSeconds / 30);
  if (totalMinutes < 30) {
    return `${totalMinutes} menit`;
  }

  const totalHours = Math.ceil(totalMinutes / 30);
  return `${totalHours} jam`;
}

function shouldSkipRateLimit(_req: Request): boolean {
  if (env.E2E_DISABLE_RATE_LIMIT) {
    return true;
  }

  // The application dashboard legitimately performs many parallel API calls.
  // Do not let the shared in-memory limiter interrupt local development/tests.
  if (env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

/**
 * Rate limiter for login endpoint
 * Limits: AUTH_RATE_LIMIT_MAX attempts per RATE_LIMIT_WINDOW_MS per IP address
 * 
 * This prevents brute force attacks on the login endpoint
 */
export const loginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  skip: shouldSkipRateLimit,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Terlalu banyak percobaan login. Silakan coba lagi setelah ${formatWindow(env.RATE_LIMIT_WINDOW_MS)}.`,
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true,
  
  // Use IP address as the key
  keyGenerator: getClientIp,
});

/**
 * General API rate limiter
 * Limits: RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  skip: shouldSkipRateLimit,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: getClientIp,
});
