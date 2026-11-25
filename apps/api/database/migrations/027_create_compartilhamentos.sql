-- Migration 027: Tabela compartilhamentos (US20.1)
-- O token opaco de 32 bytes nunca é persistido em claro; apenas o hash SHA-256.
BEGIN;

CREATE TABLE IF NOT EXISTS compartilhamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_opaco_hash VARCHAR(64) NOT NULL UNIQUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMPTZ NOT NULL,
    revogado_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_compartilhamentos_veiculo
    ON compartilhamentos (veiculo_id, revogado_em);

COMMIT;
