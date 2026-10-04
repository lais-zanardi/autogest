-- Migration 003: Tabela veiculos com campos padronizados e exclusão lógica (US04.1)

BEGIN;

CREATE TABLE IF NOT EXISTS veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    nome VARCHAR(100) NULL,
    marca VARCHAR(100) NULL,
    modelo VARCHAR(100) NOT NULL,
    ano INTEGER NOT NULL,
    placa VARCHAR(10) NOT NULL,
    capacidade_tanque_l NUMERIC(6,2) NOT NULL,
    combustivel_preferencial VARCHAR(30) NOT NULL,
    odometro_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
    odometro_atual NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_fipe NUMERIC(12,2) NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_veiculos_usuario_id ON veiculos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_excluido_em ON veiculos(excluido_em);

-- Se a tabela legada 'vehicles' existir, adiciona compatibilidade
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tank_capacity_l NUMERIC(6,2) DEFAULT 50.0;
        ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS preferred_fuel VARCHAR(30) DEFAULT 'Gasolina';
        ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
    END IF;
END $$;

COMMIT;
