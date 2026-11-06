-- Migration 017: Tabela agendamentos_manutencao sincronizável (US30.1)
BEGIN;

CREATE TABLE IF NOT EXISTS agendamentos_manutencao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    hora_lembrete VARCHAR(5) NOT NULL DEFAULT '09:00',
    tipo_servico VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    manutencao_id UUID NULL REFERENCES manutencoes(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_veiculo_data ON agendamentos_manutencao(veiculo_id, data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos_manutencao(status);

COMMIT;
