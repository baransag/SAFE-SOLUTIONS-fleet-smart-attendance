import { Router } from 'express';
import { getAttendanceSummary, getFleetUtilization, exportCsv } from '../controllers/report.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRoles(Role.BOSS, Role.CONTROLLER, Role.MANAGER));

router.get('/attendance-summary', getAttendanceSummary);
router.get('/fleet-utilization', getFleetUtilization);
router.get('/export-csv', exportCsv);

export default router;
