import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import * as controller from './collaboration.controller';

const router = Router();
const COLLABORATION_ROLES = [
  Role.SUPER_ADMIN,
  Role.VOUCHER_OPERATOR,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.ADMIN_LOGISTIK,
  Role.FINANCE_LOGISTICS_CONTROLLER,
  Role.DOCTOR,
  Role.NURSE,
];

router.use(authenticate, authorize(COLLABORATION_ROLES));
router.get('/bootstrap', controller.bootstrap);
router.post('/teams', controller.createTeam);
router.patch('/teams/:teamId', controller.updateTeam);
router.post('/teams/:teamId/members', controller.addMember);
router.patch('/teams/:teamId/members/:membershipId', controller.updateMember);
router.patch('/teams/:teamId/primary-leader', controller.setPrimaryLeader);
router.post('/tasks', controller.createTask);
router.get('/tasks/:taskId', controller.getTask);
router.post('/tasks/:taskId/subtasks', controller.createSubtask);
router.patch('/tasks/:taskId', controller.updateTask);
router.patch('/tasks/:taskId/status', controller.updateTaskStatus);
router.post('/tasks/:taskId/comments', controller.createComment);

export default router;
