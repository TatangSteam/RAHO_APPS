import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { uploadReimbursementEvidence } from '@middleware/upload';
import * as controller from './reimbursement.controller';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', uploadReimbursementEvidence.array('evidence', 5), controller.create);
router.get('/:id', controller.detail);
router.patch('/:id', uploadReimbursementEvidence.array('evidence', 5), controller.update);
router.post('/:id/submit', controller.submit);
router.post('/:id/decision', controller.decide);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/pay', controller.pay);
router.get('/:id/attachments/:attachmentId', controller.attachment);

export default router;
