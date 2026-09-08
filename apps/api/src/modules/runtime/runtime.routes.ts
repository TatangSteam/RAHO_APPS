import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import * as controller from './runtime.controller';

const router = Router();

router.use(authenticate, authorize(['SUPER_ADMIN']));
router.get('/databases', controller.databases);
router.post('/databases', controller.addDatabase);
router.post('/databases/activate', controller.activateDatabase);
router.get('/zoho-api-profiles', controller.zohoApiProfiles);
router.post('/zoho-api-profiles', controller.addZohoApiProfile);
router.post('/zoho-api-profiles/:id/activate', controller.activateZohoApiProfile);

export default router;
