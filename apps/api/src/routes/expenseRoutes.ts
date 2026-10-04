import { Router } from 'express';
import { ExpenseController } from '../controllers/expenseController';

const router = Router();

router.post('/', ExpenseController.create as any);
router.get('/vehicle/:vehicleId', ExpenseController.listByVehicle as any);
router.get('/:id', ExpenseController.getById as any);
router.put('/:id', ExpenseController.update as any);
router.delete('/:id', ExpenseController.delete as any);

export default router;
