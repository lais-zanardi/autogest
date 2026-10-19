// Polyfill para AsyncStorage em ambiente Node.js / testes
if (typeof (global as any).window === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularIndicadoresUso,
  calcularCustoPorKm,
  calcularIndicadoresUsoECustoPuro,
  obterIndicadoresUsoECustoDoPeriodo,
  resolverIntervaloPeriodo,
} from '../services/usageAndCostIndicators';
import { db } from '../database/DatabaseConnection';
import { VehicleService } from '../services/vehicleService';
import { FuelingService } from '../services/fuelingService';
import { ExpenseService } from '../services/expenseService';
import { MaintenanceService } from '../services/maintenanceService';
import { OdometerService } from '../services/odometerService';
import { useAppStore } from '../store/useAppStore';

describe('US24 — Indicadores de Uso e Custo', () => {
  beforeEach(async () => {
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('veiculos', []);
    await db.saveTableData('local_refuels', []);
    await db.saveTableData('abastecimentos', []);
    await db.saveTableData('local_leituras_hodometro', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('local_despesas', []);
    await db.saveTableData('despesas', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('sync_queue', []);
    await db.saveTableData('fila_sync', []);
    useAppStore.getState().logout();
  });

  describe('US24.1 & US24.4: Funções Puras e Critérios BDD do Backlog', () => {
    it('(BDD Backlog): Dado 900 km rodados em 30 dias, quando consultar o painel, então exibe média de 30 km/dia (e deriva semana e mês)', () => {
      const leituras = [
        { km: 10000, date: '2026-05-01T10:00:00.000Z' },
        { km: 10900, date: '2026-05-31T10:00:00.000Z' }, // 30 dias exatos, 900 km rodados
      ];

      const uso = calcularIndicadoresUso(leituras);

      assert.strictEqual(uso.kmRodados, 900);
      assert.strictEqual(uso.diasNoPeriodo, 30);
      assert.strictEqual(uso.kmPorDia, 30);
      assert.strictEqual(uso.kmPorSemana, 210); // 30 * 7
      assert.strictEqual(uso.kmPorMes, 900); // 30 * 30
      assert.strictEqual(uso.possuiKmRodado, true);
    });

    it('US24.1: Deve exibir o custo/km de combustível separado do custo/km total, e o de manutenção separando preventivas e corretivas', () => {
      // Cenário: 1.000 km rodados
      // Combustível: R$ 500,00 -> R$ 0,50/km
      // Manutenção Preventiva: R$ 200,00 -> R$ 0,20/km
      // Manutenção Corretiva: R$ 150,00 -> R$ 0,15/km
      // Manutenção Total: R$ 350,00 -> R$ 0,35/km
      // Outras despesas (Lavagem + Seguro): R$ 150,00
      // Custo Total: 500 + 350 + 150 = R$ 1.000,00 -> R$ 1,00/km
      const custo = calcularCustoPorKm({
        kmRodados: 1000,
        custoCombustivel: 500,
        manutencoes: [
          { type: 'preventiva', totalValue: 120 },
          { type: 'preventiva', totalValue: 80 },
          { type: 'corretiva', totalValue: 150 },
        ],
        custoOutrasDespesas: 150,
      });

      assert.strictEqual(custo.custoCombustivel, 500);
      assert.strictEqual(custo.custoManutencaoPreventiva, 200);
      assert.strictEqual(custo.custoManutencaoCorretiva, 150);
      assert.strictEqual(custo.custoManutencaoTotal, 350);
      assert.strictEqual(custo.custoOutrasDespesas, 150);
      assert.strictEqual(custo.custoTotal, 1000);

      // Verificação estrita dos custos por km separados
      assert.strictEqual(custo.custoKmCombustivel, 0.5);
      assert.strictEqual(custo.custoKmManutencaoPreventiva, 0.2);
      assert.strictEqual(custo.custoKmManutencaoCorretiva, 0.15);
      assert.strictEqual(custo.custoKmManutencaoTotal, 0.35);
      assert.strictEqual(custo.custoKmTotal, 1.0);
      assert.notStrictEqual(custo.custoKmCombustivel, custo.custoKmTotal);
    });
  });

  describe('US24.3 & US24.4: Casos de Borda — Sem Km Rodado (Divisão por Zero) e Sem Dados', () => {
    it('US24.3: Deve evitar divisão por zero quando kmRodados = 0, mantendo custos absolutos e retornando 0 para todos os custos/km', () => {
      const resultado = calcularIndicadoresUsoECustoPuro({
        inicio: '2026-10-01',
        fim: '2026-10-31',
        leituras: [{ km: 25000, date: '2026-10-05T10:00:00.000Z' }], // Apenas 1 leitura -> 0 km rodados
        abastecimentos: [{ totalValue: 250, odometer: 25000, date: '2026-10-05T10:00:00.000Z' }],
        manutencoes: [
          {
            type: 'preventiva',
            totalValue: 300,
            odometer: 25000,
            date: '2026-10-10T10:00:00.000Z',
          },
        ],
        despesas: [{ amount: 50, category: 'Lavagem', date: '2026-10-12T10:00:00.000Z' }],
      });

      assert.strictEqual(resultado.semDados, false);
      assert.strictEqual(resultado.semKmRodado, true);
      assert.strictEqual(resultado.uso.kmRodados, 0);
      assert.strictEqual(resultado.uso.kmPorDia, 0);
      assert.strictEqual(resultado.uso.kmPorSemana, 0);
      assert.strictEqual(resultado.uso.kmPorMes, 0);

      // Os valores absolutos de gasto existem (250 + 300 + 50 = 600)
      assert.strictEqual(resultado.custo.custoTotal, 600);
      assert.strictEqual(resultado.custo.custoCombustivel, 250);
      assert.strictEqual(resultado.custo.custoManutencaoPreventiva, 300);

      // Porém nenhum custo/km pode ser NaN ou Infinity (divisão por zero prevenida)
      assert.strictEqual(resultado.custo.custoKmTotal, 0);
      assert.strictEqual(resultado.custo.custoKmCombustivel, 0);
      assert.strictEqual(resultado.custo.custoKmManutencaoTotal, 0);
      assert.strictEqual(resultado.custo.custoKmManutencaoPreventiva, 0);
      assert.strictEqual(resultado.custo.custoKmManutencaoCorretiva, 0);
      assert.ok(Number.isFinite(resultado.custo.custoKmTotal));
    });

    it('US24.3: Deve sinalizar semDados = true e semKmRodado = true quando o período não possuir nenhum registro', () => {
      const resultado = calcularIndicadoresUsoECustoPuro({
        inicio: '2026-10-01',
        fim: '2026-10-31',
        leituras: [],
        abastecimentos: [],
        manutencoes: [],
        despesas: [],
      });

      assert.strictEqual(resultado.semDados, true);
      assert.strictEqual(resultado.semKmRodado, true);
      assert.strictEqual(resultado.uso.kmRodados, 0);
      assert.strictEqual(resultado.uso.kmPorDia, 0);
      assert.strictEqual(resultado.custo.custoTotal, 0);
      assert.strictEqual(resultado.custo.custoKmTotal, 0);
    });

    it('US24.3: Deve tratar leituras no mesmo timestamp ou com km regressivo sem gerar valores negativos ou NaN', () => {
      const leiturasMesmoHorario = [
        { km: 15000, date: '2026-10-10T10:00:00.000Z' },
        { km: 15000, date: '2026-10-10T10:00:00.000Z' },
      ];
      const uso = calcularIndicadoresUso(leiturasMesmoHorario);
      assert.strictEqual(uso.kmRodados, 0);
      assert.strictEqual(uso.kmPorDia, 0);
      assert.strictEqual(uso.possuiKmRodado, false);
    });

    it('US24.3: Deve calcular uso e custo/km corretamente quando houver deslocamento positivo no mesmo dia (< 24h)', () => {
      const resultado = calcularIndicadoresUsoECustoPuro({
        inicio: '2026-10-10',
        fim: '2026-10-10',
        leituras: [
          { km: 20000, date: '2026-10-10T08:00:00.000Z' },
          { km: 20100, date: '2026-10-10T18:00:00.000Z' }, // 100 km no mesmo dia
        ],
        abastecimentos: [{ totalValue: 60, odometer: 20100, date: '2026-10-10T18:00:00.000Z' }],
        manutencoes: [],
        despesas: [],
      });

      assert.strictEqual(resultado.semDados, false);
      assert.strictEqual(resultado.semKmRodado, false);
      assert.strictEqual(resultado.uso.kmRodados, 100);
      assert.strictEqual(resultado.uso.kmPorDia, 100);
      assert.strictEqual(resultado.uso.kmPorSemana, 700);
      assert.strictEqual(resultado.uso.kmPorMes, 3000);
      assert.strictEqual(resultado.custo.custoKmTotal, 0.6);
      assert.strictEqual(resultado.custo.custoKmCombustivel, 0.6);
    });
  });

  describe('US24.2: Integração com Repositórios e Filtro de Período (Mês Atual por Padrão)', () => {
    it('deve resolver o mês atual como período padrão no filtro de período', () => {
      const refDate = new Date('2026-10-19T12:00:00.000Z');
      const intervaloPadrao = resolverIntervaloPeriodo('mes_atual', refDate);

      assert.strictEqual(intervaloPadrao.inicio, '2026-10-01');
      assert.strictEqual(intervaloPadrao.fim, '2026-10-31');
    });

    it('deve consolidar indicadores reais do veículo no período integrando hodômetro, abastecimentos, despesas e manutenções (preventiva e corretiva)', async () => {
      const vehicle = await VehicleService.createVehicle({
        brand: 'Volkswagen',
        model: 'Nivus Highline',
        year: 2023,
        plate: 'NIV2E23',
        fuelType: 'Flex',
        tankCapacityL: 52,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      // 1. Leitura manual no início do período: 10.001 km em 01/10/2026
      await OdometerService.updateManualOdometer(vehicle.id, 10001, '2026-10-01T08:00:00.000Z');

      // 2. Abastecimento em 16/10/2026 aos 10.451 km: R$ 270,00
      await FuelingService.createRefuel({
        vehicleId: vehicle.id,
        odometer: 10451,
        liters: 45,
        pricePerLiter: 6.0,
        totalValue: 270,
        fuelType: 'Gasolina',
        isFullTank: true,
        date: '2026-10-16T08:00:00.000Z',
      });

      // 3. Manutenção preventiva em 20/10/2026 aos 10.600 km: R$ 360,00 (troca de óleo e filtros)
      await MaintenanceService.createMaintenance({
        vehicleId: vehicle.id,
        date: '2026-10-20T10:00:00.000Z',
        odometer: 10600,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Revisão preventiva de óleo',
        totalValue: 360,
      });

      // 4. Manutenção corretiva em 31/10/2026 aos 10.901 km: R$ 180,00 (reparo no freio)
      // Total km rodados entre 01/10 (10.001 km) e 31/10 (10.901 km) = 900 km em 30 dias = 30 km/dia!
      await MaintenanceService.createMaintenance({
        vehicleId: vehicle.id,
        date: '2026-10-31T08:00:00.000Z',
        odometer: 10901,
        type: 'corretiva',
        serviceType: 'freios',
        description: 'Troca corretiva de cilindro de roda',
        totalValue: 180,
      });

      // 5. Despesa manual (Lavagem) em 25/10/2026: R$ 90,00
      await ExpenseService.createExpense({
        vehicleId: vehicle.id,
        category: 'Lavagem',
        amount: 90,
        date: '2026-10-25T14:00:00.000Z',
        description: 'Lavagem detalhada',
      });

      const indicadores = await obterIndicadoresUsoECustoDoPeriodo(
        vehicle.id,
        '2026-10-01',
        '2026-10-31',
      );

      // Uso: 900 km em 30 dias = 30 km/dia
      assert.strictEqual(indicadores.semDados, false);
      assert.strictEqual(indicadores.semKmRodado, false);
      assert.strictEqual(indicadores.uso.kmRodados, 900);
      assert.strictEqual(indicadores.uso.kmPorDia, 30);
      assert.strictEqual(indicadores.uso.kmPorSemana, 210);
      assert.strictEqual(indicadores.uso.kmPorMes, 900);

      // Custos absolutos:
      // Combustível = 270 | Preventiva = 360 | Corretiva = 180 | Outras = 90 | Total = 900
      assert.strictEqual(indicadores.custo.custoCombustivel, 270);
      assert.strictEqual(indicadores.custo.custoManutencaoPreventiva, 360);
      assert.strictEqual(indicadores.custo.custoManutencaoCorretiva, 180);
      assert.strictEqual(indicadores.custo.custoManutencaoTotal, 540);
      assert.strictEqual(indicadores.custo.custoOutrasDespesas, 90);
      assert.strictEqual(indicadores.custo.custoTotal, 900);

      // Custos por km para 900 km:
      // Total: 900 / 900 = R$ 1,00/km
      // Combustível: 270 / 900 = R$ 0,30/km
      // Manutenção Preventiva: 360 / 900 = R$ 0,40/km
      // Manutenção Corretiva: 180 / 900 = R$ 0,20/km
      // Manutenção Total: 540 / 900 = R$ 0,60/km
      assert.strictEqual(indicadores.custo.custoKmTotal, 1.0);
      assert.strictEqual(indicadores.custo.custoKmCombustivel, 0.3);
      assert.strictEqual(indicadores.custo.custoKmManutencaoPreventiva, 0.4);
      assert.strictEqual(indicadores.custo.custoKmManutencaoCorretiva, 0.2);
      assert.strictEqual(indicadores.custo.custoKmManutencaoTotal, 0.6);
    });
  });
});
