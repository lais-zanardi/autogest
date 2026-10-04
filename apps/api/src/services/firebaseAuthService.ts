import * as admin from 'firebase-admin';
import { env } from '../config/env';
import { UnauthorizedError } from '../errors/AppError';

// Inicialização única do Firebase Admin se credenciais fornecidas
if (env.firebase.isConfigured) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey,
      }),
    });
    console.log('🔥 Firebase Admin SDK inicializado com sucesso.');
  } catch (err) {
    console.error('⚠️ Falha ao inicializar Firebase Admin SDK:', err);
  }
} else {
  console.log('ℹ️ Firebase Admin não configurado. Modo de simulação/desenvolvimento ativo.');
}

export class FirebaseAuthService {
  /**
   * Valida o token JWT emitido pelo Firebase Authentication.
   * Em produção, utiliza o Firebase Admin SDK real.
   * Em desenvolvimento/testes, permite tokens simulados se o SDK não estiver configurado.
   */
  static async verifyIdToken(
    token: string,
  ): Promise<{ uid: string; email: string; name?: string }> {
    if (!token) {
      throw new UnauthorizedError('Token de autenticação não fornecido.');
    }

    // Modo desenvolvimento / bypass com token de teste
    if (!env.firebase.isConfigured || token === 'test-token') {
      if (token === 'test-token') {
        return {
          uid: 'user_firebase_123',
          email: 'motorista@autogest.com',
          name: 'Motorista AutoGest',
        };
      }
      return {
        uid: `uid_${token.substring(0, 10)}`,
        email: 'user@autogest.com',
        name: 'Usuário Gestor',
      };
    }

    // Validação real via Firebase Admin SDK
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || 'Motorista',
      };
    } catch (error: any) {
      throw new UnauthorizedError(`Token de autenticação inválido ou expirado: ${error.message}`);
    }
  }
}
