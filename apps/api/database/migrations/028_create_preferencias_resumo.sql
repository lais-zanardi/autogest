-- Migration 028: Tabelas preferencias_resumo e envios_resumo_mensal (US37.1 & US37.5)
BEGIN;

CREATE TABLE IF NOT EXISTS preferencias_resumo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    receber_resumo BOOLEAN NOT NULL DEFAULT FALSE,
    email_destino VARCHAR(255) NOT NULL DEFAULT '',
    token_cancelamento_hash VARCHAR(64) NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS envios_resumo_mensal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mes_referencia VARCHAR(7) NOT NULL,
    enviado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_envios_resumo_mes
    ON envios_resumo_mensal (mes_referencia);

COMMIT;
