-- Migration 016: Tabela consultas_fipe e colunas fipe_* em veiculos (US18.4)
BEGIN;

-- 1. Colunas fipe_* na tabela de veiculos para vínculo em cascata
ALTER TABLE veiculos
    ADD COLUMN IF NOT EXISTS fipe_codigo_marca VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS fipe_codigo_modelo VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS fipe_codigo_ano VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS fipe_mes_referencia VARCHAR(10) NULL;

-- 2. Tabela de histórico de consultas da Tabela FIPE (1 por mês de referência por veículo)
CREATE TABLE IF NOT EXISTS consultas_fipe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    codigo_fipe VARCHAR(20) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(150) NOT NULL,
    ano_modelo INTEGER NOT NULL,
    combustivel VARCHAR(50) NOT NULL,
    mes_referencia VARCHAR(10) NOT NULL, -- formato 'AAAA-MM'
    valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
    consultado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

-- Índices para buscas rápidas e garantia de unicidade por veículo e mês de referência
CREATE INDEX IF NOT EXISTS idx_consultas_fipe_veiculo ON consultas_fipe(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_consultas_fipe_mes ON consultas_fipe(mes_referencia);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultas_fipe_veiculo_mes_ativo 
    ON consultas_fipe(veiculo_id, mes_referencia) 
    WHERE excluido_em IS NULL;

COMMIT;
