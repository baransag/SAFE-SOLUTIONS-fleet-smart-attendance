import { Router } from 'express';
import {
  listMaintenance,
  createMaintenance,
  updateMaintenance,
  getMaintenanceAlerts,
} from '../controllers/maintenance.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', listMaintenance);
router.get('/alerts', getMaintenanceAlerts);
router.post(
  '/',
  requireRoles(Role.BOSS, Role.CONTROLLER),
  upload.single('invoicePhoto'),
  createMaintenance
);
router.put('/:id', requireRoles(Role.BOSS, Role.CONTROLLER), updateMaintenance);

export default router;
