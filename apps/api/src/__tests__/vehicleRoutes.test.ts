import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { VehicleController } from '../controllers/vehicleController';
import { VehicleModel } from '../models/vehicleModel';
import { UserModel } from '../models/userModel';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { FipeService } from '../services/fipeService';

describe('US04 - API de Veículos & Controle de Acesso', () => {
  const mockUser = {
    id: 'usr_test_12345',
    firebaseUid: 'firebase_user_abc',
    name: 'Gestor da Frota',
    email: 'frota@autogest.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockVehicle = {
    id: 'veh_test_001',
    userId: mockUser.id,
    name: 'Carro Principal',
    brand: 'Honda',
    model: 'Civic Touring',
    year: 2020,
    plate: 'BRA2E19',
    fuelType: 'Gasolina' as const,
    tankCapacityL: 56,
    preferredFuel: 'Gasolina' as const,
    initialOdometer: 42000,
    currentOdometer: 42000,
    fipeValue: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  function createMockResponse() {
    let statusCode = 200;
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
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
    };

    return res as unknown as Response & { getStatusCode: () => number; getBody: () => any };
  }

  describe('Proteção das Rotas via authMiddleware', () => {
    it('deve retornar 401 ao tentar acessar rotas de veículos sem token de autorização', async () => {
      const req = {
        headers: {},
      } as unknown as Request;

      const res = createMockResponse();
      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      await authMiddleware(req, res, next);

      assert.equal(res.getStatusCode(), 401);
      assert.equal(nextCalled, false);
      assert.equal(res.getBody().success, false);
    });
  });

  describe('VehicleController.create', () => {
    it('deve rejeitar cadastro quando campos obrigatórios estiverem ausentes (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          // model, year, plate ausentes
          tankCapacityL: 50,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await VehicleController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
      assert.match(res.getBody().message, /Campos obrigatórios/i);
    });

    it('deve cadastrar veículo com sucesso para o usuário autenticado (201)', async () => {
      const origFindByFb = UserModel.findByFirebaseUid;
      const origCreate = VehicleModel.create;
      const origFipe = FipeService.getVehicleValue;

      try {
        UserModel.findByFirebaseUid = async () => mockUser;
        FipeService.getVehicleValue = async () => null;
        VehicleModel.create = async (userId, data) => ({
          ...mockVehicle,
          userId,
          model: data.model,
          plate: data.plate,
          year: data.year,
          tankCapacityL: data.tankCapacityL,
        });

        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            brand: 'Honda',
            model: 'Civic Touring',
            year: 2020,
            plate: 'BRA2E19',
            tankCapacityL: 56,
            preferredFuel: 'Gasolina',
            initialOdometer: 42000,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await VehicleController.create(req, res);

        assert.equal(res.getStatusCode(), 201);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.model, 'Civic Touring');
        assert.equal(res.getBody().data.userId, mockUser.id);
      } finally {
        UserModel.findByFirebaseUid = origFindByFb;
        VehicleModel.create = origCreate;
        FipeService.getVehicleValue = origFipe;
      }
    });
  });

  describe('VehicleController.listMine & listByUserId', () => {
    it('deve listar veículos pertencentes ao usuário autenticado (200)', async () => {
      const origFindByFb = UserModel.findByFirebaseUid;
      const origFindByUserId = VehicleModel.findByUserId;

      try {
        UserModel.findByFirebaseUid = async () => mockUser;
        VehicleModel.findByUserId = async userId => (userId === mockUser.id ? [mockVehicle] : []);

        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await VehicleController.listMine(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.length, 1);
        assert.equal(res.getBody().data[0].plate, 'BRA2E19');
      } finally {
        UserModel.findByFirebaseUid = origFindByFb;
        VehicleModel.findByUserId = origFindByUserId;
      }
    });
  });

  describe('VehicleController.getById', () => {
    it('deve retornar veículo por ID quando existir (200)', async () => {
      const origFindById = VehicleModel.findById;

      try {
        VehicleModel.findById = async id => (id === mockVehicle.id ? mockVehicle : null);

        const req = {
          params: { id: mockVehicle.id },
        } as unknown as Request;

        const res = createMockResponse();
        await VehicleController.getById(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.id, mockVehicle.id);
      } finally {
        VehicleModel.findById = origFindById;
      }
    });

    it('deve retornar 404 quando o veículo não for encontrado', async () => {
      const origFindById = VehicleModel.findById;

      try {
        VehicleModel.findById = async () => null;

        const req = {
          params: { id: 'inexistente_999' },
        } as unknown as Request;

        const res = createMockResponse();
        await VehicleController.getById(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
      } finally {
        VehicleModel.findById = origFindById;
      }
    });
  });

  describe('VehicleController.update', () => {
    it('deve atualizar metadados do veículo existente (200)', async () => {
      const origUpdate = VehicleModel.update;

      try {
        VehicleModel.update = async (id, data) => ({
          ...mockVehicle,
          id,
          ...data,
        });

        const req = {
          params: { id: mockVehicle.id },
          body: {
            model: 'Civic Si Turbo',
            tankCapacityL: 58,
          },
        } as unknown as Request;

        const res = createMockResponse();
        await VehicleController.update(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.model, 'Civic Si Turbo');
        assert.equal(res.getBody().data.tankCapacityL, 58);
      } finally {
        VehicleModel.update = origUpdate;
      }
    });
  });

  describe('VehicleController.delete', () => {
    it('deve realizar exclusão lógica do veículo (200)', async () => {
      const origSoftDelete = VehicleModel.softDelete;

      try {
        VehicleModel.softDelete = async id => id === mockVehicle.id;

        const req = {
          params: { id: mockVehicle.id },
        } as unknown as Request;

        const res = createMockResponse();
        await VehicleController.delete(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
      } finally {
        VehicleModel.softDelete = origSoftDelete;
      }
    });

    it('deve retornar 404 ao tentar excluir veículo inexistente ou já excluído', async () => {
      const origSoftDelete = VehicleModel.softDelete;

      try {
        VehicleModel.softDelete = async () => false;

        const req = {
          params: { id: 'inexistente_000' },
        } as unknown as Request;

        const res = createMockResponse();
        await VehicleController.delete(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
      } finally {
        VehicleModel.softDelete = origSoftDelete;
      }
    });
  });
});
