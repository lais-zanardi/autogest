import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BiometricService } from '../services/biometricService';

describe('US01.7 / US01.3 / US01.4 - BiometricService (Critério BDD)', () => {
  beforeEach(() => {
    BiometricService.resetMockState();
  });

  it('(BDD US01) Dado usuário com biometria habilitada, quando tocar no sensor biométrico, então deve autenticar em até 2s', async () => {
    // Cenário: Biometria habilitada pelo usuário e disponível no dispositivo
    await BiometricService.setBiometricsEnabled(true);
    BiometricService.mockSensorAvailability(true, 'Biometrics');
    BiometricService.mockAuthDelay(350); // Simula leitura do sensor em 350ms

    const startTime = Date.now();
    const result = await BiometricService.authenticateWithBiometrics({
      promptMessage: 'Desbloquear AutoGest com biometria',
      fallbackToPassword: true,
    });
    const totalDuration = Date.now() - startTime;

    assert.equal(result.success, true);
    assert.ok(
      result.durationMs <= 2000,
      `A autenticação biométrica deve durar no máximo 2000ms, durou ${result.durationMs}ms`,
    );
    assert.ok(
      totalDuration <= 2000,
      `Tempo total decorrido deve ser <= 2000ms, foi ${totalDuration}ms`,
    );
    assert.equal(result.fallbackRequired, false);
  });

  it('US01.4 - Se o toque no sensor falhar ou for cancelado, deve cair para e-mail/senha', async () => {
    await BiometricService.setBiometricsEnabled(true);
    BiometricService.mockSensorAvailability(true, 'Biometrics');
    BiometricService.mockAuthFailure('Usuário cancelou ou sensor não reconheceu');

    const result = await BiometricService.authenticateWithBiometrics({
      promptMessage: 'Desbloquear AutoGest',
      fallbackToPassword: true,
    });

    assert.equal(result.success, false);
    assert.equal(result.fallbackRequired, true);
    assert.match(result.error || '', /cancelou|não reconheceu|falhou/i);
  });

  it('US01.4 - Se o dispositivo não possuir sensor biométrico, deve direcionar para e-mail/senha', async () => {
    await BiometricService.setBiometricsEnabled(true);
    BiometricService.mockSensorAvailability(false);

    const result = await BiometricService.authenticateWithBiometrics({
      promptMessage: 'Desbloquear AutoGest',
      fallbackToPassword: true,
    });

    assert.equal(result.success, false);
    assert.equal(result.fallbackRequired, true);
    assert.match(result.error || '', /não disponível|não suportado/i);
  });

  it('US01.3 - Deve permitir persistir e consultar se a biometria está habilitada', async () => {
    assert.equal(await BiometricService.isBiometricsEnabled(), false);

    await BiometricService.setBiometricsEnabled(true);
    assert.equal(await BiometricService.isBiometricsEnabled(), true);

    await BiometricService.setBiometricsEnabled(false);
    assert.equal(await BiometricService.isBiometricsEnabled(), false);
  });

  it('US01.3 - Deve verificar se já foi oferecido ativar biometria após primeiro login', async () => {
    assert.equal(await BiometricService.hasPromptedBiometrics(), false);

    await BiometricService.markBiometricsPrompted();
    assert.equal(await BiometricService.hasPromptedBiometrics(), true);
  });
});
