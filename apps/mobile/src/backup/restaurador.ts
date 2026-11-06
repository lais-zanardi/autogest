import { BackupPayload } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { SyncOperationType, SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { DashboardIndicatorsService } from '../services/dashboardIndicators';
import { MaintenanceAlertService } from '../services/maintenanceAlertService';
import { useAppStore } from '../store/useAppStore';
import {
  AGBAK_FORMAT_VERSION,
  AGBAK_HEADER_BYTES,
  AGBAK_KDF_ID_PBKDF2_SHA256,
  AGBAK_MAGIC,
  AGBAK_NONCE_BYTES,
  AGBAK_SALT_BYTES,
  AGBAK_TAG_BYTES,
  decryptAes256GcmWithAad,
  deriveKeyPbkdf2Sha256,
} from '../services/cryptoSpike';
import { BACKUP_SCHEMA_VERSION, CabecalhoAgbak } from './formato';

export const AGBAK_MAX_PBKDF2_ITERATIONS = 10_000_000;

export type CodigoErroRestauracao =
  | 'ARQUIVO_INVALIDO'
  | 'VERSAO_NAO_SUPORTADA'
  | 'SENHA_OU_ARQUIVO_CORROMPIDO'
  | 'PAYLOAD_INVALIDO'
  | 'USUARIO_DIVERGENTE'
  | 'FALHA_TRANSACIONAL';

export class ErroRestauracaoBackup extends Error {
  public readonly codigo: CodigoErroRestauracao;

  constructor(codigo: CodigoErroRestauracao, mensagem: string) {
    super(mensagem);
    this.name = 'ErroRestauracaoBackup';
    this.codigo = codigo;
  }
}

export interface ResumoRestauracaoBackup {
  geradoEm: string;
  usuarioId: string;
  versaoSchema: number;
  totalRegistros: number;
  contagemPorEntidade: Record<string, number>;
}

export interface ResultadoInspecaoBackup {
  cabecalho: CabecalhoAgbak;
  payload: BackupPayload;
  resumo: ResumoRestauracaoBackup;
}

export interface ResultadoAplicacaoRestauracao {
  resumo: ResumoRestauracaoBackup;
  inseridos: number;
  atualizados: number;
  ignoradosPorVersaoLocalMaisRecente: number;
  enfileiradosNoSync: number;
}

const ENTITY_SYNC_OPERATION_MAP: Record<
  string,
  { createOp: SyncOperationType; updateOp: SyncOperationType }
> = {
  veiculos: { createOp: 'CREATE_VEHICLE', updateOp: 'UPDATE_VEHICLE' },
  abastecimentos: { createOp: 'CREATE_REFUEL', updateOp: 'UPDATE_REFUEL' },
  leituras_hodometro: { createOp: 'CREATE_ODOMETER_READING', updateOp: 'UPDATE_ODOMETER' },
  despesas: { createOp: 'CREATE_EXPENSE', updateOp: 'UPDATE_EXPENSE' },
  manutencoes: { createOp: 'CREATE_MAINTENANCE', updateOp: 'UPDATE_MAINTENANCE' },
  anexos: { createOp: 'CREATE_ATTACHMENT', updateOp: 'UPDATE_ATTACHMENT' },
  regras_manutencao: { createOp: 'CREATE_MAINTENANCE_RULE', updateOp: 'UPDATE_MAINTENANCE_RULE' },
  custos_fixos: { createOp: 'CREATE_FIXED_COST', updateOp: 'UPDATE_FIXED_COST' },
  registros_pneu: { createOp: 'CREATE_TIRE_RECORD', updateOp: 'UPDATE_TIRE_RECORD' },
  registros_fluido: { createOp: 'CREATE_FLUID_RECORD', updateOp: 'UPDATE_FLUID_RECORD' },
  auditoria: { createOp: 'CREATE_AUDIT_LOG', updateOp: 'CREATE_AUDIT_LOG' },
  orcamentos: { createOp: 'CREATE_BUDGET', updateOp: 'UPDATE_BUDGET' },
};

/**
 * US38.2: Valida magic, versão suportada e tamanhos do arquivo `.agbak` antes de tentar decifrar,
 * produzindo mensagens distintas para arquivo inválido e versão não suportada.
 */
export function validarCabecalhoETamanhosAgbak(arquivoBytes: Uint8Array): {
  cabecalho: CabecalhoAgbak;
  cabecalhoBytes: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
} {
  if (!arquivoBytes || !(arquivoBytes instanceof Uint8Array)) {
    throw new ErroRestauracaoBackup(
      'ARQUIVO_INVALIDO',
      'Arquivo inválido: nenhum conteúdo binário .agbak foi fornecido.',
    );
  }

  // Tamanho mínimo: 39 B cabeçalho + ao menos 2 B ciphertext ("{}") + 16 B tag GCM = 57 bytes
  if (arquivoBytes.length < AGBAK_HEADER_BYTES + AGBAK_TAG_BYTES + 2) {
    throw new ErroRestauracaoBackup(
      'ARQUIVO_INVALIDO',
      'Arquivo inválido: tamanho insuficiente ou arquivo .agbak truncado.',
    );
  }

  let magic = '';
  for (let i = 0; i < 5; i += 1) {
    magic += String.fromCharCode(arquivoBytes[i]);
  }

  if (magic !== AGBAK_MAGIC) {
    throw new ErroRestauracaoBackup(
      'ARQUIVO_INVALIDO',
      'Arquivo inválido: cabeçalho não corresponde ao formato .agbak (magic AGBAK ausente).',
    );
  }

  const versaoFormato = arquivoBytes[5];
  if (versaoFormato !== AGBAK_FORMAT_VERSION) {
    throw new ErroRestauracaoBackup(
      'VERSAO_NAO_SUPORTADA',
      `Versão do arquivo .agbak (${versaoFormato}) não suportada por esta versão do aplicativo.`,
    );
  }

  const kdfId = arquivoBytes[6];
  if (kdfId !== AGBAK_KDF_ID_PBKDF2_SHA256) {
    throw new ErroRestauracaoBackup(
      'ARQUIVO_INVALIDO',
      `Arquivo inválido: algoritmo KDF (${kdfId}) desconhecido.`,
    );
  }

  const iteracoes =
    ((arquivoBytes[7] << 24) |
      (arquivoBytes[8] << 16) |
      (arquivoBytes[9] << 8) |
      arquivoBytes[10]) >>>
    0;

  if (iteracoes <= 0 || iteracoes > AGBAK_MAX_PBKDF2_ITERATIONS) {
    throw new ErroRestauracaoBackup(
      'ARQUIVO_INVALIDO',
      'Arquivo inválido: parâmetro de iterações do KDF fora dos limites válidos.',
    );
  }

  const salt = arquivoBytes.slice(11, 11 + AGBAK_SALT_BYTES);
  const nonce = arquivoBytes.slice(27, 27 + AGBAK_NONCE_BYTES);
  const cabecalhoBytes = arquivoBytes.slice(0, AGBAK_HEADER_BYTES);
  const tagStart = arquivoBytes.length - AGBAK_TAG_BYTES;
  const ciphertext = arquivoBytes.slice(AGBAK_HEADER_BYTES, tagStart);
  const tag = arquivoBytes.slice(tagStart);

  return {
    cabecalho: {
      magic,
      versaoFormato,
      kdfId,
      iteracoes,
      salt,
      nonce,
    },
    cabecalhoBytes,
    ciphertext,
    tag,
  };
}

/**
 * US38.3: Valida os campos obrigatórios e tipos de um registro individual por entidade em memória.
 */
function validarRegistroEntidadeEmMemoria(
  nomeEntidade: string,
  item: unknown,
  indice: number,
): void {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      `Payload inválido: o registro #${indice + 1} em "${nomeEntidade}" não é um objeto válido.`,
    );
  }

  const record = item as Record<string, unknown>;

  if (typeof record.id !== 'string' || !record.id.trim()) {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      `Payload inválido: o registro #${indice + 1} em "${nomeEntidade}" não possui um campo "id" válido.`,
    );
  }

  switch (nomeEntidade) {
    case 'veiculos': {
      const modelo = record.model ?? record.modelo;
      const placa = record.plate ?? record.placa;
      const ano = record.year ?? record.ano;
      if (
        typeof modelo !== 'string' ||
        !modelo.trim() ||
        typeof placa !== 'string' ||
        !placa.trim() ||
        typeof ano !== 'number' ||
        !Number.isFinite(ano)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: veículo "${record.id}" com campos obrigatórios (modelo, placa ou ano) ausentes ou inválidos.`,
        );
      }
      break;
    }
    case 'abastecimentos': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const km = record.odometer ?? record.km;
      const litros = record.liters ?? record.litros;
      const valorTotal = record.totalValue ?? record.valor_total;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof km !== 'number' ||
        !Number.isFinite(km) ||
        typeof litros !== 'number' ||
        !Number.isFinite(litros) ||
        typeof valorTotal !== 'number' ||
        !Number.isFinite(valorTotal)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: abastecimento "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'leituras_hodometro': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const km = record.odometer ?? record.km;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof km !== 'number' ||
        !Number.isFinite(km)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: leitura de hodômetro "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'despesas': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const valor = record.amount ?? record.valor;
      const categoria = record.category ?? record.categoria;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof valor !== 'number' ||
        !Number.isFinite(valor) ||
        typeof categoria !== 'string' ||
        !categoria.trim()
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: despesa "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'manutencoes': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const km = record.odometer ?? record.km;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof km !== 'number' ||
        !Number.isFinite(km)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: manutenção "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'anexos': {
      const entityType = record.entityType ?? record.entidade_tipo;
      const entityId = record.entityId ?? record.entidade_id;
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const hasTarget =
        (typeof entityType === 'string' &&
          entityType.trim().length > 0 &&
          typeof entityId === 'string' &&
          entityId.trim().length > 0) ||
        (typeof vehicleId === 'string' && vehicleId.trim().length > 0);
      if (!hasTarget) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: anexo "${record.id}" sem vínculo de entidade ou veículo válido.`,
        );
      }
      break;
    }
    case 'regras_manutencao': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const partOrService = record.partOrService ?? record.peca_servico ?? record.item;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        (partOrService !== undefined &&
          (typeof partOrService !== 'string' || !partOrService.trim()))
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: regra de manutenção "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'custos_fixos': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const valorMensal = record.monthlyAmount ?? record.valor_mensal;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof valorMensal !== 'number' ||
        !Number.isFinite(valorMensal)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: custo fixo "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'registros_pneu': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const km = record.odometer ?? record.km;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof km !== 'number' ||
        !Number.isFinite(km)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: registro de pneu "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'registros_fluido': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const km = record.odometer ?? record.km;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof km !== 'number' ||
        !Number.isFinite(km)
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: registro de fluido "${record.id}" com campos obrigatórios inválidos.`,
        );
      }
      break;
    }
    case 'auditoria': {
      if (
        typeof record.entidade !== 'string' ||
        !record.entidade.trim() ||
        typeof record.acao !== 'string' ||
        !record.acao.trim()
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: registro de auditoria "${record.id}" sem entidade ou ação válida.`,
        );
      }
      break;
    }
    case 'orcamentos': {
      const vehicleId = record.vehicleId ?? record.veiculo_id;
      const tetoMensal = record.teto_mensal ?? record.monthlyLimitCents;
      if (
        typeof vehicleId !== 'string' ||
        !vehicleId.trim() ||
        typeof tetoMensal !== 'number' ||
        !Number.isFinite(tetoMensal) ||
        tetoMensal <= 0
      ) {
        throw new ErroRestauracaoBackup(
          'PAYLOAD_INVALIDO',
          `Payload inválido: orçamento "${record.id}" com campos obrigatórios (veiculo_id ou teto_mensal) inválidos.`,
        );
      }
      break;
    }
    default:
      break;
  }
}

