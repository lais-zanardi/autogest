import { Request, Response } from 'express';
import { OdometerModel } from '../models/odometerModel';
import { VehicleModel } from '../models/vehicleModel';
import { VehicleController } from './vehicleController';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class OdometerController {
  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      const { vehicleId, km, date, origin } = payload;

      if (!vehicleId || typeof km !== 'number' || isNaN(km) || km <= 0) {
        return res.status(400).json({
          success: false,
          message:
            'Campos obrigatórios inválidos: informe o ID do veículo e uma quilometragem maior que zero.',
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

      const lastKm = vehicle.currentOdometer ?? vehicle.initialOdometer ?? 0;
      if (lastKm > 0 && km <= lastKm) {
        const ultimoFormatado = lastKm.toLocaleString('pt-BR');
        return res.status(400).json({
          success: false,
          message: `A quilometragem informada (${km.toLocaleString('pt-BR')} km) deve ser estritamente superior ao último registro (${ultimoFormatado} km).`,
        });
      }

      const reading = await OdometerModel.create({
        vehicleId,
        km,
        date: date || new Date().toISOString(),
        origin: origin || 'manual',
      });

      await VehicleModel.updateCurrentOdometer(vehicleId, km);

      return res.status(201).json({
        success: true,
        data: reading,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

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

      const readings = await OdometerModel.findByVehicleId(vehicleId);
      return res.status(200).json({ success: true, data: readings });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
