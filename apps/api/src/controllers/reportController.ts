import { Request, Response } from 'express';
import { z } from 'zod';
import { ReportService } from '../services/reportService';
import { generateExpensesCsv, generateMaintenancesCsv } from '../services/reportCsvGenerator';
import { generateExpensesPdfStream, generateMaintenancesPdfStream } from '../services/reportPdfGenerator';

const reportQuerySchema = z
  .object({
    veiculo_id: z.string().min(1, 'veiculo_id é obrigatório'),
    de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data "de" deve estar no formato AAAA-MM-DD'),
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data "ate" deve estar no formato AAAA-MM-DD'),
    formato: z.enum(['pdf', 'csv'], {
      message: 'Formato deve ser "pdf" ou "csv"',
    }),
  })
  .refine(
    data => {
      const deDate = new Date(data.de);
      const ateDate = new Date(data.ate);
      return deDate.getTime() <= ateDate.getTime();
    },
    {
      message: 'A data inicial (de) não pode ser posterior à data final (ate)',
      path: ['de'],
    }
  )
  .refine(
    data => {
      const deDate = new Date(data.de).getTime();
      const ateDate = new Date(data.ate).getTime();
      const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
      return ateDate - deDate <= fiveYearsMs;
    },
    {
      message: 'O intervalo máximo permitido para relatórios é de 5 anos',
      path: ['ate'],
    }
  );

export class ReportController {
  /**
   * US19.2: GET /api/v1/relatorios/gastos
   */
  static async getExpensesReport(req: Request, res: Response): Promise<void> {
    const parseResult = reportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { veiculo_id, de, ate, formato } = parseResult.data;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const data = await ReportService.getExpensesReportData(userId, veiculo_id, de, ate);

      if (formato === 'csv') {
        const csvContent = generateExpensesCsv(data);
        const filename = `gastos_${data.vehicle.plate || 'veiculo'}_${de}_${ate}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
        return;
      }

      if (formato === 'pdf') {
        const filename = `gastos_${data.vehicle.plate || 'veiculo'}_${de}_${ate}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const pdfStream = generateExpensesPdfStream(data);
        pdfStream.pipe(res);
        return;
      }
    } catch (err: any) {
      if (err.message === 'VEHICLE_NOT_FOUND_OR_FORBIDDEN') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Veículo não encontrado ou acesso não autorizado.' });
        return;
      }
      console.error('Erro ao gerar relatório de gastos:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Falha ao processar relatório.' });
    }
  }

  /**
   * US19.2: GET /api/v1/relatorios/manutencoes
   */
  static async getMaintenancesReport(req: Request, res: Response): Promise<void> {
    const parseResult = reportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { veiculo_id, de, ate, formato } = parseResult.data;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const data = await ReportService.getMaintenancesReportData(userId, veiculo_id, de, ate);

      if (formato === 'csv') {
        const csvContent = generateMaintenancesCsv(data);
        const filename = `manutencoes_${data.vehicle.plate || 'veiculo'}_${de}_${ate}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
        return;
      }

      if (formato === 'pdf') {
        const filename = `manutencoes_${data.vehicle.plate || 'veiculo'}_${de}_${ate}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const pdfStream = generateMaintenancesPdfStream(data);
        pdfStream.pipe(res);
        return;
      }
    } catch (err: any) {
      if (err.message === 'VEHICLE_NOT_FOUND_OR_FORBIDDEN') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Veículo não encontrado ou acesso não autorizado.' });
        return;
      }
      console.error('Erro ao gerar relatório de manutenções:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Falha ao processar relatório.' });
    }
  }
}
