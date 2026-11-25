-- Migration 019: Tabela postos somente leitura sincronizável (US34.1)
BEGIN;

CREATE TABLE IF NOT EXISTS postos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(180) NOT NULL,
    bandeira VARCHAR(80) NOT NULL DEFAULT 'BRANCA',
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    municipio VARCHAR(150) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    endereco VARCHAR(255) NULL,
    precos_centavos JSONB NOT NULL DEFAULT '{}'::jsonb,
    sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_postos_unico
    ON postos (LOWER(nome), LOWER(municipio), UPPER(uf));

CREATE INDEX IF NOT EXISTS idx_postos_municipio_uf
    ON postos (LOWER(municipio), UPPER(uf));

COMMIT;
