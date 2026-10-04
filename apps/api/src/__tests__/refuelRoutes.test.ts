import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { RefuelController } from '../controllers/refuelController';
import { RefuelModel } from '../models/refuelModel';
import { VehicleModel } from '../models/vehicleModel';
import { UserModel } from '../models/userModel';
import { OdometerModel } from '../models/odometerModel';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { OCRService } from '../services/ocrService';
import { ANPService } from '../services/anpService';
import { Refuel, Vehicle } from '@autogest/shared-types';

describe('US05 - API de Abastecimentos & Controle de Acesso', () => {
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

  const mockRefuel: Refuel = {
    id: 'ref_test_001',
    vehicleId: mockVehicle.id,
    date: '2026-10-01T10:00:00.000Z',
    odometer: 10000,
    fuelType: 'Gasolina',
    pricePerLiter: 5.89,
    totalValue: 265.05,
    liters: 45,
    isFullTank: true,
    calculatedKml: null,
    receiptImageUrl: null,
    stationName: 'Posto Shell',
    latitude: -23.55052,
    longitude: -46.633308,
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
    it('deve retornar 401 ao tentar acessar rotas de abastecimento sem token de autorização', async () => {
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

  describe('RefuelController.create', () => {
    it('deve rejeitar cadastro quando campos obrigatórios estiverem ausentes ou inválidos (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          // vehicleId, odometer, liters ausentes
          fuelType: 'Gasolina',
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await RefuelController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
      assert.match(res.getBody().message, /Campos obrigatórios inválidos/i);
    });

    it('deve rejeitar cadastro quando litros ou valor por litro forem menores ou iguais a zero (400)', async () => {
      const req = {
        firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
        body: {
          vehicleId: mockVehicle.id,
          odometer: 10500,
          fuelType: 'Gasolina',
          liters: 0,
          pricePerLiter: -5,
          totalValue: 200,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      await RefuelController.create(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.equal(res.getBody().success, false);
    });

    it('deve retornar 404 quando o veículo informado não existir', async () => {
      const origFindVehicle = VehicleModel.findById;
      VehicleModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: 'non_existent_vehicle',
            odometer: 10500,
            fuelType: 'Gasolina',
            liters: 40,
            pricePerLiter: 5.9,
            totalValue: 236,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.create(req, res);

        assert.equal(res.getStatusCode(), 404);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /Veículo não encontrado/i);
      } finally {
        VehicleModel.findById = origFindVehicle;
      }
    });

    it('deve retornar 403 quando o veículo pertencer a outro usuário', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;

      VehicleModel.findById = async () => mockOtherVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockOtherVehicle.id,
            odometer: 6000,
            fuelType: 'Gasolina',
            liters: 40,
            pricePerLiter: 5.5,
            totalValue: 220,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.create(req, res);

        assert.equal(res.getStatusCode(), 403);
        assert.equal(res.getBody().success, false);
        assert.match(res.getBody().message, /Acesso negado/i);
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });

    it('deve cadastrar abastecimento com sucesso, calcular consumo km/l e atualizar odômetro e leituras (201)', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origLastFull = RefuelModel.findLastFullTank;
      const origCreateRefuel = RefuelModel.create;
      const origUpdateOdo = VehicleModel.updateCurrentOdometer;
      const origCreateOdo = OdometerModel.create;
      const origAnp = ANPService.getAveragePrice;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;
      RefuelModel.findLastFullTank = async () => mockRefuel; // 10.000 km anterior

      let createdWithKml: number | null | undefined = undefined;
      RefuelModel.create = async (dto, kml) => {
        createdWithKml = kml;
        return {
          id: 'ref_test_002',
          ...dto,
          isFullTank: dto.isFullTank ?? true,
          calculatedKml: kml,
          createdAt: new Date().toISOString(),
        } as Refuel;
      };

      let vehicleOdometerUpdated = 0;
      VehicleModel.updateCurrentOdometer = async (_id, odo) => {
        vehicleOdometerUpdated = odo;
      };

      let odometerReadingCreated = false;
      OdometerModel.create = async dto => {
        odometerReadingCreated = true;
        return {
          id: 'odo_001',
          vehicleId: dto.vehicleId,
          km: dto.km,
          date: dto.date || new Date().toISOString(),
          origin: dto.origin,
          createdAt: new Date().toISOString(),
        };
      };

      ANPService.getAveragePrice = async () => 6.1;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockVehicle.id,
            odometer: 10500, // 500 km rodados
            fuelType: 'Gasolina',
            liters: 40, // 500 / 40 = 12,5 km/l
            pricePerLiter: 5.9,
            totalValue: 236,
            isFullTank: true,
            latitude: -23.55052,
            longitude: -46.633308,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.create(req, res);

        assert.equal(res.getStatusCode(), 201);
        assert.equal(res.getBody().success, true);
        assert.equal(createdWithKml, 12.5); // Critério BDD
        assert.equal(vehicleOdometerUpdated, 10500);
        assert.equal(odometerReadingCreated, true);
        assert.ok(res.getBody().data);
        assert.equal(res.getBody().meta?.priceComparison, 'Abaixo ou na média ANP');
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
        RefuelModel.findLastFullTank = origLastFull;
        RefuelModel.create = origCreateRefuel;
        VehicleModel.updateCurrentOdometer = origUpdateOdo;
        OdometerModel.create = origCreateOdo;
        ANPService.getAveragePrice = origAnp;
      }
    });

    it('deve cadastrar abastecimento sem coordenadas GPS com sucesso (201)', async () => {
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origCreateRefuel = RefuelModel.create;
      const origUpdateOdo = VehicleModel.updateCurrentOdometer;
      const origCreateOdo = OdometerModel.create;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;
      RefuelModel.create = async dto => ({
        id: 'ref_no_gps',
        ...dto,
        isFullTank: dto.isFullTank ?? true,
        latitude: null,
        longitude: null,
        createdAt: new Date().toISOString(),
      });
      VehicleModel.updateCurrentOdometer = async () => {};
      OdometerModel.create = async dto => ({
        id: 'odo_002',
        vehicleId: dto.vehicleId,
        km: dto.km,
        date: new Date().toISOString(),
        origin: dto.origin,
        createdAt: new Date().toISOString(),
      });

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: {
            vehicleId: mockVehicle.id,
            odometer: 11000,
            fuelType: 'Gasolina',
            liters: 30,
            pricePerLiter: 5.8,
            totalValue: 174,
            latitude: null,
            longitude: null,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.create(req, res);

        assert.equal(res.getStatusCode(), 201);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.latitude, null);
      } finally {
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
        RefuelModel.create = origCreateRefuel;
        VehicleModel.updateCurrentOdometer = origUpdateOdo;
        OdometerModel.create = origCreateOdo;
      }
    });
  });

  describe('RefuelController.listByVehicle', () => {
    it('deve retornar 404 quando o veículo não existir', async () => {
      const origFind = VehicleModel.findById;
      VehicleModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: 'non_existent' },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.listByVehicle(req, res);

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
        await RefuelController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 403);
      } finally {
        VehicleModel.findById = origFind;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });

    it('deve listar abastecimentos e calcular estatísticas com sucesso (200)', async () => {
      const origFind = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origList = RefuelModel.findByVehicleId;

      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;
      RefuelModel.findByVehicleId = async () => [mockRefuel];

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { vehicleId: mockVehicle.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.listByVehicle(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.length, 1);
        assert.ok(res.getBody().stats);
      } finally {
        VehicleModel.findById = origFind;
        UserModel.findByFirebaseUid = origFindUser;
        RefuelModel.findByVehicleId = origList;
      }
    });
  });

  describe('RefuelController.getById', () => {
    it('deve retornar 404 quando o abastecimento não for encontrado', async () => {
      const origFind = RefuelModel.findById;
      RefuelModel.findById = async () => null;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: 'non_existent_refuel' },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.getById(req, res);

        assert.equal(res.getStatusCode(), 404);
      } finally {
        RefuelModel.findById = origFind;
      }
    });

    it('deve retornar os dados do abastecimento quando encontrado (200)', async () => {
      const origFindRefuel = RefuelModel.findById;
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;

      RefuelModel.findById = async () => mockRefuel;
      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: mockRefuel.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.getById(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.id, mockRefuel.id);
      } finally {
        RefuelModel.findById = origFindRefuel;
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
      }
    });
  });

  describe('RefuelController.update', () => {
    it('deve atualizar o abastecimento com sucesso (200)', async () => {
      const origFindRefuel = RefuelModel.findById;
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origUpdate = RefuelModel.update;

      RefuelModel.findById = async () => mockRefuel;
      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;
      RefuelModel.update = async (id, data) => ({ ...mockRefuel, ...data, id });

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: mockRefuel.id },
          body: {
            pricePerLiter: 5.95,
            totalValue: 267.75,
          },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.update(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.pricePerLiter, 5.95);
      } finally {
        RefuelModel.findById = origFindRefuel;
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
        RefuelModel.update = origUpdate;
      }
    });
  });

  describe('RefuelController.delete', () => {
    it('deve realizar soft delete do abastecimento com sucesso (200)', async () => {
      const origFindRefuel = RefuelModel.findById;
      const origFindVehicle = VehicleModel.findById;
      const origFindUser = UserModel.findByFirebaseUid;
      const origDelete = RefuelModel.softDelete;

      RefuelModel.findById = async () => mockRefuel;
      VehicleModel.findById = async () => mockVehicle;
      UserModel.findByFirebaseUid = async () => mockUser;
      RefuelModel.softDelete = async () => true;

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          params: { id: mockRefuel.id },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.delete(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.match(res.getBody().message, /excluído com sucesso/i);
      } finally {
        RefuelModel.findById = origFindRefuel;
        VehicleModel.findById = origFindVehicle;
        UserModel.findByFirebaseUid = origFindUser;
        RefuelModel.softDelete = origDelete;
      }
    });
  });

  describe('RefuelController.scanReceipt (OCR)', () => {
    it('deve extrair dados de cupom fiscal via OCR (200)', async () => {
      const origOcr = OCRService.scanReceipt;
      OCRService.scanReceipt = async () => ({
        stationName: 'Ipiranga',
        fuelType: 'Gasolina',
        liters: 35.5,
        pricePerLiter: 5.79,
        totalValue: 205.54,
        confidenceScore: 0.95,
      });

      try {
        const req = {
          firebaseUser: { uid: mockUser.firebaseUid, email: mockUser.email },
          body: { imageBase64: 'fake_base64_data' },
        } as unknown as AuthenticatedRequest;

        const res = createMockResponse();
        await RefuelController.scanReceipt(req, res);

        assert.equal(res.getStatusCode(), 200);
        assert.equal(res.getBody().success, true);
        assert.equal(res.getBody().data.stationName, 'Ipiranga');
        assert.equal(res.getBody().data.liters, 35.5);
      } finally {
        OCRService.scanReceipt = origOcr;
      }
    });
  });
});