export function construirResumoRestauracao(payload: BackupPayload): ResumoRestauracaoBackup {
  const contagemPorEntidade: Record<string, number> = {};
  let totalRegistros = 0;
  for (const [entidade, lista] of Object.entries(payload.entidades)) {
    const qtd = Array.isArray(lista) ? lista.length : 0;
    contagemPorEntidade[entidade] = qtd;
    totalRegistros += qtd;
  }

  return {
    geradoEm: payload.gerado_em,
    usuarioId: payload.usuario_id,
    versaoSchema: payload.versao_schema,
    totalRegistros,
    contagemPorEntidade,
  };
}

/**
 * US38.3 & US38.6: Valida o JSON decifrado ou objeto em memória (versão do schema, tipos, campos obrigatórios
 * e titularidade do `usuario_id`) antes de tocar no banco de dados.
 */
export function validarPayloadBackupEmMemoria(
  entrada: string | unknown,
  usuarioAtualId?: string,
): BackupPayload {
  let parsed: unknown;
  if (typeof entrada === 'string') {
    try {
      parsed = JSON.parse(entrada);
    } catch {
      throw new ErroRestauracaoBackup(
        'PAYLOAD_INVALIDO',
        'Payload inválido: o conteúdo decifrado não é um JSON bem formado.',
      );
    }
  } else {
    parsed = entrada;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      'Payload inválido: estrutura raiz do backup corrompida.',
    );
  }

  const root = parsed as Record<string, unknown>;

  if (typeof root.versao_schema !== 'number') {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      'Payload inválido: campo obrigatório "versao_schema" ausente ou inválido.',
    );
  }

  if (root.versao_schema !== BACKUP_SCHEMA_VERSION) {
    throw new ErroRestauracaoBackup(
      'VERSAO_NAO_SUPORTADA',
      `Versão do schema de dados (${root.versao_schema}) não suportada por esta versão do aplicativo.`,
    );
  }

  if (typeof root.usuario_id !== 'string' || !root.usuario_id.trim()) {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      'Payload inválido: identificador de usuário ("usuario_id") ausente no backup.',
    );
  }

  if (
    typeof root.gerado_em !== 'string' ||
    !root.gerado_em.trim() ||
    Number.isNaN(new Date(root.gerado_em).getTime())
  ) {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      'Payload inválido: data de geração ("gerado_em") ausente ou inválida.',
    );
  }

  if (!root.entidades || typeof root.entidades !== 'object' || Array.isArray(root.entidades)) {
    throw new ErroRestauracaoBackup(
      'PAYLOAD_INVALIDO',
      'Payload inválido: mapa de "entidades" ausente ou em formato incorreto.',
    );
  }

  // US38.6 (Decisão #3 confirmada): Rejeitar backup de outro usuario_id com mensagem clara
  if (usuarioAtualId && usuarioAtualId.trim() && root.usuario_id.trim() !== usuarioAtualId.trim()) {
    throw new ErroRestauracaoBackup(
      'USUARIO_DIVERGENTE',
      `Este backup pertence a outro usuário (${root.usuario_id}) e não pode ser restaurado na conta atual (${usuarioAtualId}).`,
    );
  }

  for (const [nomeEntidade, registros] of Object.entries(
    root.entidades as Record<string, unknown>,
  )) {
    if (!Array.isArray(registros)) {
      throw new ErroRestauracaoBackup(
        'PAYLOAD_INVALIDO',
        `Payload inválido: a entidade "${nomeEntidade}" deve conter uma lista de registros.`,
      );
    }

    for (let i = 0; i < registros.length; i += 1) {
      validarRegistroEntidadeEmMemoria(nomeEntidade, registros[i], i);
    }
  }

  return root as unknown as BackupPayload;
}

