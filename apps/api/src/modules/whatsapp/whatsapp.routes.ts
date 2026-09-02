import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { upload } from '@middleware/upload';
import * as controller from './whatsapp-connection.controller';

const router = Router();
router.use(authenticate, authorize([Role.SUPER_ADMIN]));
router.get('/connection', controller.status);
router.post('/connection/qr', controller.qr);
router.post('/connection/reconnect', controller.reconnect);
router.post('/connection/logout', controller.logout);
router.put('/config', controller.updateConfig);
router.post('/config/background', upload.single('background'), controller.uploadBackground);
router.get('/deliveries', controller.deliveries);
router.post('/deliveries/:deliveryId/retry', controller.retryDelivery);

export default router;
