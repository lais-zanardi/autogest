import { Router } from 'express';
import { VehicleController } from '../controllers/vehicleController';

const router = Router();

router.get('/', VehicleController.listMine);
router.get('/user/:userId', VehicleController.listByUserId);
router.get('/:id', VehicleController.getById);
router.post('/', VehicleController.create);
router.put('/:id', VehicleController.update);
router.delete('/:id', VehicleController.delete);

export default router;
