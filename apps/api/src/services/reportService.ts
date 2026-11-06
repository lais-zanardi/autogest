import { query } from '../models/db';
import {
  ExpensesReportPayload,
  MaintenancesReportPayload,
  ExpenseReportItem,
  ExpenseCategoryTotal,
  MaintenanceReportItem,
} from './reportCsvGenerator';

export class ReportService {
  /**
   * Valida se o veículo pertence ao usuário solicitante (US19.1)
   */
  static async verifyVehicleOwnership(
    userId: string,
    vehicleId: string
  ): Promise<{ id: string; name: string; plate: string }> {
    const res = await query(
      `SELECT id, modelo as model, marca as brand, placa as plate, usuario_id
       FROM veiculos
       WHERE id = $1 AND excluido_em IS NULL`,
      [vehicleId]
    );

    if (res.rows.length === 0) {
      throw new Error('VEHICLE_NOT_FOUND_OR_FORBIDDEN');
    }

    const row = res.rows[0];
    if (row.usuario_id !== userId) {
      throw new Error('VEHICLE_NOT_FOUND_OR_FORBIDDEN');
    }

    return {
      id: row.id,
      name: `${row.brand || ''} ${row.model || ''}`.trim(),
      plate: row.plate || '',
    };
  }

  /**
   * Consulta agregada de despesas + abastecimentos consolidados (US19.1)
   */
  static async getExpensesReportData(
    userId: string,
    vehicleId: string,
    de: string,
    ate: string
  ): Promise<ExpensesReportPayload> {
    const vehicle = await this.verifyVehicleOwnership(userId, vehicleId);

    // Ajusta período para início e fim do dia com timezone
    const deTime = `${de}T00:00:00.000Z`;
    const ateTime = `${ate}T23:59:59.999Z`;

    // 1. Despesas manuais
    const despesasRes = await query(
      `SELECT id, categoria, valor, data_hora, descricao
       FROM despesas
       WHERE veiculo_id = $1
         AND data_hora >= $2
         AND data_hora <= $3
         AND excluido_em IS NULL
       ORDER BY data_hora ASC`,
      [vehicleId, deTime, ateTime]
    );

    // 2. Abastecimentos
    const abastecimentosRes = await query(
      `SELECT id, valor_total, data_hora, tipo_combustivel, posto
       FROM abastecimentos
       WHERE veiculo_id = $1
         AND data_hora >= $2
         AND data_hora <= $3
         AND excluido_em IS NULL
       ORDER BY data_hora ASC`,
      [vehicleId, deTime, ateTime]
    );

    // 3. Manutenções
    const manutencoesRes = await query(
      `SELECT id, valor, data, descricao, tipo_servico
       FROM manutencoes
       WHERE veiculo_id = $1
         AND data >= $2
         AND data <= $3
         AND excluido_em IS NULL
       ORDER BY data ASC`,
      [vehicleId, de, ate]
    );

    const items: ExpenseReportItem[] = [];

    for (const d of despesasRes.rows) {
      items.push({
        id: d.id,
        data: d.data_hora,
        categoria: d.categoria || 'Outros',
        descricao: d.descricao || 'Despesa avulsa',
        valorCentavos: Math.round(Number(d.valor) * 100),
      });
    }

    for (const a of abastecimentosRes.rows) {
      items.push({
        id: a.id,
        data: a.data_hora,
        categoria: 'Combustível',
        descricao: `Abastecimento ${a.tipo_combustivel || ''}${a.posto ? ` (${a.posto})` : ''}`.trim(),
        valorCentavos: Math.round(Number(a.valor_total) * 100),
      });
    }

    for (const m of manutencoesRes.rows) {
      items.push({
        id: m.id,
        data: m.data,
        categoria: 'Manutenção',
        descricao: `${m.tipo_servico || 'Serviço'}: ${m.descricao || ''}`.trim(),
        valorCentavos: Math.round(Number(m.valor) * 100),
      });
    }

    // Ordena todos cronologicamente
    items.sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
    );

    // Agrupa por categoria
    const categoryMap = new Map<string, { totalCentavos: number; quantidade: number }>();

    let totalGeralCentavos = 0;
    for (const item of items) {
      totalGeralCentavos += item.valorCentavos;
      const current = categoryMap.get(item.categoria) || { totalCentavos: 0, quantidade: 0 };
      current.totalCentavos += item.valorCentavos;
      current.quantidade += 1;
      categoryMap.set(item.categoria, current);
    }

    const totalsByCategory: ExpenseCategoryTotal[] = Array.from(categoryMap.entries()).map(
      ([categoria, data]) => ({
        categoria,
        totalCentavos: data.totalCentavos,
        quantidade: data.quantidade,
      })
    );

    return {
      vehicle,
      period: { de, ate },
      totalsByCategory,
      totalGeralCentavos,
      items,
    };
  }

  /**
   * Consulta agregada de histórico de manutenções (US19.1)
   */
  static async getMaintenancesReportData(
    userId: string,
    vehicleId: string,
    de: string,
    ate: string
  ): Promise<MaintenancesReportPayload> {
    const vehicle = await this.verifyVehicleOwnership(userId, vehicleId);

    const res = await query(
      `SELECT id, data, km, tipo, tipo_servico, descricao, oficina, valor
       FROM manutencoes
       WHERE veiculo_id = $1
         AND data >= $2
         AND data <= $3
         AND excluido_em IS NULL
       ORDER BY data ASC, km ASC`,
      [vehicleId, de, ate]
    );

    const items: MaintenanceReportItem[] = [];
    let totalGeralCentavos = 0;

    for (const r of res.rows) {
      const centavos = Math.round(Number(r.valor) * 100);
      totalGeralCentavos += centavos;
      items.push({
        id: r.id,
        data: r.data,
        km: Number(r.km || 0),
        tipo: r.tipo,
        tipoServico: r.tipo_servico,
        descricao: r.descricao,
        oficina: r.oficina,
        valorCentavos: centavos,
      });
    }

    return {
      vehicle,
      period: { de, ate },
      totalGeralCentavos,
      items,
    };
  }
}
