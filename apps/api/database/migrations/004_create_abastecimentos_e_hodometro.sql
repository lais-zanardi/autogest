-- Migration 004: Tabelas abastecimentos e leituras_hodometro (US05.1)

BEGIN;

-- Tabela de Leituras de Hodômetro
CREATE TABLE IF NOT EXISTS leituras_hodometro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    km NUMERIC(10,2) NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origem VARCHAR(30) NOT NULL CHECK (origem IN ('abastecimento', 'manual', 'manutencao')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_leituras_hodometro_veiculo_id ON leituras_hodometro(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_leituras_hodometro_data_hora ON leituras_hodometro(data_hora);

-- Tabela de Abastecimentos com padrão português
CREATE TABLE IF NOT EXISTS abastecimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_combustivel VARCHAR(30) NOT NULL,
    litros NUMERIC(8,3) NOT NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    valor_litro NUMERIC(8,3) NOT NULL,
    km NUMERIC(10,2) NOT NULL,
    consumo_kml NUMERIC(6,2) NULL,
    latitude NUMERIC(10,8) NULL,
    longitude NUMERIC(11,8) NULL,
    tanque_cheio BOOLEAN NOT NULL DEFAULT TRUE,
    posto VARCHAR(100) NULL,
    imagem_comprovante_url TEXT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo_id ON abastecimentos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_data_hora ON abastecimentos(data_hora);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_excluido_em ON abastecimentos(excluido_em);

COMMIT;
