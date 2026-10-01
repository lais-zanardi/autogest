import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@autogest/shared-types';
import { api, setAuthToken } from './api';
import { getAuthErrorMessage } from './authValidation';
import { EnvConfig } from '../config/env';

const SESSION_STORAGE_KEY = '@autogest:user_session';

export interface UserSession {
  user: User;
  token: string;
}

const memoryAuthStore: Record<string, string> = {};

export class AuthService {
  /**
   * Realiza login por e-mail e senha.
   * Se VITE_USE_MOCK=true: utiliza autenticação mockada local sem requisições externas.
   * Se VITE_USE_MOCK=false: utiliza Firebase Auth SDK e sincroniza com /api/v1/me na API real.
   */
  static async login(email: string, password: string): Promise<UserSession> {
    try {
      const isMock = EnvConfig.isMockMode();

      if (isMock) {
        // Modo Mock (VITE_USE_MOCK=true)
        const token = `mock_token_${email}`;
        const uid = `mock_uid_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const name =
          email.toLowerCase() === 'motorista@autogest.com'
            ? 'Motorista AutoGest'
            : email.split('@')[0];

        const mockUser: User = {
          id: uid,
          firebaseUid: uid,
          name,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setAuthToken(token);
        const session: UserSession = { user: mockUser, token };
        await this.saveSession(session);
        return session;
      }

      // Modo Real (VITE_USE_MOCK=false)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      const uid = userCredential.user.uid;
      const displayName = userCredential.user.displayName || 'Motorista';

      setAuthToken(token);

      // Sincroniza / cria o usuário no PostgreSQL via GET /api/v1/me (US01.5)
      let userData: User;
      try {
        const response = await api.get('/me');
        userData = response.data.data;
      } catch {
        userData = {
          id: uid,
          firebaseUid: uid,
          name: displayName,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const session: UserSession = { user: userData, token };
      await this.saveSession(session);
      return session;
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code || error.message));
    }
  }

  /**
   * Realiza cadastro de novo usuário por e-mail, nome e senha.
   * Respeita VITE_USE_MOCK.
   */
  static async register(name: string, email: string, password: string): Promise<UserSession> {
    try {
      const isMock = EnvConfig.isMockMode();

      if (isMock) {
        // Modo Mock (VITE_USE_MOCK=true)
        const token = `mock_token_${email}`;
        const uid = `mock_uid_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const mockUser: User = {
          id: uid,
          firebaseUid: uid,
          name: name.trim(),
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setAuthToken(token);
        const session: UserSession = { user: mockUser, token };
        await this.saveSession(session);
        return session;
      }

      // Modo Real (VITE_USE_MOCK=false)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getAuth, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (name && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name.trim() });
      }
      const token = await userCredential.user.getIdToken();
      const uid = userCredential.user.uid;

      setAuthToken(token);

      let userData: User;
      try {
        const response = await api.get('/me');
        userData = response.data.data;
      } catch {
        userData = {
          id: uid,
          firebaseUid: uid,
          name: name.trim(),
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const session: UserSession = { user: userData, token };
      await this.saveSession(session);
      return session;
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code || error.message));
    }
  }

  /**
   * Envia e-mail de recuperação de senha (opcional)
   */
  static async sendPasswordResetEmail(email: string): Promise<void> {
    if (EnvConfig.isMockMode()) {
      console.log(`[MOCK] E-mail de recuperação simulado para: ${email}`);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getAuth, sendPasswordResetEmail } = require('firebase/auth');
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.log('Recuperação solicitada:', error.message);
    }
  }

  /**
   * Salva a sessão persistida localmente (AsyncStorage com fallback em memória)
   */
  static async saveSession(session: UserSession): Promise<void> {
    const raw = JSON.stringify(session);
    memoryAuthStore[SESSION_STORAGE_KEY] = raw;
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, raw);
    } catch {
      // Fallback em memória já persistido
    }
  }

  /**
   * Recupera a sessão persistida
   */
  static async getStoredSession(): Promise<UserSession | null> {
    let data: string | null = null;
    try {
      data = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      //
    }
    if (!data) {
      data = memoryAuthStore[SESSION_STORAGE_KEY] || null;
    }
    if (data) {
      const session: UserSession = JSON.parse(data);
      setAuthToken(session.token);
      return session;
    }
    return null;
  }

  /**
   * Remove a sessão do usuário (Logout)
   */
  static async logout(): Promise<void> {
    if (!EnvConfig.isMockMode()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getAuth, signOut } = require('firebase/auth');
        const auth = getAuth();
        await signOut(auth);
      } catch {
        //
      }
    }
    setAuthToken(null);
    delete memoryAuthStore[SESSION_STORAGE_KEY];
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      //
    }
  }
}
