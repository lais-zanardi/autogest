-- Migration 007: Criação da Tabela de Regras Preventivas de Manutenção (US10.1)

CREATE TABLE IF NOT EXISTS regras_manutencao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_servico VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NULL,
    intervalo_km INTEGER NULL CHECK (intervalo_km IS NULL OR intervalo_km > 0),
    intervalo_dias INTEGER NULL CHECK (intervalo_dias IS NULL OR intervalo_dias > 0),
    antecedencia_km INTEGER NOT NULL DEFAULT 500 CHECK (antecedencia_km >= 0),
    antecedencia_dias INTEGER NOT NULL DEFAULT 15 CHECK (antecedencia_dias >= 0),
    ultima_troca_data TIMESTAMPTZ NULL,
    ultima_troca_km INTEGER NULL CHECK (ultima_troca_km IS NULL OR ultima_troca_km >= 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

-- Índices de consulta e performance
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_veiculo_id ON regras_manutencao(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_tipo_servico ON regras_manutencao(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_ativo ON regras_manutencao(ativo);
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_excluido_em ON regras_manutencao(excluido_em);
