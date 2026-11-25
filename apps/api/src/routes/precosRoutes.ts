import { Router } from 'express';
import { PrecosController } from '../controllers/precosController';

const router = Router();

// US17.5: Rota autenticada GET /api/v1/precos?municipio=&combustivel=
router.get('/', PrecosController.getPrecos as any);

// US17.4: Rota auxiliar autenticada GET /api/v1/precos/clima?municipio=
router.get('/clima', PrecosController.getClima as any);

export default router;
