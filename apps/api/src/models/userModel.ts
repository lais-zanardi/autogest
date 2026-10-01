import { query } from './db';
import { User } from '@autogest/shared-types';

export class UserModel {
  static async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    try {
      const res = await query(
        `SELECT id, firebase_uid as "firebaseUid", nome as name, email, criado_em as "createdAt", atualizado_em as "updatedAt" 
         FROM usuarios 
         WHERE firebase_uid = $1 AND excluido_em IS NULL`,
        [firebaseUid],
      );
      if (res.rows[0]) return res.rows[0];
    } catch {
      const resFallback = await query(
        'SELECT id, firebase_uid as "firebaseUid", name, email, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE firebase_uid = $1',
        [firebaseUid],
      );
      return resFallback.rows[0] || null;
    }
    return null;
  }

  static async create(firebaseUid: string, name: string, email: string): Promise<User> {
    try {
      const res = await query(
        `INSERT INTO usuarios (firebase_uid, nome, email) 
         VALUES ($1, $2, $3) 
         RETURNING id, firebase_uid as "firebaseUid", nome as name, email, criado_em as "createdAt", atualizado_em as "updatedAt"`,
        [firebaseUid, name, email],
      );
      return res.rows[0];
    } catch {
      const resFallback = await query(
        `INSERT INTO users (firebase_uid, name, email) 
         VALUES ($1, $2, $3) 
         RETURNING id, firebase_uid as "firebaseUid", name, email, created_at as "createdAt", updated_at as "updatedAt"`,
        [firebaseUid, name, email],
      );
      return resFallback.rows[0];
    }
  }
}
