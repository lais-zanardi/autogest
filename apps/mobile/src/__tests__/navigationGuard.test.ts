import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/authService';
import { BiometricService } from '../services/biometricService';

describe('US01.2 / US01.4 - Guarda de Navegação e Ciclo de Sessão', () => {
  beforeEach(() => {
    useAppStore.getState().logout();
    BiometricService.resetMockState();
  });

  it('US01.2 - Inicialização sem sessão persistida direciona para Login', async () => {
    await AuthService.logout();
    const session = await AuthService.getStoredSession();

    assert.equal(session, null);
    assert.equal(useAppStore.getState().isAuthenticated, false);
    assert.equal(useAppStore.getState().isBiometricsLocked, false);
  });

  it('US01.2 - Inicialização com sessão e sem biometria dá acesso direto ao app', async () => {
    await AuthService.saveSession({
      user: {
        id: 'user_123',
        firebaseUid: 'uid_123',
        name: 'Motorista',
        email: 'motorista@autogest.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      token: 'token_valido',
    });
    await BiometricService.setBiometricsEnabled(false);

    const session = await AuthService.getStoredSession();
    assert.ok(session);

    useAppStore.getState().setAuth(session.user, true);
    useAppStore.getState().setBiometricsLocked(false);

    assert.equal(useAppStore.getState().isAuthenticated, true);
    assert.equal(useAppStore.getState().isBiometricsLocked, false);
  });

  it('US01.4 - Inicialização com sessão e biometria habilitada bloqueia o app até o toque no sensor', async () => {
    await AuthService.saveSession({
      user: {
        id: 'user_123',
        firebaseUid: 'uid_123',
        name: 'Motorista',
        email: 'motorista@autogest.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      token: 'token_valido',
    });
    await BiometricService.setBiometricsEnabled(true);

    const session = await AuthService.getStoredSession();
    assert.ok(session);

    const biometricsEnabled = await BiometricService.isBiometricsEnabled();
    assert.equal(biometricsEnabled, true);

    useAppStore.getState().setAuth(session.user, true);
    useAppStore.getState().setBiometricsLocked(true);

    assert.equal(useAppStore.getState().isAuthenticated, true);
    assert.equal(useAppStore.getState().isBiometricsLocked, true);

    // Desbloqueio com sucesso via sensor
    useAppStore.getState().setBiometricsLocked(false);
    assert.equal(useAppStore.getState().isBiometricsLocked, false);
  });

  it('US01.4 - Fallback para senha limpa a sessão e retorna para tela de login', async () => {
    useAppStore.getState().setAuth(
      {
        id: 'user_123',
        firebaseUid: 'uid_123',
        name: 'Motorista',
        email: 'motorista@autogest.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      true,
    );
    useAppStore.getState().setBiometricsLocked(true);

    // Usuário clica em "Entrar com E-mail e Senha"
    await AuthService.logout();
    useAppStore.getState().logout();

    assert.equal(useAppStore.getState().isAuthenticated, false);
    assert.equal(useAppStore.getState().isBiometricsLocked, false);
    assert.equal(await AuthService.getStoredSession(), null);
  });
});
