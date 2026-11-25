import { SimulationRecord, SimulationType } from '@autogest/shared-types';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { RegionalPricesService } from './regionalPricesService';
import { PreferencesService } from './preferencesService';

export const SIMULACOES_TABLE = 'simulacoes';

function generateId(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * US16.4 & US16.6: Serviço de persistência de simulações e leitura de preços padrão do cache US17.
 */
export class SimulatorService {
  static async obterPrecosPadrao(municipio?: string): Promise<{
    gasolinaCentavos: number | null;
    etanolCentavos: number | null;
    municipio: string;
  }> {
    const cidade = (municipio || (await PreferencesService.obterMunicipioPadrao())).trim();
    const [gas, eta] = await Promise.all([
      RegionalPricesService.obterUltimaColetaLocal(cidade, 'Gasolina'),
      RegionalPricesService.obterUltimaColetaLocal(cidade, 'Etanol'),
    ]);

    return {
      gasolinaCentavos: gas.maisRecente?.preco_centavos ?? null,
      etanolCentavos: eta.maisRecente?.preco_centavos ?? null,
      municipio: cidade,
    };
  }

  static async salvarSimulacao(
    tipo: SimulationType,
    entradas: Record<string, any>,
    resultado: Record<string, any>,
  ): Promise<SimulationRecord> {
    const db = DatabaseConnection.getInstance();
    const now = new Date().toISOString();
    const record: SimulationRecord = {
      id: generateId(),
      tipo,
      entradas,
      resultado,
      criado_em: now,
      atualizado_em: now,
      excluido_em: null,
    };

    await db.insert(SIMULACOES_TABLE, record);
    await SyncQueueRepository.enqueue('CREATE_SIMULATION', '/api/v1/sync/simulacoes', record).catch(
      () => {},
    );
    return record;
  }

  static async listarUltimas(limite: number = 10): Promise<SimulationRecord[]> {
    const db = DatabaseConnection.getInstance();
    const rows = (await db.getTableData<SimulationRecord>(SIMULACOES_TABLE)) || [];
    return rows
      .filter(r => !r.excluido_em)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .slice(0, limite);
  }
}
