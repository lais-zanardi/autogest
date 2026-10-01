import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EnvConfig } from '../config/env';
import { AuthService } from '../services/authService';

describe('VITE_USE_MOCK - Alternância entre Dados Mockados e API Real', () => {
  beforeEach(async () => {
    await EnvConfig.resetToEnvDefault();
    await AuthService.logout();
  });

  it('deve ter modo mock ativo por padrão quando VITE_USE_MOCK=true', () => {
    assert.equal(EnvConfig.isMockMode(), true);
  });

  it('em modo mock (VITE_USE_MOCK=true), AuthService.login realiza login determinístico com sucesso', async () => {
    await EnvConfig.setMockMode(true);

    const session = await AuthService.login('motorista@autogest.com', '123456');

    assert.ok(session);
    assert.equal(session.user.email, 'motorista@autogest.com');
    assert.equal(session.user.name, 'Motorista AutoGest');
    assert.ok(session.token.startsWith('mock_token_'));

    const stored = await AuthService.getStoredSession();
    assert.ok(stored);
    assert.equal(stored.user.email, 'motorista@autogest.com');
  });

  it('em modo mock (VITE_USE_MOCK=true), AuthService.register cria usuário mockado sem depender de rede', async () => {
    await EnvConfig.setMockMode(true);

    const session = await AuthService.register(
      'Laís Zanardi',
      'lais@autogest.com',
      'senhaSegura123',
    );

    assert.ok(session);
    assert.equal(session.user.name, 'Laís Zanardi');
    assert.equal(session.user.email, 'lais@autogest.com');
    assert.ok(session.token.startsWith('mock_token_'));
  });

  it('permite alternar dinamicamente entre mock e real via setMockMode', async () => {
    await EnvConfig.setMockMode(false);
    assert.equal(EnvConfig.isMockMode(), false);

    await EnvConfig.setMockMode(true);
    assert.equal(EnvConfig.isMockMode(), true);
  });
});
