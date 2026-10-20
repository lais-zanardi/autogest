-- Migration 008: Criação da Tabela de Custos Fixos Mensais (US23.1)

CREATE TABLE IF NOT EXISTS custos_fixos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    descricao VARCHAR(150) NOT NULL,
    valor_mensal NUMERIC(10, 2) NOT NULL CHECK (valor_mensal > 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

-- Índices de consulta e performance
CREATE INDEX IF NOT EXISTS idx_custos_fixos_veiculo_id ON custos_fixos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_custos_fixos_excluido_em ON custos_fixos(excluido_em);
