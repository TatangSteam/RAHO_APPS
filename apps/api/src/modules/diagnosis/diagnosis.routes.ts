import { Router } from 'express';
import { DiagnosisController } from './diagnosis.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();
const controller = new DiagnosisController();

const ALLSTAFF = [
  Role.ADMIN_LAYANAN,
  Role.ADMIN_CABANG,
  Role.ADMIN_MANAGER,
  Role.SUPER_ADMIN,
  Role.DOCTOR,
  Role.NURSE,
];

// GET /api/v1/diagnosis/categories - Get diagnosis categories
router.get('/categories', authenticate, authorize(ALLSTAFF), controller.getCategories.bind(controller));

export default router;
