import { Router } from 'express';
import {
  submitAttendance,
  getTodayAttendance,
  listAttendance,
  approveAttendance,
  rejectAttendance,
  getAttendanceEvidence,
} from '../controllers/attendance.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/today', getTodayAttendance);
router.get('/list', listAttendance);
router.get('/:id/evidence', getAttendanceEvidence);

router.post(
  '/submit',
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'selfiePhoto', maxCount: 1 },
    { name: 'meterPhoto', maxCount: 1 },
    { name: 'meter', maxCount: 1 },
    { name: 'sitePhoto', maxCount: 1 },
    { name: 'site', maxCount: 1 },
  ]),
  submitAttendance
);

router.post(
  '/:id/approve',
  requireRoles(Role.BOSS, Role.CONTROLLER, Role.MANAGER),
  approveAttendance
);

router.post(
  '/:id/reject',
  requireRoles(Role.BOSS, Role.CONTROLLER, Role.MANAGER),
  rejectAttendance
);

export default router;
