import { Router } from 'express';
import { RefuelController } from '../controllers/refuelController';

const router = Router();

router.get('/vehicle/:vehicleId', RefuelController.listByVehicle);
router.get('/:id', RefuelController.getById);
router.post('/', RefuelController.create);
router.put('/:id', RefuelController.update);
router.delete('/:id', RefuelController.delete);
router.post('/scan-ocr', RefuelController.scanReceipt);

export default router;
