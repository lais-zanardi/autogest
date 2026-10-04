import { Request, Response } from 'express';
import { VehicleModel } from '../models/vehicleModel';
import { UserModel } from '../models/userModel';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { FipeService } from '../services/fipeService';

export class VehicleController {
  static async resolveUserId(req: AuthenticatedRequest): Promise<string> {
    if (req.firebaseUser?.uid) {
      let user = await UserModel.findByFirebaseUid(req.firebaseUser.uid);
      if (!user) {
        user = await UserModel.create(
          req.firebaseUser.uid,
          req.firebaseUser.name || 'Motorista',
          req.firebaseUser.email,
        );
      }
      return user.id;
    }
    return (req.body?.userId as string) || (req.params?.userId as string) || 'default_user';
  }

  static async listMine(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = await VehicleController.resolveUserId(req);
      const vehicles = await VehicleModel.findByUserId(userId);
      return res.status(200).json({ success: true, data: vehicles });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const vehicles = await VehicleModel.findByUserId(userId);
      return res.status(200).json({ success: true, data: vehicles });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const vehicle = await VehicleModel.findById(id);
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Veículo não encontrado' });
      }
      return res.status(200).json({ success: true, data: vehicle });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        brand,
        model,
        year,
        plate,
        fuelType,
        tankCapacityL,
        preferredFuel,
        initialOdometer,
      } = req.body;

      if (!model || !year || !plate || (!tankCapacityL && tankCapacityL !== 0)) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: modelo, ano, placa e capacidade do tanque.',
        });
      }

      const userId = await VehicleController.resolveUserId(req);

      const vehicle = await VehicleModel.create(userId, {
        name,
        brand,
        model,
        year: Number(year),
        plate,
        fuelType: fuelType || preferredFuel,
        tankCapacityL: Number(tankCapacityL),
        preferredFuel: preferredFuel || fuelType || 'Gasolina',
        initialOdometer: Number(initialOdometer) || 0,
      });

      // Tentar atualizar valor FIPE em segundo plano se houver marca e modelo
      if (brand && model && year) {
        FipeService.getVehicleValue(brand, model, Number(year))
          .then(fipeValue => {
            if (fipeValue) {
              VehicleModel.updateFipeValue(vehicle.id, fipeValue).catch(() => {});
            }
          })
          .catch(() => {});
      }

      return res.status(201).json({ success: true, data: vehicle });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const vehicle = await VehicleModel.update(id, req.body);
      if (!vehicle) {
        return res
          .status(404)
          .json({ success: false, message: 'Veículo não encontrado para atualização' });
      }
      return res.status(200).json({ success: true, data: vehicle });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await VehicleModel.softDelete(id);
      if (!success) {
        return res
          .status(404)
          .json({ success: false, message: 'Veículo não encontrado ou já excluído' });
      }
      return res.status(200).json({ success: true, message: 'Veículo excluído com sucesso' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
