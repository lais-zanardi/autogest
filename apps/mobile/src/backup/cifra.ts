import { BackupPayload } from '@autogest/shared-types';
import {
  AGBAK_DEFAULT_PBKDF2_ITERATIONS,
  AGBAK_NONCE_BYTES,
  AGBAK_SALT_BYTES,
  decryptAes256GcmWithAad,
  deriveKeyPbkdf2Sha256,
  encryptAes256GcmWithAad,
  randomCryptoBytes,
} from '../services/cryptoSpike';
import {
  desempacotarArquivoAgbak,
  empacotarArquivoAgbak,
  lerPayloadBackup,
  serializarCabecalhoAgbak,
  serializarPayloadBackup,
} from './formato';

/**
 * US21.2: Deriva a chave a partir da senha (PBKDF2-HMAC-SHA256 com salt aleatório de 16 B)
 * e cifra o payload com AES-256-GCM (nonce aleatório de 12 B, cabeçalho como AAD).
 * A senha e a chave derivada nunca são persistidas e o buffer da chave é zerado após o uso.
 */
export function cifrarBackupAgbak(
  payload: BackupPayload,
  senha: string,
  opcoes?: {
    iteracoes?: number;
    salt?: Uint8Array;
    nonce?: Uint8Array;
  },
): Uint8Array {
  if (!senha || !senha.trim()) {
    throw new Error('A senha do backup é obrigatória.');
  }

  const iteracoes = opcoes?.iteracoes ?? AGBAK_DEFAULT_PBKDF2_ITERATIONS;
  const salt = opcoes?.salt ?? randomCryptoBytes(AGBAK_SALT_BYTES);
  const nonce = opcoes?.nonce ?? randomCryptoBytes(AGBAK_NONCE_BYTES);

  const cabecalhoBytes = serializarCabecalhoAgbak({
    iteracoes,
    salt,
    nonce,
  });

  const jsonUtf8 = serializarPayloadBackup(payload);
  const key = deriveKeyPbkdf2Sha256(senha, salt, iteracoes);

  try {
    const { ciphertext, tag } = encryptAes256GcmWithAad({
      plaintextUtf8: jsonUtf8,
      key,
      nonce,
      aadHeader: cabecalhoBytes,
    });

    return empacotarArquivoAgbak({
      cabecalhoBytes,
      ciphertext,
      tag,
    });
  } finally {
    // Limpa os bytes da chave em memória imediatamente após cifrar
    key.fill(0);
  }
}

/**
 * US21.2 & US38.2: Valida o cabeçalho, deriva a chave a partir da senha informada e decifra o arquivo `.agbak`
 * autenticando tanto o cabeçalho (AAD) quanto o payload via tag GCM.
 */
export function decifrarBackupAgbak(arquivoBytes: Uint8Array, senha: string): BackupPayload {
  if (!senha || !senha.trim()) {
    throw new Error('Informe a senha para decifrar o backup.');
  }

  const { cabecalho, cabecalhoBytes, ciphertext, tag } = desempacotarArquivoAgbak(arquivoBytes);

  const key = deriveKeyPbkdf2Sha256(senha, cabecalho.salt, cabecalho.iteracoes);

  try {
    let jsonUtf8: string;
    try {
      jsonUtf8 = decryptAes256GcmWithAad({
        ciphertext,
        key,
        nonce: cabecalho.nonce,
        aadHeader: cabecalhoBytes,
        tag,
      });
    } catch {
      throw new Error('Senha incorreta ou arquivo de backup corrompido.');
    }

    return lerPayloadBackup(jsonUtf8);
  } finally {
    // Limpa os bytes da chave em memória imediatamente após decifrar
    key.fill(0);
  }
}
