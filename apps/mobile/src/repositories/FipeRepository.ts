import { db } from '../database/DatabaseConnection';
import { FipeConsultation, CreateFipeConsultationDTO } from '@autogest/shared-types';

export class FipeRepository {
  private static readonly TABLE = 'consultas_fipe';

  private static mapFromRow(row: any): FipeConsultation {
    return {
      id: row.id,
      vehicleId: row.veiculo_id || row.vehicleId,
      veiculo_id: row.veiculo_id || row.vehicleId,
      fipeCode: row.codigo_fipe || row.fipeCode,
      codigo_fipe: row.codigo_fipe || row.fipeCode,
      brand: row.marca || row.brand,
      marca: row.marca || row.brand,
      model: row.modelo || row.model,
      modelo: row.modelo || row.model,
      modelYear: Number(row.ano_modelo ?? row.modelYear ?? 0),
      ano_modelo: Number(row.ano_modelo ?? row.modelYear ?? 0),
      fuel: row.combustivel || row.fuel,
      combustivel: row.combustivel || row.fuel,
      referenceMonth: row.mes_referencia || row.referenceMonth,
      mes_referencia: row.mes_referencia || row.referenceMonth,
      valueCentavos: Number(row.valor_centavos ?? row.valueCentavos ?? 0),
      valor_centavos: Number(row.valor_centavos ?? row.valueCentavos ?? 0),
      consultedAt: row.consultado_em || row.consultedAt || row.criado_em,
      consultado_em: row.consultado_em || row.consultedAt || row.criado_em,
      createdAt: row.criado_em || row.createdAt,
      criado_em: row.criado_em || row.createdAt,
      updatedAt: row.atualizado_em || row.updatedAt,
      atualizado_em: row.atualizado_em || row.updatedAt,
      deletedAt: row.excluido_em || row.deletedAt || null,
      excluido_em: row.excluido_em || row.deletedAt || null,
    };
  }

  /**
   * Lista todas as consultas de um veículo ordenadas cronologicamente
   */
  static async listByVehicle(vehicleId: string): Promise<FipeConsultation[]> {
    const rows = await db.getTableData<any>(this.TABLE);
    return rows
      .filter(
        r =>
          (r.veiculo_id === vehicleId || r.vehicleId === vehicleId) &&
          !r.deletedAt &&
          !r.excluido_em
      )
      .map(this.mapFromRow)
      .sort((a, b) => (a.referenceMonth || '').localeCompare(b.referenceMonth || ''));
  }

  /**
   * Busca a última consulta salva de um veículo (fallback offline)
   */
  static async findLatestByVehicle(vehicleId: string): Promise<FipeConsultation | null> {
    const list = await this.listByVehicle(vehicleId);
    if (list.length === 0) return null;
    return list[list.length - 1];
  }

  /**
   * Busca consulta de um veículo para um mês de referência específico (idempotência US18.6)
   */
  static async findByVehicleAndMonth(
    vehicleId: string,
    referenceMonth: string
  ): Promise<FipeConsultation | null> {
    const list = await this.listByVehicle(vehicleId);
    return list.find(r => r.referenceMonth === referenceMonth) || null;
  }

  /**
   * Salva ou atualiza a consulta FIPE (garante 1 por mês de referência por veículo)
   */
  static async saveConsultation(dto: CreateFipeConsultationDTO): Promise<FipeConsultation> {
    const now = new Date().toISOString();
    const existing = await this.findByVehicleAndMonth(dto.vehicleId, dto.referenceMonth);

    if (existing) {
      // Atualiza a consulta do mesmo mês se o valor tiver mudado
      const updated = {
        ...existing,
        fipeCode: dto.fipeCode,
        codigo_fipe: dto.fipeCode,
        brand: dto.brand,
        marca: dto.brand,
        model: dto.model,
        modelo: dto.model,
        modelYear: dto.modelYear,
        ano_modelo: dto.modelYear,
        fuel: dto.fuel,
        combustivel: dto.fuel,
        valueCentavos: dto.valueCentavos,
        valor_centavos: dto.valueCentavos,
        consultedAt: dto.consultedAt || now,
        consultado_em: dto.consultedAt || now,
        updatedAt: now,
        atualizado_em: now,
      };

      await db.update(this.TABLE, existing.id, updated as any);
      return updated;
    }

    const id = `fipe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: FipeConsultation = {
      id,
      vehicleId: dto.vehicleId,
      veiculo_id: dto.vehicleId,
      fipeCode: dto.fipeCode,
      codigo_fipe: dto.fipeCode,
      brand: dto.brand,
      marca: dto.brand,
      model: dto.model,
      modelo: dto.model,
      modelYear: dto.modelYear,
      ano_modelo: dto.modelYear,
      fuel: dto.fuel,
      combustivel: dto.fuel,
      referenceMonth: dto.referenceMonth,
      mes_referencia: dto.referenceMonth,
      valueCentavos: dto.valueCentavos,
      valor_centavos: dto.valueCentavos,
      consultedAt: dto.consultedAt || now,
      consultado_em: dto.consultedAt || now,
      createdAt: now,
      criado_em: now,
      updatedAt: now,
      atualizado_em: now,
      deletedAt: null,
      excluido_em: null,
    };

    await db.insert(this.TABLE, newRecord as any);
    return newRecord;
  }
}
