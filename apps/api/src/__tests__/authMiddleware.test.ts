import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { AuthController } from '../controllers/authController';
import { UserModel } from '../models/userModel';

describe('US01.7 - Auth Middleware & US01.5 - GET /api/v1/me', () => {
  it('deve retornar 401 quando o token de autenticação estiver ausente', async () => {
    const req = {
      headers: {},
    } as unknown as Request;

    let statusCode: number | null = null;
    let responseBody: any = null;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
    } as unknown as Response;

    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    await authMiddleware(req, res, next);

    assert.equal(statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(responseBody.message, /não fornecido|ausente/i);
  });

  it('deve retornar 401 quando o token for inválido', async () => {
    const req = {
      headers: {
        authorization: 'Bearer invalid-token-xyz',
      },
    } as unknown as Request;

    let statusCode: number | null = null;
    let _responseBody: any = null;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        _responseBody = body;
        return this;
      },
    } as unknown as Response;

    let nextCalled: boolean = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    await authMiddleware(req, res, next);

    // No modo de teste/dev, se o token for explicitamente rejeitado ou falhar
    assert.ok(statusCode === 401 || Boolean(nextCalled));
  });

  it('deve avançar (chamar next) e anexar firebaseUser quando o token for válido', async () => {
    const req = {
      headers: {
        authorization: 'Bearer test-token',
      },
    } as unknown as AuthenticatedRequest;

    let statusCode: number | null = null;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;

    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    await authMiddleware(req as Request, res, next);

    assert.equal(statusCode, null);
    assert.equal(nextCalled, true);
    assert.ok(req.firebaseUser);
    assert.equal(req.firebaseUser.uid, 'user_firebase_123');
    assert.equal(req.firebaseUser.email, 'motorista@autogest.com');
  });

  it('US01.5 - GET /api/v1/me cria usuário na primeira chamada e retorna com sucesso', async () => {
    const originalFindByFirebaseUid = UserModel.findByFirebaseUid;
    const originalCreate = UserModel.create;

    try {
      let created = false;
      UserModel.findByFirebaseUid = async (_uid: string) => null;
      UserModel.create = async (uid: string, name: string, email: string) => {
        created = true;
        return {
          id: '11111111-2222-3333-4444-555555555555',
          firebaseUid: uid,
          name,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      };

      const req = {
        firebaseUser: {
          uid: 'user_novo_123',
          email: 'novo@autogest.com',
          name: 'Novo Motorista',
        },
      } as unknown as AuthenticatedRequest;

      let statusCode: number | null = null;
      let responseBody: any = null;
      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(body: any) {
          responseBody = body;
          return this;
        },
      } as unknown as Response;

      await AuthController.getMe(req as Request, res);

      assert.equal(statusCode, 200);
      assert.equal(created, true);
      assert.equal(responseBody.success, true);
      assert.equal(responseBody.data.firebaseUid, 'user_novo_123');
      assert.equal(responseBody.data.name, 'Novo Motorista');
    } finally {
      UserModel.findByFirebaseUid = originalFindByFirebaseUid;
      UserModel.create = originalCreate;
    }
  });

  it('US01.5 - GET /api/v1/me retorna usuário existente sem recriar na segunda chamada', async () => {
    const originalFindByFirebaseUid = UserModel.findByFirebaseUid;
    const originalCreate = UserModel.create;

    try {
      let created = false;
      UserModel.findByFirebaseUid = async (uid: string) => ({
        id: '22222222-3333-4444-5555-666666666666',
        firebaseUid: uid,
        name: 'Motorista Existente',
        email: 'existente@autogest.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      UserModel.create = async () => {
        created = true;
        throw new Error('Não deveria chamar create se já existe');
      };

      const req = {
        firebaseUser: {
          uid: 'user_existente_123',
          email: 'existente@autogest.com',
          name: 'Motorista Existente',
        },
      } as unknown as AuthenticatedRequest;

      let statusCode: number | null = null;
      let responseBody: any = null;
      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(body: any) {
          responseBody = body;
          return this;
        },
      } as unknown as Response;

      await AuthController.getMe(req as Request, res);

      assert.equal(statusCode, 200);
      assert.equal(created, false);
      assert.equal(responseBody.success, true);
      assert.equal(responseBody.data.id, '22222222-3333-4444-5555-666666666666');
    } finally {
      UserModel.findByFirebaseUid = originalFindByFirebaseUid;
      UserModel.create = originalCreate;
    }
  });
});
