import { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken, JwtPayload } from '@lib/jwt';
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
        branches?: string[]; // For Admin Manager (multiple branches)
      };
      originalUser?: {
        id: string;
        userId: string;
        email: string;
        role: string;
        branchId: string | null;
        fullName: string;
      };
      isImpersonating: boolean;
      impersonationChain?: string[]; // Full chain of impersonation
    }
  }
}

/**
 * Helper function to extract the deepest impersonated user from nested impersonation
 */
function extractDeepestImpersonation(payload: JwtPayload): {
  deepest: NonNullable<JwtPayload['impersonating']>;
  chain: string[];
} {
  const chain: string[] = [payload.email];
  let current = payload.impersonating;
  
  if (!current) {
    throw new Error('No impersonation data found');
  }
  
  // Traverse the impersonation chain to find the deepest level
  while (current.impersonating) {
    chain.push(current.email);
    current = current.impersonating;
  }
  
  // Add the deepest impersonated user to the chain
  chain.push(current.email);
  
  return { deepest: current, chain };
}

/**
 * Middleware — Verify JWT access token and attach user to request.
 * Must be applied before any route handler that requires authentication.
 * 
 * Handles nested impersonation:
 * - Super Admin → Admin Manager → Admin Cabang
 * - Admin Manager → Admin Cabang
 * 
 * Sets req.user to the DEEPEST impersonated user (the one being acted as)
 * Sets req.originalUser to the ROOT user (the one who started impersonation)
 * Sets req.impersonationChain to the full chain of emails
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
    console.log('Has Impersonation:', !!payload.impersonating);
    
    // Check if impersonating
    if (payload.impersonating) {
      // Extract the deepest level of impersonation and full chain
      const { deepest, chain } = extractDeepestImpersonation(payload);
      
      console.log('🎭 Impersonation Chain:', chain.join(' → '));
      console.log('🎭 Acting as:', deepest.email, `(${deepest.role})`);
      
      // Set original user (root of chain - the one who started impersonation)
      req.originalUser = {
        id: payload.userId,
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        branchId: payload.branchId,
        fullName: payload.fullName,
      };
      
      // Set current user as the deepest impersonated user
      // This is CRITICAL: All authorization checks must use req.user
      req.user = {
        id: deepest.userId,
        userId: deepest.userId,
        email: deepest.email,
        role: deepest.role,
        branchId: deepest.branchId || null,
        branchCode: null, // Will be fetched if needed
        fullName: payload.fullName, // Keep original for display purposes
        staffCode: null,
        branches: deepest.branches, // For Admin Manager (multiple branches)
      };
      
      req.isImpersonating = true;
      req.impersonationChain = chain;
    } else {
      // Normal authentication (no impersonation)
      req.user = {
        ...payload,
        id: payload.userId,
      };
      req.isImpersonating = false;
    }
    
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
