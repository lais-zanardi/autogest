/**
 * Funções puras de validação de formulários de autenticação e mapeamento de erros do Firebase
 */

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(email?: string, password?: string): FormValidationResult {
  const errors: Record<string, string> = {};

  if (!email || !email.trim()) {
    errors.email = 'Informe o e-mail.';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Formato de e-mail inválido.';
  }

  if (!password) {
    errors.password = 'Informe a senha.';
  } else if (password.length < 6) {
    errors.password = 'A senha deve ter no mínimo 6 caracteres.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateRegisterForm(
  name?: string,
  email?: string,
  password?: string,
  confirmPassword?: string,
): FormValidationResult {
  const errors: Record<string, string> = {};

  if (!name || !name.trim()) {
    errors.name = 'Nome é obrigatório.';
  } else if (name.trim().length < 2) {
    errors.name = 'O nome deve ter pelo menos 2 caracteres.';
  }

  if (!email || !email.trim()) {
    errors.email = 'Informe o e-mail.';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Formato de e-mail inválido.';
  }

  if (!password) {
    errors.password = 'Informe a senha.';
  } else if (password.length < 6) {
    errors.password = 'A senha deve ter no mínimo 6 caracteres.';
  }

  if (password && confirmPassword !== password) {
    errors.confirmPassword = 'As senhas não coincidem.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getAuthErrorMessage(errorCodeOrMessage: string): string {
  const code = errorCodeOrMessage.toLowerCase();

  if (code.includes('auth/user-not-found')) {
    return 'Usuário não encontrado. Verifique seu e-mail ou crie uma conta.';
  }
  if (code.includes('auth/wrong-password')) {
    return 'Senha incorreta. Tente novamente ou recupere sua senha.';
  }
  if (code.includes('auth/invalid-credential')) {
    return 'E-mail ou senha incorretos.';
  }
  if (code.includes('auth/invalid-email')) {
    return 'O formato do e-mail é inválido.';
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'Este e-mail já está em uso por outra conta.';
  }
  if (code.includes('auth/weak-password')) {
    return 'Senha muito fraca. Escolha uma senha com pelo menos 6 caracteres.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Falha na conexão de rede. Verifique sua internet.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Muitas tentativas falhas. Aguarde alguns minutos antes de tentar novamente.';
  }

  return 'Erro ao processar autenticação. Tente novamente.';
}
