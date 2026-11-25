import { Router } from 'express';
import { ShareController } from '../controllers/shareController';
import { MonthlySummaryController } from '../controllers/monthlySummaryController';

export const authenticatedShareRouter = Router();
authenticatedShareRouter.post('/:id/compartilhamentos', ShareController.createShare as any);
authenticatedShareRouter.get('/:id/compartilhamentos', ShareController.listShares as any);
authenticatedShareRouter.delete('/:id/compartilhamentos', ShareController.revokeShare as any);
authenticatedShareRouter.delete(
  '/:id/compartilhamentos/:compartilhamentoId',
  ShareController.revokeShare as any,
);

export const publicProfileRouter = Router();
// US20.3: Endpoint sem autenticação com rate limit próprio
publicProfileRouter.get('/perfil/:token', ShareController.getPublicProfile as any);
// US37.4: Link de cancelamento do resumo mensal por e-mail
publicProfileRouter.get('/resumo/cancelar/:token', MonthlySummaryController.cancelarPorLink as any);
