import { Request, Response } from 'express';
import { FipeIntegrationService } from '../integracoes/fipe';

// Simple in-memory rate-limiter per user IP / User ID: 60 requests per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export class FipeController {
  /**
   * GET /api/v1/fipe/marcas
   */
  static async getMarcas(req: Request, res: Response): Promise<void> {
    const clientKey = (req as any).user?.id || req.ip || 'client';
    if (!checkRateLimit(`rl:marcas:${clientKey}`)) {
      res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Limite de requisições excedido. Aguarde um minuto.' });
      return;
    }

    try {
      const marcas = await FipeIntegrationService.listarMarcas();
      res.status(200).json(marcas);
    } catch (err: any) {
      console.error('Erro ao consultar marcas FIPE:', err);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Serviço da Tabela FIPE temporariamente indisponível. Tente novamente mais tarde.',
      });
    }
  }

  /**
   * GET /api/v1/fipe/marcas/:marca/modelos
   */
  static async getModelos(req: Request, res: Response): Promise<void> {
    const { marca } = req.params;
    const clientKey = (req as any).user?.id || req.ip || 'client';
    if (!checkRateLimit(`rl:modelos:${clientKey}`)) {
      res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Limite de requisições excedido.' });
      return;
    }

    if (!marca) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Código da marca é obrigatório.' });
      return;
    }

    try {
      const modelos = await FipeIntegrationService.listarModelos(marca);
      res.status(200).json(modelos);
    } catch (err: any) {
      console.error('Erro ao consultar modelos FIPE:', err);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Serviço da Tabela FIPE temporariamente indisponível. Tente novamente mais tarde.',
      });
    }
  }

  /**
   * GET /api/v1/fipe/marcas/:marca/modelos/:modelo/anos
   */
  static async getAnos(req: Request, res: Response): Promise<void> {
    const { marca, modelo } = req.params;
    const clientKey = (req as any).user?.id || req.ip || 'client';
    if (!checkRateLimit(`rl:anos:${clientKey}`)) {
      res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Limite de requisições excedido.' });
      return;
    }

    if (!marca || !modelo) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Código da marca e modelo são obrigatórios.' });
      return;
    }

    try {
      const anos = await FipeIntegrationService.listarAnos(marca, modelo);
      res.status(200).json(anos);
    } catch (err: any) {
      console.error('Erro ao consultar anos FIPE:', err);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Serviço da Tabela FIPE temporariamente indisponível. Tente novamente mais tarde.',
      });
    }
  }

  /**
   * GET /api/v1/fipe/valor?marca=...&modelo=...&ano=...
   */
  static async getValor(req: Request, res: Response): Promise<void> {
    const { marca, modelo, ano } = req.query as { marca?: string; modelo?: string; ano?: string };
    const clientKey = (req as any).user?.id || req.ip || 'client';
    if (!checkRateLimit(`rl:valor:${clientKey}`)) {
      res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Limite de requisições excedido.' });
      return;
    }

    if (!marca || !modelo || !ano) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Parâmetros "marca", "modelo" e "ano" são obrigatórios.',
      });
      return;
    }

    try {
      const cotacao = await FipeIntegrationService.consultarValor(marca, modelo, ano);
      res.status(200).json(cotacao);
    } catch (err: any) {
      console.error('Erro ao consultar valor FIPE:', err);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Serviço da Tabela FIPE temporariamente indisponível. Tente novamente mais tarde.',
      });
    }
  }
}
