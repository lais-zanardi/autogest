-- Migration 015: Índices compostos para consultas de relatórios (US19.1)
BEGIN;

-- Índice para consultas de gastos por veículo e período
CREATE INDEX IF NOT EXISTS idx_despesas_veiculo_data_hora ON despesas(veiculo_id, data_hora) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo_data_hora ON abastecimentos(veiculo_id, data_hora) WHERE excluido_em IS NULL;

-- Índice para histórico de manutenções por veículo e período
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo_data ON manutencoes(veiculo_id, data) WHERE excluido_em IS NULL;

COMMIT;
