-- Migration 021: Tabelas oficinas, atendimentos_oficina e coluna oficina_id em manutencoes (US12.1)
BEGIN;

CREATE TABLE IF NOT EXISTS oficinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(180) NOT NULL,
    telefone VARCHAR(30) NULL,
    endereco VARCHAR(255) NULL,
    latitude NUMERIC(10, 7) NULL,
    longitude NUMERIC(10, 7) NULL,
    favorita BOOLEAN NOT NULL DEFAULT FALSE,
    observacoes TEXT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_oficinas_usuario ON oficinas (usuario_id);

ALTER TABLE manutencoes
    ADD COLUMN IF NOT EXISTS oficina_id UUID NULL REFERENCES oficinas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS atendimentos_oficina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    oficina_id UUID NOT NULL REFERENCES oficinas(id) ON DELETE RESTRICT,
    manutencao_id UUID NOT NULL REFERENCES manutencoes(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_oficina_oficina_id ON atendimentos_oficina (oficina_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_oficina_manutencao_id ON atendimentos_oficina (manutencao_id);

COMMIT;
