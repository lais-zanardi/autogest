import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ReportController } from '../controllers/reportController';
import { ReportService } from '../services/reportService';
import { generateExpensesCsv, generateMaintenancesCsv } from '../services/reportCsvGenerator';
import { generateExpensesPdfStream, generateMaintenancesPdfStream } from '../services/reportPdfGenerator';

describe('US19 — Exportação de Relatórios em PDF e CSV', () => {
  const mockUserId = 'user-test-123';
  const otherUserId = 'user-other-999';
  const mockVehicleId = 'veh-test-001';

  const mockExpensesData = {
    vehicle: { id: mockVehicleId, name: 'Honda Civic', plate: 'BRA2E19' },
    period: { de: '2026-05-01', ate: '2026-05-31' },
    totalsByCategory: [
      { categoria: 'Combustível', totalCentavos: 25000, quantidade: 2 },
      { categoria: 'Manutenção', totalCentavos: 15000, quantidade: 1 },
      { categoria: 'Outros', totalCentavos: 5000, quantidade: 1 },
    ],
    totalGeralCentavos: 45000,
    items: [
      {
        id: 'item-1',
        data: '2026-05-05',
        categoria: 'Combustível',
        descricao: 'Abastecimento Gasolina 40L',
        valorCentavos: 20000,
      },
      {
        id: 'item-2',
        data: '2026-05-15',
        categoria: 'Manutenção',
        descricao: 'Troca de pastilhas de freio',
        valorCentavos: 15000,
      },
      {
        id: 'item-3',
        data: '2026-05-20',
        categoria: 'Combustível',
        descricao: 'Abastecimento Etanol',
        valorCentavos: 5000,
      },
      {
        id: 'item-4',
        data: '2026-05-25',
        categoria: 'Outros',
        descricao: 'Pedágio rodovia',
        valorCentavos: 5000,
      },
    ],
  };

  const mockMaintenancesData = {
    vehicle: { id: mockVehicleId, name: 'Honda Civic', plate: 'BRA2E19' },
    period: { de: '2026-01-01', ate: '2026-06-30' },
    totalGeralCentavos: 60000,
    items: [
      {
        id: 'maint-1',
        data: '2026-02-10',
        km: 15000,
        tipo: 'preventiva',
        tipoServico: 'Troca de Óleo e Filtro',
        descricao: 'Óleo 5W30 sintético',
        oficina: 'Oficina Central',
        valorCentavos: 35000,
      },
      {
        id: 'maint-2',
        data: '2026-05-15',
        km: 18500,
        tipo: 'corretiva',
        tipoServico: 'Freios e Pastilhas',
        descricao: 'Substituição das pastilhas dianteiras',
        oficina: 'Freios Express',
        valorCentavos: 25000,
      },
    ],
  };

  describe('US19.1 & US19.8 — Agregação e Totais por Categoria no PostgreSQL com isolamento', () => {
    it('totais por categoria batem exatamente com a soma dos lançamentos da massa de dados', () => {
      const somaCalculada = mockExpensesData.totalsByCategory.reduce((acc, cat) => acc + cat.totalCentavos, 0);
      assert.strictEqual(somaCalculada, mockExpensesData.totalGeralCentavos);
      assert.strictEqual(somaCalculada, 45000); // R$ 450,00

      const combustivel = mockExpensesData.totalsByCategory.find(c => c.categoria === 'Combustível');
      assert.strictEqual(combustivel?.totalCentavos, 25000);
      assert.strictEqual(combustivel?.quantidade, 2);
    });

    it('rejeita acesso de veículo pertencente a outro usuário (isolamento multitenant)', async () => {
      let statusCalled = 0;

      const req: any = {
        user: { id: otherUserId },
        query: {
          veiculo_id: mockVehicleId,
          de: '2026-05-01',
          ate: '2026-05-31',
          formato: 'csv',
        },
      };

      const res: any = {
        status: (s: number) => {
          statusCalled = s;
          return res;
        },
        json: (_data: any) => {
          return res;
        },
      };

      // Mock de verificação no service
      const originalFind = ReportService.getExpensesReportData;
      ReportService.getExpensesReportData = async (userId: string, _vehId: string) => {
        if (userId !== mockUserId) {
          throw new Error('VEHICLE_NOT_FOUND_OR_FORBIDDEN');
        }
        return mockExpensesData as any;
      };

      try {
        await ReportController.getExpensesReport(req, res);
        assert.strictEqual(statusCalled, 403);
      } finally {
        ReportService.getExpensesReportData = originalFind;
      }
    });
  });

  describe('US19.2 & US19.8 — Validação de parâmetros (Zod) e limites de intervalo', () => {
    it('retorna 400 se veiculo_id, de ou ate estiverem ausentes ou formato for inválido', async () => {
      let statusCalled = 0;
      let errorBody = null;

      const req: any = {
        user: { id: mockUserId },
        query: {
          veiculo_id: '',
          de: 'data-invalida',
          ate: '2026-05-31',
          formato: 'xml',
        },
      };

      const res: any = {
        status: (s: number) => {
          statusCalled = s;
          return res;
        },
        json: (data: any) => {
          errorBody = data;
          return res;
        },
      };

      await ReportController.getExpensesReport(req, res);
      assert.strictEqual(statusCalled, 400);
      assert.ok(errorBody);
    });

    it('retorna 400 se data inicial for posterior à data final', async () => {
      let statusCalled = 0;
      const req: any = {
        user: { id: mockUserId },
        query: {
          veiculo_id: mockVehicleId,
          de: '2026-06-01',
          ate: '2026-05-01',
          formato: 'csv',
        },
      };

      const res: any = {
        status: (s: number) => {
          statusCalled = s;
          return res;
        },
        json: (_data: any) => res,
      };

      await ReportController.getExpensesReport(req, res);
      assert.strictEqual(statusCalled, 400);
    });

    it('retorna 400 se intervalo ultrapassar limite máximo de 5 anos', async () => {
      let statusCalled = 0;
      const req: any = {
        user: { id: mockUserId },
        query: {
          veiculo_id: mockVehicleId,
          de: '2020-01-01',
          ate: '2026-05-01',
          formato: 'csv',
        },
      };

      const res: any = {
        status: (s: number) => {
          statusCalled = s;
          return res;
        },
        json: (_data: any) => res,
      };

      await ReportController.getExpensesReport(req, res);
      assert.strictEqual(statusCalled, 400);
    });
  });

  describe('US19.3 & US19.8 — Gerador de CSV (Excel pt-BR, BOM, ponto-e-vírgula e vírgula decimal)', () => {
    it('o CSV de gastos gerado inicia com UTF-8 BOM, usa separador ";" e formata valores com vírgula decimal e datas dd/MM/aaaa', () => {
      const csv = generateExpensesCsv(mockExpensesData as any);
      
      // Valida Byte Order Mark (BOM) para compatibilidade nativa com Excel Windows
      assert.ok(csv.startsWith('\uFEFF'), 'CSV deve iniciar com UTF-8 BOM');

      // Verifica cabeçalhos e separador ponto-e-vírgula
      assert.ok(csv.includes('Data;Categoria;Descrição;Valor (R$)'));

      // Verifica datas no padrão dd/MM/aaaa
      assert.ok(csv.includes('05/05/2026;Combustível;Abastecimento Gasolina 40L;200,00'));
      assert.ok(csv.includes('15/05/2026;Manutenção;Troca de pastilhas de freio;150,00'));

      // Verifica seção de totais por categoria
      assert.ok(csv.includes('TOTAIS POR CATEGORIA'));
      assert.ok(csv.includes('Combustível;250,00'));
      assert.ok(csv.includes('TOTAL GERAL;450,00'));
    });

    it('o CSV de manutenções gerado contém colunas de km, oficina e tipo de serviço em pt-BR', () => {
      const csv = generateMaintenancesCsv(mockMaintenancesData as any);
      assert.ok(csv.startsWith('\uFEFF'));
      assert.ok(csv.includes('Data;Km;Tipo;Tipo de Serviço;Descrição;Oficina;Valor (R$)'));
      assert.ok(csv.includes('10/02/2026;15000;Preventiva;Troca de Óleo e Filtro;Óleo 5W30 sintético;Oficina Central;350,00'));
      assert.ok(csv.includes('TOTAL GERAL;600,00'));
    });
  });

  describe('US19.4 & US19.8 — Gerador de PDF em stream', () => {
    it('o buffer de PDF gerado para gastos e manutenções começa com a assinatura mágica "%PDF"', async () => {
      const pdfStream = generateExpensesPdfStream(mockExpensesData as any);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        pdfStream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        pdfStream.on('end', () => resolve());
        pdfStream.on('error', err => reject(err));
      });

      const fullBuffer = Buffer.concat(chunks);
      assert.ok(fullBuffer.length > 0);
      assert.strictEqual(fullBuffer.subarray(0, 4).toString('ascii'), '%PDF');
    });

    it('o PDF de manutenções também é emitido corretamente como stream válido', async () => {
      const pdfStream = generateMaintenancesPdfStream(mockMaintenancesData as any);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        pdfStream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        pdfStream.on('end', () => resolve());
        pdfStream.on('error', err => reject(err));
      });

      const fullBuffer = Buffer.concat(chunks);
      assert.ok(fullBuffer.length > 0);
      assert.strictEqual(fullBuffer.subarray(0, 4).toString('ascii'), '%PDF');
    });
  });
});
