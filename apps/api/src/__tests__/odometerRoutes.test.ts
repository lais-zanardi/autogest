import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { OdometerController } from '../controllers/odometerController';
import { OdometerModel } from '../models/odometerModel';
import { VehicleModel } from '../models/vehicleModel';
import { UserModel } from '../models/userModel';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { OdometerReading, Vehicle } from '@autogest/shared-types';

describe('US06 - API de Hodômetro & Atualização Manual', () => {
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

  const mockReading: OdometerReading = {
    id: 'odo_test_001',
    vehicleId: mockVehicle.id,
    km: 10500,
    date: '2026-10-04T10:00:00.000Z',
    origin: 'manual',
    createdAt: new Date().toISOString(),
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
    it('deve retornar 401 ao tentar acessar rotas de hodômetro sem token de autorização', async () => {
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

  describe('OdometerController.create', () => {
    it('deve rejeitar requisição sem vehicleId ou com km inválido/menor ou igual a zero (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          km: -100,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await OdometerController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
      assert.match(res.getBody().message, /Campos obrigatórios inválidos/i);
    });

    it('deve retornar 404 quando o veículo não existir', async () => {
      const origFind = VehicleModel.findById;
      VehicleModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: 'non_existent',
            km: 11000,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.create(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
      } finally {
        VehicleModel.findById = origFind;
      }
    });

    it('deve retornar 403 se o veículo pertencer a outro usuário', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;

      VehicleModel.findById = async () => mockOtherVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockOtherVehicle.id,
            km: 6000,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.create(req, res);

        assert.equal(res.getStatusCode(), 403);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /Acesso negado/i);
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });

    it('deve rejeitar km menor que o consolidado informando o último valor na mensagem (400)', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;

      VehicleModel.findById = async () => mockVehicle; // 10.000 km
      UserModel.findByFirebaseUid = async () => mockUser;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockVehicle.id,
            km: 9500,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.create(req, res);

        assert.equal(res.getStatusCode(), 400);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /10\.?000|10000/);
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });

    it('deve rejeitar km igual ao consolidado informando o último valor na mensagem (400)', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;

      VehicleModel.findById = async () => mockVehicle; // 10.000 km
      UserModel.findByFirebaseUid = async () => mockUser;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockVehicle.id,
            km: 10000,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.create(req, res);

        assert.equal(res.getStatusCode(), 400);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /10\.?000|10000/);
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });

    it('deve gravar leitura manual com sucesso e atualizar odômetro do veículo (201)', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origCreateOdo = OdometerModel.create;
      const origUpdateVehicleOdo = VehicleModel.updateCurrentOdometer;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;

      let createdReading: any = null;
      OdometerModel.create = async dto => {
        createdReading = {
          id: 'odo_new_123',
          vehicleId: dto.vehicleId,
          km: dto.km,
          date: dto.date || new Date().toISOString(),
          origin: dto.origin,
          createdAt: new Date().toISOString(),
        };
        return createdReading;
      };

      let vehicleOdometerUpdated = 0;
      VehicleModel.updateCurrentOdometer = async (_id, odo) => {
        vehicleOdometerUpdated = odo;
      };

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockVehicle.id,
            km: 10850,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.create(req, res);

        assert.equal(res.getStatusCode(), 201);
        assert.equal(res.getBody().success, true);
        assert.equal(createdReading.km, 10850);
        assert.equal(createdReading.origin, 'manual');
        assert.equal(vehicleOdometerUpdated, 10850);
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
        OdometerModel.create = origCreateOdo;
        VehicleModel.updateCurrentOdometer = origUpdateVehicleOdo;
      }
    });
  });

  describe('OdometerController.listByVehicle', () => {
    it('deve retornar 404 quando o veículo não existir', async () => {
      const origFind = VehicleModel.findById;
      VehicleModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: 'non_existent' },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 404);
      } finally {
        VehicleModel.findById = origFind;
      }
    });

    it('deve retornar 403 se o veículo pertencer a outro usuário', async () => {
      const origFind = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      VehicleModel.findById = async () => mockOtherVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: mockOtherVehicle.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 403);
      } finally {
        VehicleModel.findById = origFind;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });

    it('deve listar leituras do veículo com sucesso (200)', async () => {
      const origFind = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origList = OdometerModel.findByVehicleId;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;
      OdometerModel.findByVehicleId = async () => [mockReading];

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: mockVehicle.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await OdometerController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.length, 1);
        assert.equal(res.getBody().data[0].km, 10500);
      } finally {
        VehicleModel.findById = origFind;
        UserModel.findByFirebaseUid = origFindUser;
        OdometerModel.findByVehicleId = origList;
      }
    });
  });
});
