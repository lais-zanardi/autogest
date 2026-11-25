-- Migration 018: Tabelas precos_combustivel e cache_clima (US17.1)
BEGIN;

CREATE TABLE IF NOT EXISTS precos_combustivel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio VARCHAR(150) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    combustivel VARCHAR(50) NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
    data_coleta DATE NOT NULL,
    fonte VARCHAR(100) NOT NULL DEFAULT 'ANP',
    granularidade VARCHAR(20) NOT NULL DEFAULT 'municipal' CHECK (granularidade IN ('municipal', 'posto')),
    sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_precos_combustivel_unico
    ON precos_combustivel (LOWER(municipio), UPPER(uf), LOWER(combustivel), data_coleta);

CREATE INDEX IF NOT EXISTS idx_precos_combustivel_consulta
    ON precos_combustivel (LOWER(municipio), LOWER(combustivel), data_coleta DESC);

CREATE TABLE IF NOT EXISTS cache_clima (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio VARCHAR(150) NOT NULL,
    uf VARCHAR(2) NULL,
    data DATE NOT NULL,
    temperatura_atual NUMERIC(5,2) NULL,
    temperatura_min NUMERIC(5,2) NOT NULL,
    temperatura_max NUMERIC(5,2) NOT NULL,
    condicao VARCHAR(120) NOT NULL,
    expira_em TIMESTAMPTZ NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_clima_municipio_data
    ON cache_clima (LOWER(municipio), data);

CREATE INDEX IF NOT EXISTS idx_cache_clima_expira_em
    ON cache_clima (expira_em);

COMMIT;
