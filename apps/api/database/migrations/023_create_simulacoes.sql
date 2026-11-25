-- Migration 023: Tabela simulacoes sincronizável (US16.6)
BEGIN;

CREATE TABLE IF NOT EXISTS simulacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('etanol_gasolina', 'economia_potencial', 'custo_viagem')),
    entradas JSONB NOT NULL,
    resultado JSONB NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_simulacoes_usuario_criado
    ON simulacoes (usuario_id, criado_em DESC);

COMMIT;
