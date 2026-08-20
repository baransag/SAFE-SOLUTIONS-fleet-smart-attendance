import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireRoles(Role.BOSS, Role.CONTROLLER));

router.get('/', listAuditLogs);

export default router;
