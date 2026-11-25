-- Migration 022: Tabela locais_visitados sincronizável (US36.1)
BEGIN;

CREATE TABLE IF NOT EXISTS locais_visitados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('posto', 'oficina')),
    referencia_id UUID NOT NULL,
    nome VARCHAR(180) NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    data DATE NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_locais_visitados_usuario_tipo
    ON locais_visitados (usuario_id, tipo, data DESC);

COMMIT;
