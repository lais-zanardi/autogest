-- Migration 024: Tabelas lembretes_inspecao e ciclos_inspecao (US31.1)
BEGIN;

CREATE TABLE IF NOT EXISTS lembretes_inspecao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    item VARCHAR(120) NOT NULL,
    periodicidade_dias INTEGER NOT NULL CHECK (periodicidade_dias > 0),
    ultima_inspecao_em TIMESTAMPTZ NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_lembretes_inspecao_veiculo
    ON lembretes_inspecao (veiculo_id, ativo);

CREATE TABLE IF NOT EXISTS ciclos_inspecao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    lembrete_id UUID NOT NULL REFERENCES lembretes_inspecao(id) ON DELETE CASCADE,
    disparado_em TIMESTAMPTZ NOT NULL,
    ultimo_disparo_em TIMESTAMPTZ NULL,
    tentativas INTEGER NOT NULL DEFAULT 1,
    concluido_em TIMESTAMPTZ NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ciclos_inspecao_lembrete
    ON ciclos_inspecao (lembrete_id, concluido_em);

COMMIT;
