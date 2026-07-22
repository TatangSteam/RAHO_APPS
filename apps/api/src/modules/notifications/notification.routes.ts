import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@middleware/authenticate';
import { sendSuccess } from '@utils/response';
import * as service from './notification.service';

const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const query = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(25), status: z.enum(['UNREAD', 'READ']).optional() }).parse(req.query);
    sendSuccess(res, await service.listMyNotifications(req.user.userId, { page: query.page || 1, limit: query.limit || 25, status: query.status }));
  } catch (error) { next(error); }
});
router.patch('/read-all', async (req, res, next) => {
  try { sendSuccess(res, await service.markAllNotificationsRead(req.user.userId)); } catch (error) { next(error); }
});
router.patch('/:id/read', async (req, res, next) => {
  try { sendSuccess(res, await service.markNotificationRead(req.user.userId, req.params.id)); } catch (error) { next(error); }
});
export default router;
