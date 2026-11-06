import { BackupPayload } from '@autogest/shared-types';
import {
  AGBAK_DEFAULT_PBKDF2_ITERATIONS,
  AGBAK_FORMAT_VERSION,
  AGBAK_HEADER_BYTES,
  AGBAK_KDF_ID_PBKDF2_SHA256,
  AGBAK_MAGIC,
  AGBAK_NONCE_BYTES,
  AGBAK_SALT_BYTES,
  AGBAK_TAG_BYTES,
  buildAgbakHeader,
} from '../services/cryptoSpike';

export const BACKUP_SCHEMA_VERSION = 1;

export interface CabecalhoAgbak {
  magic: string;
  versaoFormato: number;
  kdfId: number;
  iteracoes: number;
  salt: Uint8Array;
  nonce: Uint8Array;
}

export interface ArquivoAgbakDesempacotado {
  cabecalho: CabecalhoAgbak;
  cabecalhoBytes: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
}

/**
 * US21.1: Serializa o cabeçalho de 39 bytes do arquivo `.agbak` (versão 1).
 */
export function serializarCabecalhoAgbak(params: {
  versaoFormato?: number;
  kdfId?: number;
  iteracoes?: number;
  salt: Uint8Array;
  nonce: Uint8Array;
}): Uint8Array {
  return buildAgbakHeader({
    version: params.versaoFormato ?? AGBAK_FORMAT_VERSION,
    kdfId: params.kdfId ?? AGBAK_KDF_ID_PBKDF2_SHA256,
    iterations: params.iteracoes ?? AGBAK_DEFAULT_PBKDF2_ITERATIONS,
    salt: params.salt,
    nonce: params.nonce,
  });
}

/**
 * US21.1: Lê e valida os 39 bytes do cabeçalho `.agbak`.
 */
export function lerCabecalhoAgbak(bytes: Uint8Array): CabecalhoAgbak {
  if (!bytes || bytes.length < AGBAK_HEADER_BYTES) {
    throw new Error('Arquivo inválido: tamanho insuficiente para o cabeçalho .agbak.');
  }

  let magic = '';
  for (let i = 0; i < 5; i += 1) {
    magic += String.fromCharCode(bytes[i]);
  }

  if (magic !== AGBAK_MAGIC) {
    throw new Error('Arquivo inválido: assinatura mágica AGBAK não encontrada.');
  }

  const versaoFormato = bytes[5];
  if (versaoFormato !== AGBAK_FORMAT_VERSION) {
    throw new Error(`Versão do formato .agbak não suportada: ${versaoFormato}.`);
  }

  const kdfId = bytes[6];
  if (kdfId !== AGBAK_KDF_ID_PBKDF2_SHA256) {
    throw new Error(`Identificador de KDF não suportado: ${kdfId}.`);
  }

  const iteracoes = ((bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10]) >>> 0;
  if (iteracoes <= 0) {
    throw new Error('Cabeçalho .agbak inválido: número de iterações do KDF inválido.');
  }

  const salt = bytes.slice(11, 11 + AGBAK_SALT_BYTES);
  const nonce = bytes.slice(27, 27 + AGBAK_NONCE_BYTES);

  return {
    magic,
    versaoFormato,
    kdfId,
    iteracoes,
    salt,
    nonce,
  };
}

/**
 * US21.1: Empacota cabeçalho (39 B) + payload cifrado (N B) + tag GCM (16 B).
 */
export function empacotarArquivoAgbak(params: {
  cabecalhoBytes: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
}): Uint8Array {
  if (params.cabecalhoBytes.length !== AGBAK_HEADER_BYTES) {
    throw new Error('Cabeçalho .agbak deve ter exatamente 39 bytes.');
  }
  if (params.tag.length !== AGBAK_TAG_BYTES) {
    throw new Error('Tag GCM deve ter exatamente 16 bytes.');
  }

  const totalLength = params.cabecalhoBytes.length + params.ciphertext.length + params.tag.length;
  const out = new Uint8Array(totalLength);
  out.set(params.cabecalhoBytes, 0);
  out.set(params.ciphertext, AGBAK_HEADER_BYTES);
  out.set(params.tag, AGBAK_HEADER_BYTES + params.ciphertext.length);
  return out;
}

/**
 * US21.1: Separa e valida as seções binárias de um arquivo `.agbak` (cabeçalho, ciphertext e tag).
 */
export function desempacotarArquivoAgbak(arquivoBytes: Uint8Array): ArquivoAgbakDesempacotado {
  if (!arquivoBytes || arquivoBytes.length < AGBAK_HEADER_BYTES + AGBAK_TAG_BYTES + 2) {
    throw new Error('Arquivo .agbak inválido ou truncado.');
  }

  const cabecalhoBytes = arquivoBytes.slice(0, AGBAK_HEADER_BYTES);
  const cabecalho = lerCabecalhoAgbak(cabecalhoBytes);
  const tagStart = arquivoBytes.length - AGBAK_TAG_BYTES;
  const ciphertext = arquivoBytes.slice(AGBAK_HEADER_BYTES, tagStart);
  const tag = arquivoBytes.slice(tagStart);

  return {
    cabecalho,
    cabecalhoBytes,
    ciphertext,
    tag,
  };
}

/**
 * US21.1: Serializa o payload estruturado do backup em JSON UTF-8.
 */
export function serializarPayloadBackup(payload: BackupPayload): string {
  if (
    !payload ||
    typeof payload.versao_schema !== 'number' ||
    !payload.usuario_id ||
    !payload.gerado_em ||
    !payload.entidades ||
    typeof payload.entidades !== 'object'
  ) {
    throw new Error('Payload de backup inválido para serialização.');
  }

  return JSON.stringify({
    versao_schema: payload.versao_schema,
    usuario_id: payload.usuario_id,
    gerado_em: payload.gerado_em,
    entidades: payload.entidades,
  });
}

/**
 * US21.1: Lê e valida a estrutura de um payload JSON de backup decifrado.
 */
export function lerPayloadBackup(jsonTexto: string): BackupPayload {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonTexto);
  } catch {
    throw new Error('Payload do backup não é um JSON válido.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.versao_schema !== 'number' ||
    parsed.versao_schema !== BACKUP_SCHEMA_VERSION ||
    typeof parsed.usuario_id !== 'string' ||
    !parsed.usuario_id.trim() ||
    typeof parsed.gerado_em !== 'string' ||
    !parsed.entidades ||
    typeof parsed.entidades !== 'object' ||
    Array.isArray(parsed.entidades)
  ) {
    throw new Error('Estrutura do payload de backup inválida ou versão de schema incompatível.');
  }

  for (const [key, list] of Object.entries(parsed.entidades)) {
    if (!Array.isArray(list)) {
      throw new Error(`A entidade "${key}" no payload de backup deve ser uma lista.`);
    }
  }

  return parsed as BackupPayload;
}

/**
 * US21.4: Gera o nome padrão `autogest-AAAAMMDD-HHmm.agbak`.
 */
export function gerarNomeArquivoBackup(date: Date = new Date()): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `autogest-${yyyy}${mm}${dd}-${hh}${min}.agbak`;
}
