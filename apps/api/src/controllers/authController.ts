import { Request, Response } from 'express';
import { UserModel } from '../models/userModel';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class AuthController {
  /**
   * Endpoint de login/registro (POST /api/v1/auth/login)
   */
  static async loginOrRegister(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1] || 'test-token';
      const firebaseUser = await FirebaseAuthService.verifyIdToken(token);

      let user = await UserModel.findByFirebaseUid(firebaseUser.uid);
      if (!user) {
        user = await UserModel.create(
          firebaseUser.uid,
          firebaseUser.name || 'Motorista',
          firebaseUser.email,
        );
      }

      return res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * US01.5 - GET /api/v1/me
   * Retorna os dados do usuário autenticado. Cria o registro na primeira chamada caso não exista.
   */
  static async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.',
        });
      }

      let user = await UserModel.findByFirebaseUid(firebaseUser.uid);
      if (!user) {
        user = await UserModel.create(
          firebaseUser.uid,
          firebaseUser.name || 'Motorista',
          firebaseUser.email,
        );
      }

      return res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao obter perfil do usuário: ${error.message}`,
      });
    }
  }
}
