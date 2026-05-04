import { Request, Response, NextFunction } from 'express';
import { loginSchema, refreshSchema, logoutSchema } from './auth.schema';
import { loginService, refreshService, getMeService } from './auth.service';
import { sendSuccess } from '@utils/response';
import { prisma } from '@lib/prisma';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    
    // Get IP address and user agent from request
    let ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Convert IPv6 localhost to IPv4 for clarity
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
      ipAddress = '127.0.0.1';
    }
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    console.log('🔐 LOGIN - Creating audit log:', {
      email: input.email,
      ipAddress,
      userAgent: userAgent.substring(0, 50) + '...'
    });
    
    const result = await loginService(input, ipAddress, userAgent);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await refreshService(refreshToken);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logoutSchema.parse(req.body);
    
    console.log('🚪 LOGOUT - Request user:', req.user);
    
    // Create audit log for LOGOUT (AWAIT to ensure it's saved)
    if (req.user?.userId) {
      try {
        // Get IP address and user agent from request
        let ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        
        // Convert IPv6 localhost to IPv4 for clarity
        if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
          ipAddress = '127.0.0.1';
        }
        
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        // Only include branchId if user is not SUPER_ADMIN or ADMIN_MANAGER
        const shouldIncludeBranch = req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN_MANAGER';
        
        console.log('🚪 LOGOUT - Creating audit log:', {
          userId: req.user.userId,
          email: req.user.email,
          role: req.user.role,
          branchId: shouldIncludeBranch ? req.user.branchId : null,
          ipAddress,
          userAgent: userAgent.substring(0, 50) + '...'
        });
        
        const auditLog = await prisma.auditLog.create({
          data: {
            userId: req.user.userId,
            branchId: shouldIncludeBranch ? req.user.branchId : null,
            action: 'LOGOUT',
            resource: 'Auth',
            resourceId: req.user.userId,
            meta: {
              email: req.user.email,
              role: req.user.role,
            },
            ipAddress: ipAddress,
            userAgent: userAgent,
          },
        });
        
        console.log('✅ LOGOUT audit log created:', auditLog.id);
      } catch (error) {
        console.error('❌ Failed to create LOGOUT audit log:', error);
      }
    } else {
      console.warn('⚠️  LOGOUT - No user in request, audit log not created');
    }
    
    // Stateless JWT — client discards token.
    // Extend here with DB-backed token blacklist if needed.
    sendSuccess(res, { message: 'Logout berhasil.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getMeService(req.user.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
