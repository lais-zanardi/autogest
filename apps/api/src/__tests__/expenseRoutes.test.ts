import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { ExpenseController } from '../controllers/expenseController';
import { ExpenseModel } from '../models/expenseModel';
import { VehicleModel } from '../models/vehicleModel';
import { UserModel } from '../models/userModel';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { Expense, Vehicle } from '@autogest/shared-types';

describe('US22 - API de Despesas por Categoria', () => {
  const mockUser = {
    id: 'usr_test_12345',
    firebaseUid: 'firebase_user_abc',
    name: 'Motorista AutoGest',
    email: 'motorista@autogest.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOtherUser = {
    id: 'usr_other_99999',
    firebaseUid: 'firebase_user_other',
    name: 'Outro Usuário',
    email: 'outro@autogest.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockVehicle: Vehicle = {
    id: 'veh_test_001',
    userId: mockUser.id,
    brand: 'Honda',
    model: 'Civic',
    year: 2020,
    plate: 'BRA2E19',
    fuelType: 'Gasolina',
    tankCapacityL: 56,
    preferredFuel: 'Gasolina',
    initialOdometer: 10000,
    currentOdometer: 10000,
    fipeValue: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const mockOtherVehicle: Vehicle = {
    id: 'veh_other_002',
    userId: mockOtherUser.id,
    brand: 'Fiat',
    model: 'Pulse',
    year: 2022,
    plate: 'PUL2022',
    fuelType: 'Flex',
    tankCapacityL: 47,
    preferredFuel: 'Gasolina',
    initialOdometer: 5000,
    currentOdometer: 5000,
    fipeValue: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const mockExpense: Expense = {
    id: 'exp_test_001',
    vehicleId: mockVehicle.id,
    category: 'Lavagem',
    amount: 50,
    date: '2026-10-15T10:00:00.000Z',
    description: 'Lavagem completa com cera',
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
    it('deve retornar 401 ao tentar acessar rotas de despesas sem token de autorização', async () => {
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

  describe('ExpenseController.create', () => {
    it('deve rejeitar requisição com campos obrigatórios ausentes ou inválidos (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          category: 'Lavagem',
          amount: -50,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await ExpenseController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
      assert.match(res.getBody().message, /Campos obrigatórios inválidos/i);
    });

    it('deve rejeitar tentativa de lançar Combustível ou Manutenção no formulário manual (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          vehicleId: mockVehicle.id,
          category: 'Combustível',
          amount: 150,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await ExpenseController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
      assert.match(res.getBody().message, /duplicidade/i);
    });

    it('deve rejeitar categoria não cadastrada nas categorias manuais (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          vehicleId: mockVehicle.id,
          category: 'ViagemInvalida',
          amount: 150,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await ExpenseController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
      assert.match(res.getBody().message, /Categoria inválida/i);
    });

    it('deve retornar 404 quando o veículo não existir', async () => {
      const originalFindById = VehicleModel.findById;
      VehicleModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: 'veh_inexistente',
            category: 'Lavagem',
            amount: 50,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.create(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /Veículo não encontrado/i);
      } finally {
        VehicleModel.findById = originalFindById;
      }
    });

    it('deve retornar 403 se o veículo pertencer a outro usuário (tenant isolation)', async () => {
      const originalFindById = VehicleModel.findById;
      const originalFindByFirebaseUid = UserModel.findByFirebaseUid;

      VehicleModel.findById = async () => mockOtherVehicle;
      UserModel.findByFirebaseUid = async () => mockUser as any;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockOtherVehicle.id,
            category: 'Seguro',
            amount: 250,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.create(req, res);

        assert.equal(res.getStatusCode(), 403);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /Acesso negado/i);
      } finally {
        VehicleModel.findById = originalFindById;
        UserModel.findByFirebaseUid = originalFindByFirebaseUid;
      }
    });

    it('deve cadastrar despesa com sucesso e retornar 201', async () => {
      const originalFindById = VehicleModel.findById;
      const originalFindByFirebaseUid = UserModel.findByFirebaseUid;
      const originalCreate = ExpenseModel.create;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser as any;
      ExpenseModel.create = async () => mockExpense;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockVehicle.id,
            category: 'Lavagem',
            amount: 50,
            date: '2026-10-15T10:00:00.000Z',
            description: 'Lavagem completa com cera',
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.create(req, res);

        assert.equal(res.getStatusCode(), 201);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.amount, 50);
        assert.equal(res.getBody().data.category, 'Lavagem');
      } finally {
        VehicleModel.findById = originalFindById;
        UserModel.findByFirebaseUid = originalFindByFirebaseUid;
        ExpenseModel.create = originalCreate;
      }
    });
  });

  describe('ExpenseController.listByVehicle', () => {
    it('deve listar despesas do veículo com status 200', async () => {
      const originalFindById = VehicleModel.findById;
      const originalFindByFirebaseUid = UserModel.findByFirebaseUid;
      const originalFindByVehicleId = ExpenseModel.findByVehicleId;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser as any;
      ExpenseModel.findByVehicleId = async () => [mockExpense];

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: mockVehicle.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.length, 1);
        assert.equal(res.getBody().data[0].id, mockExpense.id);
      } finally {
        VehicleModel.findById = originalFindById;
        UserModel.findByFirebaseUid = originalFindByFirebaseUid;
        ExpenseModel.findByVehicleId = originalFindByVehicleId;
      }
    });

    it('deve retornar 403 se o veículo pertencer a outro usuário na listagem', async () => {
      const originalFindById = VehicleModel.findById;
      const originalFindByFirebaseUid = UserModel.findByFirebaseUid;

      VehicleModel.findById = async () => mockOtherVehicle;
      UserModel.findByFirebaseUid = async () => mockUser as any;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: mockOtherVehicle.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 403);
        assert.equal(res.getBody().success, false);
      } finally {
        VehicleModel.findById = originalFindById;
        UserModel.findByFirebaseUid = originalFindByFirebaseUid;
      }
    });
  });

  describe('ExpenseController.update', () => {
    it('deve atualizar despesa existente com sucesso e retornar 200', async () => {
      const originalExpenseFind = ExpenseModel.findById;
      const originalVehicleFind = VehicleModel.findById;
      const originalUserFind = UserModel.findByFirebaseUid;
      const originalUpdate = ExpenseModel.update;

      ExpenseModel.findById = async () => mockExpense;
      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser as any;
      ExpenseModel.update = async (id, data) => ({
        ...mockExpense,
        amount: data.amount ?? mockExpense.amount,
        description: data.description ?? mockExpense.description,
      });

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: mockExpense.id },
          body: {
            amount: 65,
            description: 'Lavagem completa com cera e aspiração',
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.update(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.amount, 65);
      } finally {
        ExpenseModel.findById = originalExpenseFind;
        VehicleModel.findById = originalVehicleFind;
        UserModel.findByFirebaseUid = originalUserFind;
        ExpenseModel.update = originalUpdate;
      }
    });

    it('deve retornar 404 se a despesa não for encontrada para atualização', async () => {
      const originalExpenseFind = ExpenseModel.findById;
      ExpenseModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: 'exp_inexistente' },
          body: { amount: 50 },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.update(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
      } finally {
        ExpenseModel.findById = originalExpenseFind;
      }
    });
  });

  describe('ExpenseController.delete', () => {
    it('deve excluir despesa com sucesso e retornar 200', async () => {
      const originalExpenseFind = ExpenseModel.findById;
      const originalVehicleFind = VehicleModel.findById;
      const originalUserFind = UserModel.findByFirebaseUid;
      const originalDelete = ExpenseModel.softDelete;

      ExpenseModel.findById = async () => mockExpense;
      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser as any;
      ExpenseModel.softDelete = async () => true;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: mockExpense.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.delete(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.match(res.getBody().message, /excluída com sucesso/i);
      } finally {
        ExpenseModel.findById = originalExpenseFind;
        VehicleModel.findById = originalVehicleFind;
        UserModel.findByFirebaseUid = originalUserFind;
        ExpenseModel.softDelete = originalDelete;
      }
    });

    it('deve retornar 404 se a despesa não existir para exclusão', async () => {
      const originalExpenseFind = ExpenseModel.findById;
      ExpenseModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: 'exp_inexistente' },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await ExpenseController.delete(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
      } finally {
        ExpenseModel.findById = originalExpenseFind;
      }
    });
  });
});
