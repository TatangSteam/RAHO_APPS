import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { loginRateLimiter } from '@middleware/rateLimiter';
import { login, refresh, logout, getMe, updateOwnFullName, updateOwnUsername } from './auth.controller';

const router = Router();

/**
 * @route  POST /auth/login
 * @desc   Login with member username or staff email + password
 * @access Public
 * @rateLimit 5 requests per 15 minutes per IP
 */
router.post('/login', loginRateLimiter, login);

/**
 * @route  POST /auth/refresh
 * @desc   Rotate access token using a valid refresh token
 * @access Public (no access token needed — it may be expired)
 */
router.post('/refresh', refresh);

/**
 * @route  POST /auth/logout
 * @desc   Invalidate session (stateless — client drops token)
 * @access Bearer
 */
router.post('/logout', authenticate, logout);

/**
 * @route  GET /auth/me
 * @desc   Return current authenticated user's data
 * @access Bearer
 */
router.get('/me', authenticate, getMe);
router.patch('/me/full-name', authenticate, updateOwnFullName);
router.patch('/me/username', authenticate, updateOwnUsername);

export { router as authRouter };
