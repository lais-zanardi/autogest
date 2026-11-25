import { Router } from 'express';
import authRoutes from './authRoutes';
import vehicleRoutes from './vehicleRoutes';
import refuelRoutes from './refuelRoutes';
import odometerRoutes from './odometerRoutes';
import expenseRoutes from './expenseRoutes';
import syncRoutes from './syncRoutes';
import attachmentRoutes from './attachmentRoutes';
import reportRoutes from './reportRoutes';
import fipeRoutes from './fipeRoutes';
import precosRoutes from './precosRoutes';
import { authenticatedShareRouter, publicProfileRouter } from './shareRoutes';
import { AuthController } from '../controllers/authController';
import { PrecosController } from '../controllers/precosController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/publico', publicProfileRouter);
router.get('/me', authMiddleware as any, AuthController.getMe as any);
router.use('/vehicles', authMiddleware as any, vehicleRoutes);
router.use('/veiculos', authMiddleware as any, authenticatedShareRouter);
router.use('/refuels', authMiddleware as any, refuelRoutes);
router.use('/odometer', authMiddleware as any, odometerRoutes);
router.use('/expenses', authMiddleware as any, expenseRoutes);
router.use('/anexos', authMiddleware as any, attachmentRoutes);
router.use('/relatorios', authMiddleware as any, reportRoutes);
router.use('/fipe', authMiddleware as any, fipeRoutes);
router.use('/precos', authMiddleware as any, precosRoutes);
router.get('/clima', authMiddleware as any, PrecosController.getClima as any);
router.use('/sync', authMiddleware as any, syncRoutes);

export default router;
