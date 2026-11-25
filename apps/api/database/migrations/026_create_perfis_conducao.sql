-- Migration 026: Tabela perfis_conducao e coluna perfil_conducao em abastecimentos (US29.1)
BEGIN;

CREATE TABLE IF NOT EXISTS perfis_conducao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    perfil_conducao VARCHAR(20) NOT NULL CHECK (perfil_conducao IN ('economico', 'normal', 'agressivo')),
    definido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_perfis_conducao_veiculo
    ON perfis_conducao (veiculo_id, definido_em DESC);

ALTER TABLE abastecimentos
    ADD COLUMN IF NOT EXISTS perfil_conducao VARCHAR(20) NULL
    CHECK (perfil_conducao IN ('economico', 'normal', 'agressivo'));

COMMIT;
