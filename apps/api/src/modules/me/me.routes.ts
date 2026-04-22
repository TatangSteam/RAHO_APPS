import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { getMemberDashboard, getMemberSessions, getMemberDiagnoses, getMemberPackages } from './me.controller';

const router = Router();

/**
 * @route  GET /me/dashboard
 * @desc   Dashboard untuk MEMBER (read-only)
 * @access Bearer (MEMBER only)
 */
router.get(
  '/dashboard',
  authenticate,
  authorize(['MEMBER']),
  getMemberDashboard,
);

/**
 * @route  GET /me/sessions
 * @desc   List sesi terapi member
 * @access Bearer (MEMBER only)
 */
router.get(
  '/sessions',
  authenticate,
  authorize(['MEMBER']),
  getMemberSessions,
);

/**
 * @route  GET /me/diagnoses
 * @desc   List diagnosa member
 * @access Bearer (MEMBER only)
 */
router.get(
  '/diagnoses',
  authenticate,
  authorize(['MEMBER']),
  getMemberDiagnoses,
);

/**
 * @route  GET /me/vouchers
 * @desc   List paket member
 * @access Bearer (MEMBER only)
 */
router.get(
  '/vouchers',
  authenticate,
  authorize(['MEMBER']),
  getMemberPackages,
);

export { router as meRouter };