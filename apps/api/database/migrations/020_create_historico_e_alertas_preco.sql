-- Migration 020: Tabelas historico_precos_locais e alertas_preco (US35.1)
BEGIN;

CREATE TABLE IF NOT EXISTS historico_precos_locais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio VARCHAR(150) NOT NULL,
    combustivel VARCHAR(50) NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
    data_coleta DATE NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_historico_precos_locais_unico
    ON historico_precos_locais (LOWER(municipio), LOWER(combustivel), data_coleta);

CREATE INDEX IF NOT EXISTS idx_historico_precos_locais_consulta
    ON historico_precos_locais (LOWER(municipio), LOWER(combustivel), data_coleta DESC);

CREATE TABLE IF NOT EXISTS alertas_preco (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    combustivel VARCHAR(50) NOT NULL,
    preco_limite_centavos INTEGER NOT NULL CHECK (preco_limite_centavos > 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    disparado_em TIMESTAMPTZ NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_alertas_preco_veiculo_combustivel
    ON alertas_preco (veiculo_id, LOWER(combustivel));

COMMIT;
