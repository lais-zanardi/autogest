import { Request, Response, NextFunction } from 'express';
import { FirebaseAuthService } from '../services/firebaseAuthService';

export interface AuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email: string;
    name?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void | Response> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido ou formato inválido.',
      });
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação ausente.',
      });
    }

    const firebaseUser = await FirebaseAuthService.verifyIdToken(token);
    req.firebaseUser = firebaseUser;
    return next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Token de autenticação inválido ou expirado.',
    });
  }
}
