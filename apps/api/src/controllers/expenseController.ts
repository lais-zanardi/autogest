import { Request, Response } from 'express';
import { ExpenseModel } from '../models/expenseModel';
import { VehicleModel } from '../models/vehicleModel';
import { VehicleController } from './vehicleController';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { MANUAL_EXPENSE_CATEGORIES, ExpenseCategory } from '@autogest/shared-types';

export class ExpenseController {
  static async create(req: Request, res: Response) {
    try {
      const payload = req.body;
      const { vehicleId, category, amount, date, description } = payload;

      if (!vehicleId || !category || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message:
            'Campos obrigatórios inválidos: informe o ID do veículo, uma categoria válida e um valor maior que zero.',
        });
      }

      if (category === 'Combustível' || category === 'Manutenção') {
        return res.status(400).json({
          success: false,
          message:
            'Gastos com Combustível e Manutenção são registrados diretamente em suas telas para evitar duplicidade.',
        });
      }

      if (!MANUAL_EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) {
        return res.status(400).json({
          success: false,
          message: `Categoria inválida. Categorias permitidas: ${MANUAL_EXPENSE_CATEGORIES.join(', ')}.`,
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

      const expense = await ExpenseModel.create({
        vehicleId,
        category,
        amount,
        date: date || new Date().toISOString(),
        description: description?.trim() || null,
      });

      return res.status(201).json({
        success: true,
        data: expense,
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

      const expenses = await ExpenseModel.findByVehicleId(vehicleId);
      return res.status(200).json({ success: true, data: expenses });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const expense = await ExpenseModel.findById(id);
      if (!expense) {
        return res.status(404).json({ success: false, message: 'Despesa não encontrada' });
      }

      const vehicle = await VehicleModel.findById(expense.vehicleId);
      if (vehicle) {
        const userId = await VehicleController.resolveUserId(req as AuthenticatedRequest);
        if (vehicle.userId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado: veículo pertence a outro usuário',
          });
        }
      }

      return res.status(200).json({ success: true, data: expense });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await ExpenseModel.findById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Despesa não encontrada para atualização' });
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

      const { category, amount } = req.body;
      if (amount !== undefined && (typeof amount !== 'number' || isNaN(amount) || amount <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'O valor da despesa deve ser um número maior que zero.',
        });
      }

      if (category !== undefined) {
        if (category === 'Combustível' || category === 'Manutenção') {
          return res.status(400).json({
            success: false,
            message:
              'Gastos com Combustível e Manutenção são registrados diretamente em suas telas para evitar duplicidade.',
          });
        }
        if (!MANUAL_EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) {
          return res.status(400).json({
            success: false,
            message: `Categoria inválida. Categorias permitidas: ${MANUAL_EXPENSE_CATEGORIES.join(', ')}.`,
          });
        }
      }

      const updated = await ExpenseModel.update(id, req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await ExpenseModel.findById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Despesa não encontrada ou já excluída' });
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

      await ExpenseModel.softDelete(id);
      return res.status(200).json({ success: true, message: 'Despesa excluída com sucesso' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
