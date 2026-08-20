import { Router } from 'express';
import { listOffices, createOffice, listSites, createSite } from '../controllers/location.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/offices', listOffices);
router.post('/offices', requireRoles(Role.BOSS, Role.CONTROLLER), createOffice);

router.get('/sites', listSites);
router.post('/sites', requireRoles(Role.BOSS, Role.CONTROLLER), createSite);

export default router;
