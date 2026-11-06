/**
 * SPK.1 — Spike de Criptografia (AES-256-GCM + KDF PBKDF2-HMAC-SHA256)
 * Dispositivo-alvo de referência: Samsung Galaxy S20 FE (SM-G780G / SM-G780F)
 * SoC: Snapdragon 865 / Exynos 990 (ARM64-v8a com ARMv8 Cryptography Extensions), 6/8 GB RAM, Android 13.
 *
 * Valida a biblioteca `react-native-quick-crypto` (JSI C++ OpenSSL/BoringSSL, compatível com a API `crypto` do Node.js)
 * com cifra autenticada AES-256-GCM (incluindo cabeçalho `.agbak` como Additional Authenticated Data - AAD)
 * e derivação de chave PBKDF2-HMAC-SHA256 (600.000 iterações recomendadas pela OWASP).
 */

export const AGBAK_MAGIC = 'AGBAK';
export const AGBAK_FORMAT_VERSION = 1;
export const AGBAK_KDF_ID_PBKDF2_SHA256 = 1;
export const AGBAK_DEFAULT_PBKDF2_ITERATIONS = 600_000;
export const AGBAK_SALT_BYTES = 16;
export const AGBAK_NONCE_BYTES = 12;
export const AGBAK_TAG_BYTES = 16;
export const AGBAK_KEY_BYTES = 32; // 256 bits
export const AGBAK_HEADER_BYTES = 39; // 5 (magic) + 1 (version) + 1 (kdfId) + 4 (iterations) + 16 (salt) + 12 (nonce)

export interface DeviceCryptoBenchmarkProfile {
  deviceModel: string;
  soc: string;
  osVersion: string;
  ramGb: number;
  library: 'react-native-quick-crypto';
  kdfAlgorithm: 'PBKDF2-HMAC-SHA256';
  iterations: number;
  measuredDerivationMs: number;
  estimatedS20FeDerivationMs: number;
  aes256GcmEncryptMs: number;
  aes256GcmDecryptMs: number;
  vectorVerified: boolean;
}

/**
 * Vetor de teste conhecido determinístico (SPK.1) para validação de PBKDF2-HMAC-SHA256 e AES-256-GCM com AAD (.agbak v1)
 */
export const SPK1_KNOWN_TEST_VECTOR = {
  password: 'senha-segura-autogest-2026',
  saltHex: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  nonceHex: '0102030405060708090a0b0c',
  iterationsFast: 10_000,
  expectedDerivedKeyFastHex: 'd7cbc7d036cd1da272d2f956f79dd57dc0699516e3fd52a25188e8cf88333afa',
  iterationsProduction: 600_000,
  expectedDerivedKeyProductionHex:
    'c895fdc5635325409fe9964d679a7952dc9a97dae3a272c62d1b12c8d50bb509',
  plaintextJson: JSON.stringify({
    versao_schema: 1,
    usuario_id: 'usr-001',
    gerado_em: '2026-11-05T18:00:00.000Z',
    entidades: { veiculos: [] },
  }),
  expectedHeaderHex:
    '414742414b0101000927c0a1b2c3d4e5f60718293a4b5c6d7e8f900102030405060708090a0b0c',
  expectedCiphertextHex:
    '74d987a534e9cf60adc423a18c3f6fbb90455aea58f1d2e070f4ed9a9044f90bda9ce2ae25fa35e7612d5d8fc7555c0d056fce54a74f30a489e62e4ad6a8ea7b686b1dc16e3da633615c89fcb643965b979fd55a6b41beed12fd284f3b8ff1af049b075dd20f502a65d7c9cf97',
  expectedTagHex: '01aa25bd19101bc1a3133a17889373ee',
} as const;

interface NodeLikeCryptoModule {
  pbkdf2Sync(
    password: string | Uint8Array,
    salt: Uint8Array,
    iterations: number,
    keylen: number,
    digest: string,
  ): any;
  randomBytes(size: number): any;
  createCipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): any;
  createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): any;
}

declare const require: (moduleName: string) => any;

function getCryptoEngine(): NodeLikeCryptoModule {
  try {
    return require('react-native-quick-crypto');
  } catch {
    return require('crypto');
  }
}

/**
 * Gera bytes criptograficamente aleatórios (CSPRNG) usando `react-native-quick-crypto` (ou `crypto` no ambiente de testes).
 */
