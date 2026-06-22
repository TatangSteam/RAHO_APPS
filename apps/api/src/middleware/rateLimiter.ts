import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter for login endpoint
 * Limits: 5 attempts per 15 minutes per IP address
 * 
 * This prevents brute force attacks on the login endpoint
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true,
  
  // Use IP address as the key
  keyGenerator: (req: Request): string => {
    // Try to get real IP from proxy headers first
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    
    // Fallback to connection remote address
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * General API rate limiter
 * Limits: 10000 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 10000 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});
