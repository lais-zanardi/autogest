import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLoginForm,
  validateRegisterForm,
  getAuthErrorMessage,
} from '../services/authValidation';

describe('US01.1 - Validações de Autenticação e Mensagens de Erro', () => {
  describe('validateLoginForm', () => {
    it('deve retornar válido para credenciais preenchidas corretamente', () => {
      const result = validateLoginForm('motorista@autogest.com', '123456');
      assert.equal(result.isValid, true);
      assert.equal(result.errors.email, undefined);
      assert.equal(result.errors.password, undefined);
    });

    it('deve rejeitar e-mail vazio ou inválido', () => {
      const emptyResult = validateLoginForm('', '123456');
      assert.equal(emptyResult.isValid, false);
      assert.match(emptyResult.errors.email || '', /informe o e-mail/i);

      const invalidResult = validateLoginForm('email-invalido', '123456');
      assert.equal(invalidResult.isValid, false);
      assert.match(invalidResult.errors.email || '', /formato de e-mail inválido/i);
    });

    it('deve rejeitar senha com menos de 6 caracteres', () => {
      const shortResult = validateLoginForm('teste@autogest.com', '12345');
      assert.equal(shortResult.isValid, false);
      assert.match(shortResult.errors.password || '', /mínimo 6 caracteres/i);
    });
  });

  describe('validateRegisterForm', () => {
    it('deve validar formulário de cadastro completo', () => {
      const result = validateRegisterForm(
        'Laís Zanardi',
        'lais@autogest.com',
        'senhaForte123',
        'senhaForte123',
      );
      assert.equal(result.isValid, true);
      assert.equal(Object.keys(result.errors).length, 0);
    });

    it('deve exigir nome com pelo menos 2 caracteres', () => {
      const emptyName = validateRegisterForm('', 'lais@autogest.com', '123456', '123456');
      assert.equal(emptyName.isValid, false);
      assert.match(emptyName.errors.name || '', /nome é obrigatório/i);

      const shortName = validateRegisterForm('A', 'lais@autogest.com', '123456', '123456');
      assert.equal(shortName.isValid, false);
      assert.match(shortName.errors.name || '', /pelo menos 2 caracteres/i);
    });

    it('deve rejeitar senhas que não coincidem', () => {
      const mismatch = validateRegisterForm(
        'Nome',
        'teste@autogest.com',
        'senha123',
        'senhaDiferente',
      );
      assert.equal(mismatch.isValid, false);
      assert.match(mismatch.errors.confirmPassword || '', /senhas não coincidem/i);
    });
  });

  describe('getAuthErrorMessage', () => {
    it('deve traduzir códigos de erro do Firebase para português amigável', () => {
      assert.match(getAuthErrorMessage('auth/user-not-found'), /usuário não encontrado/i);
      assert.match(getAuthErrorMessage('auth/wrong-password'), /senha incorreta/i);
      assert.match(getAuthErrorMessage('auth/invalid-credential'), /e-mail ou senha incorretos/i);
      assert.match(getAuthErrorMessage('auth/email-already-in-use'), /já está em uso/i);
      assert.match(getAuthErrorMessage('auth/weak-password'), /senha muito fraca/i);
      assert.match(getAuthErrorMessage('auth/network-request-failed'), /conexão|rede/i);
      assert.match(getAuthErrorMessage('unknown-error'), /erro ao processar autenticação/i);
    });
  });
});