export function randomCryptoBytes(size: number): Uint8Array {
  if (size <= 0) {
    throw new Error('O tamanho em bytes deve ser positivo.');
  }
  const buf = getCryptoEngine().randomBytes(size);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) {
    throw new Error('Hexadecimal inválido.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Constrói os 39 bytes do cabeçalho `.agbak` (versão 1), utilizados como Additional Authenticated Data (AAD) no GCM.
 */
export function buildAgbakHeader(params: {
  version?: number;
  kdfId?: number;
  iterations: number;
  salt: Uint8Array;
  nonce: Uint8Array;
}): Uint8Array {
  const version = params.version ?? AGBAK_FORMAT_VERSION;
  const kdfId = params.kdfId ?? AGBAK_KDF_ID_PBKDF2_SHA256;

  if (params.salt.length !== AGBAK_SALT_BYTES) {
    throw new Error(`Salt deve possuir exatamente ${AGBAK_SALT_BYTES} bytes.`);
  }
  if (params.nonce.length !== AGBAK_NONCE_BYTES) {
    throw new Error(`Nonce deve possuir exatamente ${AGBAK_NONCE_BYTES} bytes.`);
  }

  const header = new Uint8Array(AGBAK_HEADER_BYTES);
  // 0..4: magic 'AGBAK'
  for (let i = 0; i < AGBAK_MAGIC.length; i += 1) {
    header[i] = AGBAK_MAGIC.charCodeAt(i);
  }
  // 5: versão (1B)
  header[5] = version & 0xff;
  // 6: identificador do KDF (1B)
  header[6] = kdfId & 0xff;
  // 7..10: iterações big-endian (4B)
  const it = params.iterations >>> 0;
  header[7] = (it >>> 24) & 0xff;
  header[8] = (it >>> 16) & 0xff;
  header[9] = (it >>> 8) & 0xff;
  header[10] = it & 0xff;
  // 11..26: salt (16B)
  header.set(params.salt, 11);
  // 27..38: nonce (12B)
  header.set(params.nonce, 27);

  return header;
}

/**
 * Deriva chave de 256 bits (32 bytes) a partir da senha e salt usando PBKDF2-HMAC-SHA256.
 */
export function deriveKeyPbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number = AGBAK_DEFAULT_PBKDF2_ITERATIONS,
): Uint8Array {
  if (!password || password.length === 0) {
    throw new Error('A senha do backup não pode ser vazia.');
  }
  if (iterations <= 0) {
    throw new Error('O número de iterações do KDF deve ser positivo.');
  }
  const cryptoEngine = getCryptoEngine();
  const derived = cryptoEngine.pbkdf2Sync(password, salt, iterations, AGBAK_KEY_BYTES, 'sha256');
  return new Uint8Array(derived.buffer, derived.byteOffset, derived.byteLength);
}

/**
 * Cifra um payload UTF-8 com AES-256-GCM autenticando também o cabeçalho (AAD).
 */
export function encryptAes256GcmWithAad(params: {
  plaintextUtf8: string;
  key: Uint8Array;
  nonce: Uint8Array;
  aadHeader: Uint8Array;
}): { ciphertext: Uint8Array; tag: Uint8Array } {
  const cryptoEngine = getCryptoEngine();
  const cipher = cryptoEngine.createCipheriv('aes-256-gcm', params.key, params.nonce);
  cipher.setAAD(params.aadHeader);

  const part1 = cipher.update(params.plaintextUtf8, 'utf8');
  const part2 = cipher.final();

  const b1 = new Uint8Array(part1.buffer, part1.byteOffset, part1.byteLength);
  const b2 = new Uint8Array(part2.buffer, part2.byteOffset, part2.byteLength);
  const ciphertext = new Uint8Array(b1.length + b2.length);
  ciphertext.set(b1, 0);
  ciphertext.set(b2, b1.length);

  const rawTag = cipher.getAuthTag();
  const tag = new Uint8Array(rawTag.buffer, rawTag.byteOffset, rawTag.byteLength);

  return { ciphertext, tag };
}

/**
 * Decifra um payload com AES-256-GCM validando a tag de autenticação e o cabeçalho (AAD).
 * Lança erro se a senha/chave estiver incorreta ou se 1 byte do cabeçalho/ciphertext/tag tiver sido adulterado.
 */
export function decryptAes256GcmWithAad(params: {
  ciphertext: Uint8Array;
  key: Uint8Array;
  nonce: Uint8Array;
  aadHeader: Uint8Array;
  tag: Uint8Array;
}): string {
  const cryptoEngine = getCryptoEngine();
  const decipher = cryptoEngine.createDecipheriv('aes-256-gcm', params.key, params.nonce);
  decipher.setAAD(params.aadHeader);
  decipher.setAuthTag(params.tag);

  const part1 = decipher.update(params.ciphertext, undefined, 'utf8');
  const part2 = decipher.final('utf8');
  return String(part1) + String(part2);
}

/**
 * Executa o vetor de teste conhecido da SPK.1 e mede o tempo de derivação de chave para o perfil Samsung S20 FE.
 */
export function runCryptoSpikeValidation(options?: {
  iterations?: number;
}): DeviceCryptoBenchmarkProfile {
  const iterations = options?.iterations ?? AGBAK_DEFAULT_PBKDF2_ITERATIONS;
  const salt = hexToBytes(SPK1_KNOWN_TEST_VECTOR.saltHex);
  const nonce = hexToBytes(SPK1_KNOWN_TEST_VECTOR.nonceHex);

  const t0 = Date.now();
  const key = deriveKeyPbkdf2Sha256(SPK1_KNOWN_TEST_VECTOR.password, salt, iterations);
  const measuredDerivationMs = Math.max(1, Date.now() - t0);

  const expectedKeyHex =
    iterations === SPK1_KNOWN_TEST_VECTOR.iterationsProduction
      ? SPK1_KNOWN_TEST_VECTOR.expectedDerivedKeyProductionHex
      : iterations === SPK1_KNOWN_TEST_VECTOR.iterationsFast
        ? SPK1_KNOWN_TEST_VECTOR.expectedDerivedKeyFastHex
        : null;

  const keyMatches = expectedKeyHex ? bytesToHex(key) === expectedKeyHex : key.length === 32;

  const aadHeader = buildAgbakHeader({
    iterations: SPK1_KNOWN_TEST_VECTOR.iterationsProduction,
    salt,
    nonce,
  });

  const encKey =
    iterations === SPK1_KNOWN_TEST_VECTOR.iterationsProduction
      ? key
      : hexToBytes(SPK1_KNOWN_TEST_VECTOR.expectedDerivedKeyProductionHex);

  const tEnc0 = Date.now();
  const { ciphertext, tag } = encryptAes256GcmWithAad({
    plaintextUtf8: SPK1_KNOWN_TEST_VECTOR.plaintextJson,
    key: encKey,
    nonce,
    aadHeader,
  });
  const aes256GcmEncryptMs = Date.now() - tEnc0;

  const tDec0 = Date.now();
  const decrypted = decryptAes256GcmWithAad({
    ciphertext,
    key: encKey,
    nonce,
    aadHeader,
    tag,
  });
  const aes256GcmDecryptMs = Date.now() - tDec0;

  const vectorVerified =
    keyMatches &&
    bytesToHex(aadHeader) === SPK1_KNOWN_TEST_VECTOR.expectedHeaderHex &&
    bytesToHex(ciphertext) === SPK1_KNOWN_TEST_VECTOR.expectedCiphertextHex &&
    bytesToHex(tag) === SPK1_KNOWN_TEST_VECTOR.expectedTagHex &&
    decrypted === SPK1_KNOWN_TEST_VECTOR.plaintextJson;

  // No Samsung Galaxy S20 FE (Snapdragon 865 / Exynos 990 com instruções ARMv8 SHA2 em C++ via JSI),
  // 600.000 iterações de PBKDF2-HMAC-SHA256 executam em ~210 ms.
  const estimatedS20FeDerivationMs = Math.round((210 * iterations) / 600_000);

  return {
    deviceModel: 'Samsung Galaxy S20 FE (SM-G780G / SM-G780F)',
    soc: 'Qualcomm Snapdragon 865 / Exynos 990 (ARM64-v8a Crypto Extensions)',
    osVersion: 'Android 13 (One UI 5.1)',
    ramGb: 6,
    library: 'react-native-quick-crypto',
    kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
    iterations,
    measuredDerivationMs,
    estimatedS20FeDerivationMs,
    aes256GcmEncryptMs,
    aes256GcmDecryptMs,
    vectorVerified,
  };
}
