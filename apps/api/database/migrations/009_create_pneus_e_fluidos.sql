-- Migration 009: Criação das Tabelas de Pneus e Fluidos (US11.1)

-- 1. Tabela de Registros de Pneu (calibragem e troca)
CREATE TABLE IF NOT EXISTS registros_pneu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    data TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    km INTEGER NOT NULL CHECK (km > 0),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('calibragem', 'troca')),
    pressao_psi NUMERIC(5, 1) NOT NULL CHECK (pressao_psi > 0),
    sulco_mm NUMERIC(4, 1) NULL CHECK (sulco_mm IS NULL OR sulco_mm >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_registros_pneu_veiculo_id ON registros_pneu(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_registros_pneu_veiculo_data ON registros_pneu(veiculo_id, data);
CREATE INDEX IF NOT EXISTS idx_registros_pneu_excluido_em ON registros_pneu(excluido_em);

-- 2. Tabela de Registros de Fluido (óleo do motor, fluido de freio, água do radiador)
CREATE TABLE IF NOT EXISTS registros_fluido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_fluido VARCHAR(30) NOT NULL CHECK (tipo_fluido IN ('oleo_motor', 'freio', 'radiador')),
    data TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    km INTEGER NOT NULL CHECK (km > 0),
    nivel VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (nivel IN ('normal', 'baixo')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_registros_fluido_veiculo_id ON registros_fluido(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_registros_fluido_veiculo_data ON registros_fluido(veiculo_id, data);
CREATE INDEX IF NOT EXISTS idx_registros_fluido_excluido_em ON registros_fluido(excluido_em);
