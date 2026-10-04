import { Router } from 'express';
import { RefuelController } from '../controllers/refuelController';

const router = Router();

router.get('/vehicle/:vehicleId', RefuelController.listByVehicle);
router.post('/', RefuelController.create);
router.post('/scan-ocr', RefuelController.scanReceipt);

export default router;
