import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../database/DatabaseConnection';
import {
  validarTelefoneOficina,
  montarUrlLigacaoTelefone,
  calcularTotalGastoOficina,
} from '../services/workshopValidation';
import { WorkshopService } from '../services/workshopService';
import { MaintenanceService } from '../services/maintenanceService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';
import { formatarMoeda } from '../utils/formatters';

describe('US12 — Diretório de Oficinas Favoritas e Histórico de Atendimentos', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('oficinas', []);
    await db.saveTableData('atendimentos_oficina', []);
    await db.saveTableData('manutencoes', []);
    await db.saveTableData('local_manutencoes', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('leituras_hodometro', []);
    await db.saveTableData('fila_sync', []);
  });

  describe('US12.5: Validação de telefone e helpers puros', () => {
    it('aceita telefones brasileiros válidos (10 ou 11 dígitos) e rejeita inválidos', () => {
      assert.strictEqual(validarTelefoneOficina('(11) 98765-4321').valido, true);
      assert.strictEqual(validarTelefoneOficina('1133224455').valido, true);
      assert.strictEqual(validarTelefoneOficina('').valido, true); // opcional
      assert.strictEqual(validarTelefoneOficina('12345').valido, false);
      assert.strictEqual(validarTelefoneOficina('1199999999999').valido, false);
      assert.strictEqual(validarTelefoneOficina('abc-defg').valido, false);

      assert.strictEqual(montarUrlLigacaoTelefone('(11) 98765-4321'), 'tel:11987654321');
    });

    it('calcula total gasto por oficina a partir dos atendimentos e manutenções', () => {
      const total = calcularTotalGastoOficina(
        [
          {
            id: 'a1',
            oficina_id: 'of1',
            manutencao_id: 'm1',
            data: '2026-10-01',
            criado_em: '2026-10-01T10:00:00Z',
            atualizado_em: '2026-10-01T10:00:00Z',
          },
          {
            id: 'a2',
            oficina_id: 'of1',
            manutencao_id: 'm2',
            data: '2026-11-01',
            criado_em: '2026-11-01T10:00:00Z',
            atualizado_em: '2026-11-01T10:00:00Z',
          },
        ],
        [
          { id: 'm1', totalValue: 450.5 } as any,
          { id: 'm2', totalValue: 299.5 } as any,
        ],
      );
      assert.strictEqual(total, 750);
      assert.strictEqual(formatarMoeda(total).replace(/\u00A0/g, ' '), 'R$ 750,00');
    });
  });

  describe('US12.2, US12.3, US12.4 & US12.5: CRUD, vínculo manutenção -> atendimento e exclusão lógica', () => {
    it('cria oficina, favorita, vincula manutenção gerando atendimento e soma total gasto', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'OFI1A23',
        brand: 'Honda',
        model: 'Civic',
        year: 2022,
        tankCapacityL: 50,
        preferredFuel: 'Gasolina',
        initialOdometer: 10000,
      });

      const oficina = await WorkshopService.criarOficina({
        nome: 'Auto Center Paulista',
        telefone: '(11) 98765-4321',
        endereco: 'Av. Paulista, 1000',
        favorita: true,
        observacoes: 'Especialista em Honda',
      });

      assert.ok(oficina.id);
      assert.strictEqual(oficina.favorita, true);

      // Cria manutenção vinculada à oficina cadastrada (US12.3)
      const maint1 = await MaintenanceService.createMaintenance({
        vehicleId: veiculo.id,
        date: '2026-11-10',
        odometer: 12000,
        type: 'preventiva',
        serviceType: 'troca_oleo',
        description: 'Troca de óleo e filtro',
        workshopId: oficina.id,
        totalValue: 320,
      });

      const maint2 = await MaintenanceService.createMaintenance({
        vehicleId: veiculo.id,
        date: '2026-11-20',
        odometer: 12500,
        type: 'corretiva',
        serviceType: 'freios',
        description: 'Pastilhas dianteiras',
        workshopId: oficina.id,
        totalValue: 480,
      });

      assert.strictEqual(maint1.workshopId, oficina.id);
      assert.strictEqual(maint1.workshop, 'Auto Center Paulista');
      assert.strictEqual(maint2.workshopId, oficina.id);

      // Detalhe da oficina com histórico de atendimentos e total gasto (US12.4)
      const detalhe = await WorkshopService.obterDetalheOficina(oficina.id);
      assert.ok(detalhe);
      assert.strictEqual(detalhe.atendimentos.length, 2);
      assert.strictEqual(detalhe.totalGastoReais, 800);
    });

    it('exclusão lógica da oficina oculta da lista ativa mas mantém o histórico de atendimentos', async () => {
      const veiculo = await VehicleRepository.create({
        plate: 'OFI2B34',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2021,
        tankCapacityL: 50,
        preferredFuel: 'Flex',
        initialOdometer: 20000,
      });

      const oficina = await WorkshopService.criarOficina({
        nome: 'Mecânica Confiança',
        telefone: '(11) 3344-5566',
      });

      await MaintenanceService.createMaintenance({
        vehicleId: veiculo.id,
        date: '2026-11-15',
        odometer: 21000,
        type: 'preventiva',
        serviceType: 'filtros',
        description: 'Filtro de ar e cabine',
        workshopId: oficina.id,
        totalValue: 190,
      });

      const excluida = await WorkshopService.excluirOficina(oficina.id);
      assert.strictEqual(excluida, true);

      // Não aparece na lista ativa
      const ativas = await WorkshopService.listarOficinas();
      assert.strictEqual(ativas.length, 0);

      // Histórico de atendimentos permanece preservado
      const atendimentos = await WorkshopService.listarAtendimentosDaOficina(oficina.id);
      assert.strictEqual(atendimentos.length, 1);

      const detalheHistorico = await WorkshopService.obterDetalheOficina(oficina.id, true);
      assert.ok(detalheHistorico);
      assert.strictEqual(detalheHistorico.totalGastoReais, 190);
    });

    it('rejeita cadastro de oficina com telefone inválido', async () => {
      await assert.rejects(
        async () => {
          await WorkshopService.criarOficina({
            nome: 'Oficina Teste',
            telefone: '123',
          });
        },
        /Telefone inválido/,
      );
    });

    it('US12.1: oficinas e atendimentos_oficina estão registrados em SyncEntityRegistry', () => {
      const entities = SyncEntityRegistry.listRegisteredEntities();
      assert.ok(entities.includes('oficinas'));
      assert.ok(entities.includes('atendimentos_oficina'));
    });
  });
});
