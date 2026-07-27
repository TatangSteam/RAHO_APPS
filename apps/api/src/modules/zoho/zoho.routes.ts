import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize, SUPER_ADMIN_ONLY } from '@middleware/authorize';
import * as controller from './zoho.controller';

const router = Router();
router.get('/callback', controller.callback);
router.use(authenticate, authorize(SUPER_ADMIN_ONLY));
router.get('/connect', controller.connect);
router.get('/status', controller.status);
router.post('/test', controller.test);
router.post('/organizations/:id/activate', controller.activate);
router.delete('/connection', controller.disconnect);
export default router;
