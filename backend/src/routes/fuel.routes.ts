import { Router } from 'express';
import { listFuelRecords, createFuelRecord, getMileageAnalytics } from '../controllers/fuel.controller';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', listFuelRecords);
router.get('/mileage-analytics', getMileageAnalytics);
router.post(
  '/',
  upload.single('receiptPhoto'),
  createFuelRecord
);

export default router;
