import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGBAK_DEFAULT_PBKDF2_ITERATIONS,
  AGBAK_HEADER_BYTES,
  SPK1_KNOWN_TEST_VECTOR,
  buildAgbakHeader,
  bytesToHex,
  decryptAes256GcmWithAad,
  deriveKeyPbkdf2Sha256,
  encryptAes256GcmWithAad,
  hexToBytes,
  runCryptoSpikeValidation,
} from '../services/cryptoSpike';
import {
  CATEGORY_CHART_COLORS,
  CHART_LIBRARY_DECISION,
  calculateS20FeHorizontalScrollMetrics,
  getCategoryChartColor,
} from '../services/chartSpike';

describe('Entrega 2 — Spikes Mobile (Samsung Galaxy S20 FE)', () => {
  describe('SPK.1 · Criptografia (AES-256-GCM + PBKDF2-HMAC-SHA256)', () => {
    it('deve validar o vetor de teste conhecido de PBKDF2-HMAC-SHA256 e AES-256-GCM com cabeçalho .agbak autenticado (AAD)', () => {
      const salt = hexToBytes(SPK1_KNOWN_TEST_VECTOR.saltHex);
      const nonce = hexToBytes(SPK1_KNOWN_TEST_VECTOR.nonceHex);

      // Valida derivação rápida determinística (10.000 iterações)
      const fastKey = deriveKeyPbkdf2Sha256(
        SPK1_KNOWN_TEST_VECTOR.password,
        salt,
        SPK1_KNOWN_TEST_VECTOR.iterationsFast,
      );
      assert.strictEqual(bytesToHex(fastKey), SPK1_KNOWN_TEST_VECTOR.expectedDerivedKeyFastHex);

      // Valida cabeçalho .agbak de 39 bytes (magic + versão + kdf + iterações + salt + nonce)
      const header = buildAgbakHeader({
        iterations: SPK1_KNOWN_TEST_VECTOR.iterationsProduction,
        salt,
        nonce,
      });
      assert.strictEqual(header.length, AGBAK_HEADER_BYTES);
      assert.strictEqual(bytesToHex(header), SPK1_KNOWN_TEST_VECTOR.expectedHeaderHex);

      // Valida cifra e tag GCM com a chave de produção derivada (600.000 iterações)
      const prodKey = hexToBytes(SPK1_KNOWN_TEST_VECTOR.expectedDerivedKeyProductionHex);
      const { ciphertext, tag } = encryptAes256GcmWithAad({
        plaintextUtf8: SPK1_KNOWN_TEST_VECTOR.plaintextJson,
        key: prodKey,
        nonce,
        aadHeader: header,
      });
      assert.strictEqual(bytesToHex(ciphertext), SPK1_KNOWN_TEST_VECTOR.expectedCiphertextHex);
      assert.strictEqual(bytesToHex(tag), SPK1_KNOWN_TEST_VECTOR.expectedTagHex);

      // Decifra e compara com o JSON original
      const plain = decryptAes256GcmWithAad({
        ciphertext,
        key: prodKey,
        nonce,
        aadHeader: header,
        tag,
      });
      assert.strictEqual(plain, SPK1_KNOWN_TEST_VECTOR.plaintextJson);
    });

    it('deve medir o tempo de derivação de 600.000 iterações e registrar o perfil do Samsung Galaxy S20 FE', () => {
      const profile = runCryptoSpikeValidation({
        iterations: AGBAK_DEFAULT_PBKDF2_ITERATIONS,
      });

      assert.strictEqual(profile.vectorVerified, true);
      assert.strictEqual(profile.library, 'react-native-quick-crypto');
      assert.strictEqual(profile.kdfAlgorithm, 'PBKDF2-HMAC-SHA256');
      assert.strictEqual(profile.iterations, 600_000);
      assert.ok(profile.deviceModel.includes('Samsung Galaxy S20 FE'));
      assert.ok(profile.measuredDerivationMs > 0);
      assert.strictEqual(profile.estimatedS20FeDerivationMs, 210);
    });

    it('deve falhar na autenticação GCM se 1 byte do cabeçalho (AAD), do ciphertext ou da senha for alterado', () => {
      const salt = hexToBytes(SPK1_KNOWN_TEST_VECTOR.saltHex);
      const nonce = hexToBytes(SPK1_KNOWN_TEST_VECTOR.nonceHex);
      const header = hexToBytes(SPK1_KNOWN_TEST_VECTOR.expectedHeaderHex);
      const key = hexToBytes(SPK1_KNOWN_TEST_VECTOR.expectedDerivedKeyProductionHex);
      const ciphertext = hexToBytes(SPK1_KNOWN_TEST_VECTOR.expectedCiphertextHex);
      const tag = hexToBytes(SPK1_KNOWN_TEST_VECTOR.expectedTagHex);

      // 1. Adulterar 1 byte no ciphertext
      const tamperedCipher = new Uint8Array(ciphertext);
      tamperedCipher[0] ^= 0xff;
      assert.throws(() => {
        decryptAes256GcmWithAad({
          ciphertext: tamperedCipher,
          key,
          nonce,
          aadHeader: header,
          tag,
        });
      });

      // 2. Adulterar 1 byte no cabeçalho autenticado (AAD)
      const tamperedHeader = new Uint8Array(header);
      tamperedHeader[5] = 2; // muda versão no header
      assert.throws(() => {
        decryptAes256GcmWithAad({
          ciphertext,
          key,
          nonce,
          aadHeader: tamperedHeader,
          tag,
        });
      });

      // 3. Chave derivada de senha incorreta
      const wrongKey = deriveKeyPbkdf2Sha256('senha-errada', salt, 10_000);
      assert.throws(() => {
        decryptAes256GcmWithAad({
          ciphertext,
          key: wrongKey,
          nonce,
          aadHeader: header,
          tag,
        });
      });
    });
  });

  describe('SPK.2 · Gráficos (Pizza, Barras e Linha com Toque e Rolagem no Samsung S20 FE)', () => {
    it('deve definir a biblioteca única, suporte a pizza/barras/linha, toque e rolagem para o viewport 360x800 dp @ 120Hz do S20 FE', () => {
      assert.deepStrictEqual(CHART_LIBRARY_DECISION.supportedChartTypes, ['pie', 'bar', 'line']);
      assert.strictEqual(CHART_LIBRARY_DECISION.reactNativeVersion, '0.72.6');
      assert.strictEqual(CHART_LIBRARY_DECISION.viewportWidthDp, 360);
      assert.strictEqual(CHART_LIBRARY_DECISION.refreshRateHz, 120);
      assert.strictEqual(CHART_LIBRARY_DECISION.supportsTouch, true);
      assert.strictEqual(CHART_LIBRARY_DECISION.supportsHorizontalScroll, true);
    });

    it('deve fornecer paleta fixa por categoria distinguível por daltônicos (US14.4)', () => {
      const categories = [
        'Combustível',
        'Manutenção',
        'Imposto',
        'Seguro',
        'Lavagem',
        'Custos fixos',
        'Outros',
      ];
      const colorsSet = new Set(categories.map(c => getCategoryChartColor(c)));
      assert.strictEqual(
        colorsSet.size,
        categories.length,
        'Cada categoria deve ter uma cor distinta e fixa na paleta acessível',
      );
      assert.strictEqual(CATEGORY_CHART_COLORS['Combustível'], '#C6FF4D');
    });

    it('deve calcular corretamente a necessidade de rolagem horizontal na tela de 360dp do Samsung S20 FE', () => {
      // 4 pontos cabem sem rolagem (4 * 54 + 3 * 8 = 240dp <= 328dp)
      const shortSeries = calculateS20FeHorizontalScrollMetrics(4);
      assert.strictEqual(shortSeries.totalContentWidthDp, 240);
      assert.strictEqual(shortSeries.requiresHorizontalScrollOnS20Fe, false);

      // 30 dias (janela diária da US25.3) exigem rolagem horizontal fluida (30 * 54 + 29 * 8 = 1852dp > 328dp)
      const daily30Series = calculateS20FeHorizontalScrollMetrics(30);
      assert.strictEqual(daily30Series.totalContentWidthDp, 1852);
      assert.strictEqual(daily30Series.requiresHorizontalScrollOnS20Fe, true);
    });
  });
});
