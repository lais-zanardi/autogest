import { Request, Response } from 'express';
import { RefuelModel } from '../models/refuelModel';
import { VehicleModel } from '../models/vehicleModel';
import { OdometerModel } from '../models/odometerModel';
import { VehicleController } from './vehicleController';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { calculateKml } from '../utils/consumptionCalc';
import { generateDashboardStats } from '../utils/reportGenerator';
import { OCRService } from '../services/ocrService';
import { OWMService } from '../services/owmService';
import { ANPService } from '../services/anpService';

export class RefuelController {
  static async listByVehicle(req: Request, res: Response) {
    try {
      const { vehicleId } = req.params;
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Veículo não encontrado' });
      }

      const userId = await VehicleController.resolveUserId(req as AuthenticatedRequest);
      if (vehicle.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado: veículo pertence a outro usuário',
        });
      }

      const refuels = await RefuelModel.findByVehicleId(vehicleId);
      const stats = generateDashboardStats(refuels);
      return res.status(200).json({ success: true, data: refuels, stats });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const refuel = await RefuelModel.findById(id);
      if (!refuel) {
        return res.status(404).json({ success: false, message: 'Abastecimento não encontrado' });
      }

      const vehicle = await VehicleModel.findById(refuel.vehicleId);
      if (vehicle) {
        const userId = await VehicleController.resolveUserId(req as AuthenticatedRequest);
        if (vehicle.userId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado: veículo pertence a outro usuário',
          });
        }
      }

      return res.status(200).json({ success: true, data: refuel });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      const { vehicleId, odometer, fuelType, liters, pricePerLiter, totalValue } = payload;

      if (
        !vehicleId ||
        !fuelType ||
        typeof odometer !== 'number' ||
        odometer <= 0 ||
        typeof liters !== 'number' ||
        liters <= 0 ||
        typeof pricePerLiter !== 'number' ||
        pricePerLiter <= 0 ||
        typeof totalValue !== 'number' ||
        totalValue <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Campos obrigatórios inválidos: informe veículo, odômetro, tipo de combustível, litros, valor por litro e total maiores que zero.',
        });
      }

      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Veículo não encontrado' });
      }

      const userId = await VehicleController.resolveUserId(req as AuthenticatedRequest);
      if (vehicle.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado: veículo pertence a outro usuário',
        });
      }

      let calculatedKml: number | null = null;
      if (payload.isFullTank !== false) {
        const lastFullTank = await RefuelModel.findLastFullTank(vehicleId, odometer);
        if (lastFullTank) {
          calculatedKml = calculateKml(odometer, Number(lastFullTank.odometer), liters);
        }
      }

      const refuel = await RefuelModel.create(payload, calculatedKml);
      await VehicleModel.updateCurrentOdometer(vehicleId, odometer);

      // US05.6: Grava leitura de hodômetro associada ao abastecimento
      await OdometerModel.create({
        vehicleId,
        km: odometer,
        date: payload.date || refuel.date,
        origin: 'abastecimento',
      });

      // Log climatológico assíncrono se coordenadas fornecidas
      if (payload.latitude && payload.longitude) {
        OWMService.getWeatherByCoordinates(payload.latitude, payload.longitude);
      }

      // Consulta média ANP para feedback visual
      let meta: any = undefined;
      try {
        const avgAnpPrice = await ANPService.getAveragePrice('SP', payload.fuelType);
        const priceComparison =
          payload.pricePerLiter <= avgAnpPrice ? 'Abaixo ou na média ANP' : 'Acima da média ANP';
        meta = { avgAnpPrice, priceComparison };
      } catch {
        // Ignora falhas de serviço externo
      }

      return res.status(201).json({
        success: true,
        data: refuel,
        meta,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await RefuelModel.findById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Abastecimento não encontrado para atualização' });
      }

      const vehicle = await VehicleModel.findById(existing.vehicleId);
      if (vehicle) {
        const userId = await VehicleController.resolveUserId(req as AuthenticatedRequest);
        if (vehicle.userId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado: veículo pertence a outro usuário',
          });
        }
      }

      const updated = await RefuelModel.update(id, req.body);
      if (req.body.odometer) {
        await VehicleModel.updateCurrentOdometer(existing.vehicleId, req.body.odometer);
      }

      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await RefuelModel.findById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Abastecimento não encontrado ou já excluído' });
      }

      const vehicle = await VehicleModel.findById(existing.vehicleId);
      if (vehicle) {
        const userId = await VehicleController.resolveUserId(req as AuthenticatedRequest);
        if (vehicle.userId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado: veículo pertence a outro usuário',
          });
        }
      }

      await RefuelModel.softDelete(id);
      return res.status(200).json({ success: true, message: 'Abastecimento excluído com sucesso' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async scanReceipt(req: Request, res: Response) {
    try {
      const { imageBase64 } = req.body;
      const scanData = await OCRService.scanReceipt(imageBase64);
      return res.status(200).json({ success: true, data: scanData });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
