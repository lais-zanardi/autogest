import { Router } from 'express';
import authRoutes from './authRoutes';
import vehicleRoutes from './vehicleRoutes';
import refuelRoutes from './refuelRoutes';
import odometerRoutes from './odometerRoutes';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use('/auth', authRoutes);
router.get('/me', authMiddleware as any, AuthController.getMe as any);
router.use('/vehicles', authMiddleware as any, vehicleRoutes);
router.use('/refuels', authMiddleware as any, refuelRoutes);
router.use('/odometer', authMiddleware as any, odometerRoutes);

export default router;
