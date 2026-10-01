import { Router } from 'express';
import authRoutes from './authRoutes';
import vehicleRoutes from './vehicleRoutes';
import refuelRoutes from './refuelRoutes';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use('/auth', authRoutes);
router.get('/me', authMiddleware as any, AuthController.getMe as any);
router.use('/vehicles', vehicleRoutes);
router.use('/refuels', refuelRoutes);

export default router;
