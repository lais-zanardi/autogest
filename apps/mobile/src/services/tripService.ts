import { Trip, CreateTripDTO, Refuel, Expense, TripSummary } from '@autogest/shared-types';
import { TripRepository } from '../repositories/TripRepository';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { OdometerService } from './odometerService';
import { resumoDaViagem, validarFinalizacaoViagem } from './tripCalculations';

export class TripService {
  /**
   * US07.2: Iniciar viagem.
   * Valida se já existe uma viagem em andamento para o veículo selecionado.
   * Se km inicial não for informado, adota o km atual do veículo.
   */
  static async iniciarViagem(dto: CreateTripDTO): Promise<Trip> {
    const ativa = await TripRepository.findActiveByVehicle(dto.vehicleId);
    if (ativa) {
      throw new Error(
        `O veículo já possui uma viagem em andamento de "${ativa.origin}" para "${ativa.destination}". Finalize-a antes de iniciar outra.`,
      );
    }

    let startOdometer = dto.startOdometer;
    if (startOdometer === undefined || startOdometer === null || startOdometer <= 0) {
      const v = await VehicleRepository.findById(dto.vehicleId);
      startOdometer = v?.currentOdometer || v?.initialOdometer || 0;
    }

    return TripRepository.create({
      ...dto,
      startOdometer,
    });
  }

  /**
   * US07.4: Finalizar viagem.
   * Valida km final com validarFinalizacaoViagem / validarNovoKm.
   * Atualiza hodômetro do veículo e registra a leitura com origem manual/viagem.
   */
  static async finalizarViagem(tripId: string, kmFinal: number): Promise<Trip> {
    const trip = await TripRepository.findById(tripId);
    if (!trip) {
      throw new Error('Viagem não encontrada.');
    }
    if (trip.status !== 'em_andamento') {
      throw new Error('Esta viagem já foi finalizada ou cancelada.');
    }

    const kmInicial = Number(trip.startOdometer || 0);
    const validacao = validarFinalizacaoViagem(kmInicial, kmFinal);
    if (!validacao.isValid) {
      throw new Error(validacao.error || 'Quilometragem final inválida.');
    }

    const now = new Date().toISOString();
    const updated = await TripRepository.update(tripId, {
      endOdometer: kmFinal,
      endDate: now,
      status: 'finalizada',
    });

    if (!updated) {
      throw new Error('Falha ao atualizar viagem.');
    }

    // Grava a leitura de hodômetro e atualiza km atual do veículo (US07.4)
    await OdometerService.updateManualOdometer(trip.vehicleId, kmFinal, now);

    return updated;
  }

  /**
   * Cancela uma viagem em andamento sem gerar odômetro final
   */
  static async cancelarViagem(tripId: string): Promise<Trip> {
    const updated = await TripRepository.update(tripId, {
      status: 'cancelada',
      endDate: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Falha ao cancelar viagem.');
    }
    return updated;
  }

  /**
   * US07.3: Retorna a viagem atualmente ativa do veículo para vínculo automático
   */
  static async obterViagemAtiva(vehicleId: string): Promise<Trip | null> {
    return TripRepository.findActiveByVehicle(vehicleId);
  }

  /**
   * Lista todas as viagens de um veículo
   */
  static async listarViagens(vehicleId: string): Promise<Trip[]> {
    return TripRepository.listByVehicle(vehicleId);
  }

  /**
   * US07.5: Calcula o resumo completo da viagem com abastecimentos e despesas
   */
  static async obterResumoViagem(tripId: string): Promise<{
    viagem: Trip;
    resumo: TripSummary;
    abastecimentos: Refuel[];
    despesas: Expense[];
  }> {
    const trip = await TripRepository.findById(tripId);
    if (!trip) {
      throw new Error('Viagem não encontrada.');
    }

    const todosRefuels = await RefuelRepository.listByVehicle(trip.vehicleId);
    const todasDespesas = await ExpenseRepository.listByVehicle(trip.vehicleId);

    const refuelsViagem = todosRefuels.filter(
      r => r.tripId === trip.id || (r as any).viagem_id === trip.id,
    );
    const despesasViagem = todasDespesas.filter(
      e => e.tripId === trip.id || (e as any).viagem_id === trip.id,
    );

    const resumo = resumoDaViagem(trip, refuelsViagem, despesasViagem);

    return {
      viagem: trip,
      resumo,
      abastecimentos: refuelsViagem,
      despesas: despesasViagem,
    };
  }
}
