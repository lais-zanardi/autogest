import crypto from 'crypto';
import {
  PublicVehicleMaintenanceItem,
  PublicVehicleProfileResponse,
} from '@autogest/shared-types';

/**
 * Decisão #7 (US20.2): Expiração padrão de 30 dias para links/QR Code compartilháveis.
 */
export const VALIDADE_PADRAO_COMPARTILHAMENTO_DIAS = 30;

/**
 * US20.4 / Decisão #8: Lista explícita (allowlist) de campos públicos.
 * Qualquer campo fora desta lista (localização, notas, anexos sensíveis, dados do usuário)
 * NUNCA é serializado na resposta pública.
 */
export const PUBLIC_VEHICLE_FIELDS = [
  'modelo',
  'marca',
  'ano',
  'placa',
  'combustivel_preferencial',
  'odometro_atual',
] as const;

export const PUBLIC_MAINTENANCE_FIELDS = [
  'data',
  'tipo',
  'tipo_servico',
  'descricao',
  'km',
] as const;

/**
 * US20.1: Gera token opaco criptograficamente seguro com 32 bytes aleatórios (base64url).
 */
export function gerarTokenOpacoSeguro(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * US20.1: Calcula hash SHA-256 hex do token opaco. Apenas este hash é salvo no banco.
 */
export function hashTokenOpaco(token: string): string {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * US20.4: Serializa estritamente os campos públicos permitidos do veículo e de seu histórico
 * de manutenções, descartando qualquer propriedade fora da allowlist.
 */
export function serializarPerfilPublicoVeiculo(
  veiculoRaw: Record<string, any>,
  manutencoesRaw: Array<Record<string, any>>,
  expiraEm: string,
): PublicVehicleProfileResponse {
  const manutencoes: PublicVehicleMaintenanceItem[] = (manutencoesRaw || [])
    .filter(m => m && !m.excluido_em && !m.deletedAt)
    .map(m => ({
      data: String(m.data || '').slice(0, 10),
      tipo: String(m.tipo || ''),
      tipo_servico: String(m.tipo_servico || m.serviceType || ''),
      descricao: String(m.descricao || m.description || ''),
      km: Number(m.km ?? m.odometer ?? 0),
    }))
    .sort((a, b) => b.data.localeCompare(a.data));

  return {
    veiculo: {
      modelo: String(veiculoRaw.modelo || veiculoRaw.model || ''),
      marca: veiculoRaw.marca || veiculoRaw.brand ? String(veiculoRaw.marca || veiculoRaw.brand) : null,
      ano: Number(veiculoRaw.ano ?? veiculoRaw.year ?? 0),
      placa: String(veiculoRaw.placa || veiculoRaw.plate || ''),
      combustivel_preferencial: String(
        veiculoRaw.combustivel_preferencial || veiculoRaw.preferredFuel || '',
      ),
      odometro_atual: Number(veiculoRaw.odometro_atual ?? veiculoRaw.currentOdometer ?? 0),
    },
    manutencoes,
    expira_em: expiraEm,
  };
}