/**
 * US38.2, US38.3, US38.4 & US38.6: Lê, decifra e valida um arquivo `.agbak` inteiramente em memória
 * (sem tocar no banco) e gera o resumo de confirmação com data do backup e quantidade por entidade.
 */
export function lerEValidarBackupAgbak(params: {
  arquivoBytes: Uint8Array;
  senha: string;
  usuarioAtualId?: string;
}): ResultadoInspecaoBackup {
  if (!params.senha || !params.senha.trim()) {
    throw new ErroRestauracaoBackup(
      'SENHA_OU_ARQUIVO_CORROMPIDO',
      'Informe a senha do backup para decifrar o arquivo.',
    );
  }

  const { cabecalho, cabecalhoBytes, ciphertext, tag } = validarCabecalhoETamanhosAgbak(
    params.arquivoBytes,
  );

  const key = deriveKeyPbkdf2Sha256(params.senha, cabecalho.salt, cabecalho.iteracoes);

  let jsonUtf8: string;
  try {
    try {
      jsonUtf8 = decryptAes256GcmWithAad({
        ciphertext,
        key,
        nonce: cabecalho.nonce,
        aadHeader: cabecalhoBytes,
        tag,
      });
    } catch {
      throw new ErroRestauracaoBackup(
        'SENHA_OU_ARQUIVO_CORROMPIDO',
        'Senha incorreta ou arquivo corrompido (falha na verificação de autenticidade AES-256-GCM).',
      );
    }
  } finally {
    key.fill(0);
  }

  const payload = validarPayloadBackupEmMemoria(jsonUtf8, params.usuarioAtualId);

  return {
    cabecalho,
    payload,
    resumo: construirResumoRestauracao(payload),
  };
}

