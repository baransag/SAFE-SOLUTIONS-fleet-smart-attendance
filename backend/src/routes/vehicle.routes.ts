import { Router } from 'express';
import {
  listVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  assignVehicle,
  unassignVehicle,
  getVehicleQr,
  resolveQr,
} from '../controllers/vehicle.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', listVehicles);
router.get('/resolve-qr/:qrCode', resolveQr);
router.get('/:id', getVehicleById);
router.get('/:id/qr', getVehicleQr);
router.post('/', requireRoles(Role.BOSS, Role.CONTROLLER), createVehicle);
router.put('/:id', requireRoles(Role.BOSS, Role.CONTROLLER), updateVehicle);
router.post('/:id/assign', requireRoles(Role.BOSS, Role.CONTROLLER), assignVehicle);
router.post('/:id/unassign', requireRoles(Role.BOSS, Role.CONTROLLER), unassignVehicle);

export default router;
