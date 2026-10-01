import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', AuthController.loginOrRegister);
router.get('/me', authMiddleware as any, AuthController.getMe as any);

export default router;
