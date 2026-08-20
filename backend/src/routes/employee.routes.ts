import { Router } from 'express';
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
} from '../controllers/employee.controller';
import { authenticate, requireRoles } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

router.get('/', listEmployees);
router.get('/:id', getEmployeeById);
router.post('/', requireRoles(Role.BOSS, Role.CONTROLLER), createEmployee);
router.put('/:id', requireRoles(Role.BOSS, Role.CONTROLLER), updateEmployee);
router.post('/:id/reset-password', requireRoles(Role.BOSS, Role.CONTROLLER), resetEmployeePassword);

export default router;
