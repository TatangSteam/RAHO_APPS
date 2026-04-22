import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken } from '@lib/jwt';
import { sendError } from '@utils/response';

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        userId: string;
        email: string;
        role: string;
        branchId: string | null;
        branchCode: string | null;
        fullName: string;
        staffCode: string | null;
      };
    }
  }
}

/**
 * Middleware — Verify JWT access token and attach user to request.
 * Must be applied before any route handler that requires authentication.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  console.log('🔐 AUTHENTICATE MIDDLEWARE');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Auth Header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');

  if (!authHeader?.startsWith('Bearer ')) {
    console.error('❌ Token missing or invalid format');
    sendError(res, 401, 'AUTH_TOKEN_MISSING', 'Token autentikasi diperlukan.');
    return;
  }

  const token = authHeader.slice(7);
  console.log('Token Length:', token.length);

  try {
    const payload = verifyAccessToken(token);
    console.log('✅ Token verified successfully');
    console.log('User ID:', payload.userId);
    console.log('User Role:', payload.role);
    console.log('Branch ID:', payload.branchId);
    
    // Map userId to id for backward compatibility
    req.user = {
      ...payload,
      id: payload.userId,
    };
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err);
    if (err instanceof TokenExpiredError) {
      sendError(res, 401, 'AUTH_TOKEN_EXPIRED', 'Sesi Anda telah berakhir. Silakan login kembali.');
    } else if (err instanceof JsonWebTokenError) {
      sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Token tidak valid.');
    } else {
      sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Token tidak valid.');
    }
  }
}
