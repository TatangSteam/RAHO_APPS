import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { login, refresh, logout, getMe } from './auth.controller';

const router = Router();

/**
 * @route  POST /auth/login
 * @desc   Login with email + password — returns access + refresh tokens
 * @access Public
 */
router.post('/login', login);

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

export { router as authRouter };
