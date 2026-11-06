import { Router } from 'express';
import { FipeController } from '../controllers/fipeController';

const router = Router();

// US18.3: Rotas autenticadas da Tabela FIPE
router.get('/marcas', FipeController.getMarcas as any);
router.get('/marcas/:marca/modelos', FipeController.getModelos as any);
router.get('/marcas/:marca/modelos/:modelo/anos', FipeController.getAnos as any);
router.get('/valor', FipeController.getValor as any);

export default router;
