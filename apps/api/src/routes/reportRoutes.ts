import { Router } from 'express';
import { ReportController } from '../controllers/reportController';

const router = Router();

// US19.2: Rotas autenticadas de exportação de relatórios
router.get('/gastos', ReportController.getExpensesReport as any);
router.get('/manutencoes', ReportController.getMaintenancesReport as any);

export default router;