function extrairTimestampAtualizacao(registro: Record<string, unknown>): number {
  const raw =
    registro?.atualizado_em ??
    registro?.updatedAt ??
    registro?.updated_at ??
    registro?.criado_em ??
    registro?.createdAt ??
    registro?.created_at ??
    registro?.data_hora ??
    0;
  const ts = new Date(raw as string | number).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * US38.5, US38.6 & US38.7: Aplica um payload de backup previamente validado por mesclagem em uma única
 * transação atômica: insere os registros ausentes e, nos existentes, vence o maior `atualizado_em`.
 * Qualquer falha desfaz tudo (rollback integral). Ao concluir, enfileira na outbox os registros inseridos
 * ou vencedores, recalcula indicadores, reavalia alertas e grava a auditoria de restauração.
 */
export async function aplicarRestauracaoBackup(params: {
  payload: BackupPayload;
  usuarioAtualId?: string;
  nomeArquivo?: string;
  simularFalhaTransacional?: boolean;
}): Promise<ResultadoAplicacaoRestauracao> {
  // Revalida o payload em memória e a titularidade do usuario_id antes de iniciar a transação
  const payloadValidado = validarPayloadBackupEmMemoria(params.payload, params.usuarioAtualId);

  const definitions = SyncEntityRegistry.getAll();
  const tabelasTransacao = [
    ...definitions.map(d => d.localTable),
    'local_manutencoes',
    'local_custos_fixos',
    'auditoria',
    'fila_sync',
    'sync_queue',
  ];

  let inseridos = 0;
  let atualizados = 0;
  let ignoradosPorVersaoLocalMaisRecente = 0;
  const itensParaEnfileirar: Array<{
    operation: SyncOperationType;
    endpoint: string;
    payload: Record<string, unknown>;
  }> = [];

  await db.runInTransaction(tabelasTransacao, async () => {
    await AuditRepository.runWithAuditSuspended(async () => {
      for (const def of definitions) {
        const incomingRows = payloadValidado.entidades[def.name];
        if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
          continue;
        }

        const currentRows = await db.getTableData<Record<string, unknown>>(def.localTable);
        const currentById = new Map<string, { index: number; item: Record<string, unknown> }>();
        for (let i = 0; i < currentRows.length; i += 1) {
          const item = currentRows[i];
          if (item && typeof item.id === 'string') {
            currentById.set(item.id, { index: i, item });
          }
        }

        const mergedRows = [...currentRows];
        const opMapping = ENTITY_SYNC_OPERATION_MAP[def.name] || {
          createOp: 'UPDATE_VEHICLE',
          updateOp: 'UPDATE_VEHICLE',
        };

        for (const rawIncoming of incomingRows) {
          const incoming = rawIncoming as Record<string, unknown>;
          const incomingId = String(incoming.id);
          const existingEntry = currentById.get(incomingId);

          if (!existingEntry) {
            mergedRows.push(incoming);
            currentById.set(incomingId, { index: mergedRows.length - 1, item: incoming });
            inseridos += 1;
            itensParaEnfileirar.push({
              operation: opMapping.createOp,
              endpoint: `${def.endpoint}/${incomingId}`,
              payload: incoming,
            });
          } else if (def.name === 'auditoria') {
            // Tabela auditoria é somente inserção (sem atualizado_em): duplicata é ignorada
            ignoradosPorVersaoLocalMaisRecente += 1;
          } else {
            const incomingTs = extrairTimestampAtualizacao(incoming);
            const localTs = extrairTimestampAtualizacao(existingEntry.item);

            // US38.5: Nos existentes, vence o maior atualizado_em
            if (incomingTs > localTs) {
              mergedRows[existingEntry.index] = incoming;
              existingEntry.item = incoming;
              atualizados += 1;
              itensParaEnfileirar.push({
                operation: opMapping.updateOp,
                endpoint: `${def.endpoint}/${incomingId}`,
                payload: incoming,
              });
            } else {
              ignoradosPorVersaoLocalMaisRecente += 1;
            }
          }
        }

        await db.saveTableData(def.localTable, mergedRows);
        if (def.localTable === 'manutencoes') {
          await db.saveTableData('local_manutencoes', mergedRows);
        } else if (def.localTable === 'custos_fixos') {
          await db.saveTableData('local_custos_fixos', mergedRows);
        }
      }

      if (params.simularFalhaTransacional) {
        throw new ErroRestauracaoBackup(
          'FALHA_TRANSACIONAL',
          'Falha transacional simulada durante a restauração do backup.',
        );
      }

      // US38.7: Enfileira na outbox todos os registros inseridos ou vencedores dentro da mesma transação
      for (const item of itensParaEnfileirar) {
        await SyncQueueRepository.enqueue(item.operation, item.endpoint, item.payload);
      }
    });
  });

  // US38.7: Pós-restauração — Recalcular consumo em cadeia, reavaliar alertas, atualizar store e indicadores
  const veiculosAtivos = await VehicleRepository.listAll();
  for (const veiculo of veiculosAtivos) {
    await RefuelRepository.recalculateAllForVehicle(veiculo.id);
    await MaintenanceAlertService.evaluateVehicleAlerts(veiculo.id, new Date(), false).catch(
      () => {},
    );
    await DashboardIndicatorsService.refreshForVehicle(veiculo.id).catch(() => {});
  }

  const veiculosAtualizados = await VehicleRepository.listAll();
  const store = useAppStore.getState();
  store.setVehicles(veiculosAtualizados);

  const activeVehicle = useAppStore.getState().selectedVehicle;
  if (activeVehicle) {
    await DashboardIndicatorsService.refreshForVehicle(activeVehicle.id).catch(() => {});
  }

  const resumo = construirResumoRestauracao(payloadValidado);

  // US38.7: Gravar auditoria de restauração
  await AuditRepository.recordMutation({
    usuario_id: params.usuarioAtualId || payloadValidado.usuario_id,
    entidade: 'backup',
    entidade_id: params.nomeArquivo || `backup-${payloadValidado.gerado_em}`,
    acao: 'restauracao_backup',
    antes: null,
    depois: {
      arquivo: params.nomeArquivo || 'backup.agbak',
      gerado_em: payloadValidado.gerado_em,
      inseridos,
      atualizados,
      ignorados: ignoradosPorVersaoLocalMaisRecente,
    },
  });

  return {
    resumo,
    inseridos,
    atualizados,
    ignoradosPorVersaoLocalMaisRecente,
    enfileiradosNoSync: itensParaEnfileirar.length,
  };
}

/**
 * Atalho completo que lê, decifra, valida em memória e aplica a restauração transacional.
 */
export async function restaurarBackupAgbakCompleto(params: {
  arquivoBytes: Uint8Array;
  senha: string;
  usuarioAtualId?: string;
  nomeArquivo?: string;
  simularFalhaTransacional?: boolean;
}): Promise<ResultadoAplicacaoRestauracao> {
  const inspecao = lerEValidarBackupAgbak({
    arquivoBytes: params.arquivoBytes,
    senha: params.senha,
    usuarioAtualId: params.usuarioAtualId,
  });

  return aplicarRestauracaoBackup({
    payload: inspecao.payload,
    usuarioAtualId: params.usuarioAtualId,
    nomeArquivo: params.nomeArquivo,
    simularFalhaTransacional: params.simularFalhaTransacional,
  });
}
