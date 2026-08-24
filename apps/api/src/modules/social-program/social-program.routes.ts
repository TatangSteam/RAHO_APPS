import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import * as controller from './social-program.controller';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.detail);
router.post('/:id/decision', controller.decide);
router.post('/:id/activate', controller.retryActivation);

export default router;
