-- Migration 010: Criação da Tabela de Auditoria (US21.5)
-- Somente inserção (append-only): sem colunas atualizado_em nem excluido_em.

CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    entidade VARCHAR(50) NOT NULL,
    entidade_id VARCHAR(100) NOT NULL,
    acao VARCHAR(40) NOT NULL CHECK (acao IN ('criacao', 'edicao', 'exclusao', 'geracao_backup', 'restauracao_backup')),
    alteracoes JSONB NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_data ON auditoria(usuario_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria(usuario_id, entidade, data_hora DESC);
