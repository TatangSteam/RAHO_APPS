import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { uploadMemberDocuments } from '@middleware/upload';
import * as controller from './expense.controller';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', uploadMemberDocuments.single('evidence'), controller.create);
router.get('/:id/evidence', controller.evidence);
router.post('/:id/submit', controller.submit);
router.post('/:id/approve', controller.approve);
router.post('/:id/reject', controller.reject);
router.post('/:id/pay', controller.pay);
export default router;
