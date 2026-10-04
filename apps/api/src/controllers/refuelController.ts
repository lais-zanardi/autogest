import { Request, Response } from 'express';
import { RefuelModel } from '../models/refuelModel';
import { VehicleModel } from '../models/vehicleModel';
import { calculateKml } from '../utils/consumptionCalc';
import { generateDashboardStats } from '../utils/reportGenerator';
import { OCRService } from '../services/ocrService';
import { OWMService } from '../services/owmService';
import { ANPService } from '../services/anpService';

export class RefuelController {
  static async listByVehicle(req: Request, res: Response) {
    try {
      const { vehicleId } = req.params;
      const refuels = await RefuelModel.findByVehicleId(vehicleId);
      const stats = generateDashboardStats(refuels);
      return res.status(200).json({ success: true, data: refuels, stats });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      const vehicle = await VehicleModel.findById(payload.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Veículo não encontrado' });
      }

      let calculatedKml: number | null = null;
      if (payload.isFullTank) {
        const lastFullTank = await RefuelModel.findLastFullTank(
          payload.vehicleId,
          payload.odometer,
        );
        if (lastFullTank) {
          calculatedKml = calculateKml(
            payload.odometer,
            Number(lastFullTank.odometer),
            payload.liters,
          );
        }
      }

      const refuel = await RefuelModel.create(payload, calculatedKml);
      await VehicleModel.updateCurrentOdometer(payload.vehicleId, payload.odometer);

      // Log climatológico assíncrono se coordenadas fornecidas
      if (payload.latitude && payload.longitude) {
        OWMService.getWeatherByCoordinates(payload.latitude, payload.longitude);
      }

      // Consulta média ANP para feedback visual
      const avgAnpPrice = await ANPService.getAveragePrice('SP', payload.fuelType);
      const priceComparison =
        payload.pricePerLiter <= avgAnpPrice ? 'Abaixo ou na média ANP' : 'Acima da média ANP';

      return res.status(201).json({
        success: true,
        data: refuel,
        meta: { avgAnpPrice, priceComparison },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
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
