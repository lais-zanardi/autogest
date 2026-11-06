import { BackupPayload } from '@autogest/shared-types';
import { db } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { AuditRepository } from '../repositories/AuditRepository';
import { BACKUP_SCHEMA_VERSION, gerarNomeArquivoBackup } from './formato';
import { cifrarBackupAgbak } from './cifra';

export interface ResultadoExportacaoPayload {
  payload: BackupPayload;
  anexosPendentesUpload: number;
  totalRegistros: number;
  contagemPorEntidade: Record<string, number>;
}

export interface ResultadoCriacaoBackupLocal {
  nomeArquivo: string;
  caminhoCompleto: string;
  arquivoBytes: Uint8Array;
  anexosPendentesUpload: number;
  totalRegistros: number;
  contagemPorEntidade: Record<string, number>;
  geradoEm: string;
}

// Armazenamento em memória dos arquivos de backup gravados localmente (para inspeção e testes sem FS nativo)
const localSavedBackups = new Map<string, Uint8Array>();

/**
 * Conta quantos anexos ativos ainda estão pendentes de envio ao Google Cloud Storage.
 */
export async function contarAnexosPendentesUpload(): Promise<number> {
  const anexos = await db.getTableData<any>('anexos');
  let pendentes = 0;
  for (const item of anexos) {
    if (item.deletedAt || item.excluido_em) continue;
    const status = item.uploadStatus || item.status_upload;
    const gcsUrl = item.gcsUrl || item.url_gcs;
    if (status === 'pendente' || !gcsUrl) {
      pendentes += 1;
    }
  }
  return pendentes;
}

/**
 * US21.3: Exportador que percorre a lista central de entidades sincronizáveis (`SyncEntityRegistry`),
 * inclui as exclusões lógicas e gera o payload estruturado.
 * Anexos entram apenas como metadados (`url_gcs`), sem caminho local do dispositivo, e informa quantos
 * anexos ainda estão pendentes de upload.
 */
export async function gerarPayloadExportacao(
  usuarioId = 'local_user',
  geradoEmIso: string = new Date().toISOString(),
): Promise<ResultadoExportacaoPayload> {
  const definitions = SyncEntityRegistry.getAll();
  const entidades: Record<string, any[]> = {};
  const contagemPorEntidade: Record<string, number> = {};
  let totalRegistros = 0;
  let anexosPendentesUpload = 0;

  for (const def of definitions) {
    const rawRows = await db.getTableData<any>(def.localTable);

    if (def.name === 'anexos') {
      const sanitizedAttachments = rawRows.map(row => {
        const isDeleted = !!(row.deletedAt || row.excluido_em);
        const status = row.uploadStatus || row.status_upload || 'pendente';
        const urlGcs = row.gcsUrl || row.url_gcs || null;

        if (!isDeleted && (status === 'pendente' || !urlGcs)) {
          anexosPendentesUpload += 1;
        }

        // Remove localPath / arquivo_local (entra somente metadados e url_gcs conforme US21.3 / Decisão #2)
        const { localPath: _lp, arquivo_local: _al, ...rest } = row;
        return {
          ...rest,
          url_gcs: urlGcs,
          gcsUrl: urlGcs,
          arquivo_local: null,
          status_upload: status,
          uploadStatus: status,
        };
      });

      entidades[def.name] = sanitizedAttachments;
      contagemPorEntidade[def.name] = sanitizedAttachments.length;
      totalRegistros += sanitizedAttachments.length;
    } else {
      entidades[def.name] = [...rawRows];
      contagemPorEntidade[def.name] = rawRows.length;
      totalRegistros += rawRows.length;
    }
  }

  const payload: BackupPayload = {
    versao_schema: BACKUP_SCHEMA_VERSION,
    usuario_id: usuarioId || 'local_user',
    gerado_em: geradoEmIso,
    entidades,
  };

  return {
    payload,
    anexosPendentesUpload,
    totalRegistros,
    contagemPorEntidade,
  };
}

/**
 * US21.3, US21.4 & US21.6: Cria um arquivo `.agbak` cifrado, registra o evento de geração na trilha de auditoria
 * e grava no diretório escolhido.
 */
export async function criarBackupLocal(params: {
  usuarioId?: string;
  senha: string;
  diretorioDestino?: string;
  dataReferencia?: Date;
  iteracoesKdf?: number;
}): Promise<ResultadoCriacaoBackupLocal> {
  const usuarioId = params.usuarioId || 'local_user';
  const dataRef = params.dataReferencia || new Date();
  const geradoEm = dataRef.toISOString();
  const nomeArquivo = gerarNomeArquivoBackup(dataRef);
  const diretorio = (params.diretorioDestino || '/storage/emulated/0/Download/AutoGest').replace(
    /\/+$/,
    '',
  );
  const caminhoCompleto = `${diretorio}/${nomeArquivo}`;

  // Registra na trilha de auditoria antes de exportar para que o próprio evento conste no histórico
  await AuditRepository.recordMutation({
    usuario_id: usuarioId,
    entidade: 'backup',
    entidade_id: nomeArquivo,
    acao: 'geracao_backup',
    antes: null,
    depois: {
      arquivo: nomeArquivo,
      diretorio,
      gerado_em: geradoEm,
    },
  });

  const exportacao = await gerarPayloadExportacao(usuarioId, geradoEm);
  const arquivoBytes = cifrarBackupAgbak(exportacao.payload, params.senha, {
    iteracoes: params.iteracoesKdf,
  });

  localSavedBackups.set(caminhoCompleto, arquivoBytes);

  return {
    nomeArquivo,
    caminhoCompleto,
    arquivoBytes,
    anexosPendentesUpload: exportacao.anexosPendentesUpload,
    totalRegistros: exportacao.totalRegistros,
    contagemPorEntidade: exportacao.contagemPorEntidade,
    geradoEm,
  };
}

export function obterBackupLocalSalvo(caminhoCompleto: string): Uint8Array | undefined {
  return localSavedBackups.get(caminhoCompleto);
}

export function registrarBackupLocalSalvo(caminhoCompleto: string, arquivoBytes: Uint8Array): void {
  localSavedBackups.set(caminhoCompleto, arquivoBytes);
}

export function listarBackupsLocaisSalvos(): Array<{
  caminhoCompleto: string;
  nomeArquivo: string;
  tamanhoBytes: number;
}> {
  const result: Array<{
    caminhoCompleto: string;
    nomeArquivo: string;
    tamanhoBytes: number;
  }> = [];

  for (const [caminhoCompleto, bytes] of localSavedBackups.entries()) {
    const parts = caminhoCompleto.split('/');
    const nomeArquivo = parts[parts.length - 1] || caminhoCompleto;
    result.push({
      caminhoCompleto,
      nomeArquivo,
      tamanhoBytes: bytes.length,
    });
  }

  return result.reverse();
}
