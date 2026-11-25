import { Request, Response, NextFunction } from 'express';
import {
  MonthlySummaryRepository,
  PostgresMonthlySummaryRepository,
} from '../jobs/resumoMensalEmailJob';
import { hashTokenOpaco } from '../services/publicProfileDomain';

export class MonthlySummaryController {
  private static repo: MonthlySummaryRepository = new PostgresMonthlySummaryRepository();

  static setRepository(customRepo: MonthlySummaryRepository) {
    this.repo = customRepo;
  }

  /**
   * US37.4: GET /api/v1/publico/resumo/cancelar/:token
   * Desativa `receber_resumo` a partir do token opaco presente no link do e-mail.
   */
  static async cancelarPorLink(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) {
        return res.status(400).json({ error: 'Token de cancelamento inválido.' });
      }

      const tokenHash = hashTokenOpaco(token);
      const desativado = await MonthlySummaryController.repo.desativarPorTokenHash(tokenHash);
      if (!desativado) {
        return res.status(404).json({ error: 'Link de cancelamento inválido ou já utilizado.' });
      }

      return res.status(200).json({
        cancelado: true,
        mensagem: 'O envio do resumo mensal por e-mail foi desativado.',
      });
    } catch (error) {
      return next(error);
    }
  }
}
