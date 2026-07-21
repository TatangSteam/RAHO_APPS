import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import * as controller from './opening-balance.controller';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/submit', controller.submit);
router.post('/:id/post', controller.post);
router.post('/:id/reject', controller.reject);
export default router;
