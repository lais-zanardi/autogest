import { Router } from 'express';
import { OdometerController } from '../controllers/odometerController';

const router = Router();

router.post('/', OdometerController.create);
router.get('/vehicle/:vehicleId', OdometerController.listByVehicle);

export default router;
