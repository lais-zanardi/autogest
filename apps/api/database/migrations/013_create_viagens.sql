-- Migration 013: Tabela viagens e colunas vinculadas em abastecimentos e despesas (US07.1)
BEGIN;

-- 1. Coluna viagem_id em abastecimentos
ALTER TABLE abastecimentos
  ADD COLUMN IF NOT EXISTS viagem_id UUID NULL;

-- 2. Colunas viagem_id e subtipo_viagem em despesas
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS viagem_id UUID NULL,
  ADD COLUMN IF NOT EXISTS subtipo_viagem VARCHAR(30) NULL CHECK (subtipo_viagem IN ('pedagio', 'alimentacao', 'hospedagem', 'estacionamento', 'outros'));

-- 3. Tabela viagens
CREATE TABLE IF NOT EXISTS viagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  origem VARCHAR(150) NOT NULL,
  destino VARCHAR(150) NOT NULL,
  inicio_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fim_em TIMESTAMPTZ NULL,
  km_inicio NUMERIC(10,2) NOT NULL CHECK (km_inicio >= 0),
  km_fim NUMERIC(10,2) NULL CHECK (km_fim IS NULL OR km_fim >= km_inicio),
  status VARCHAR(20) NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizada', 'cancelada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluido_em TIMESTAMPTZ NULL
);

-- Uma viagem em andamento por veículo (índice condicional único)
CREATE UNIQUE INDEX IF NOT EXISTS idx_viagens_veiculo_em_andamento
  ON viagens(veiculo_id)
  WHERE status = 'em_andamento' AND excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_viagens_veiculo_id ON viagens(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_viagens_inicio_em ON viagens(inicio_em);
CREATE INDEX IF NOT EXISTS idx_viagens_excluido_em ON viagens(excluido_em);

-- FKs opcionais para viagem_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_abastecimentos_viagem_id'
  ) THEN
    ALTER TABLE abastecimentos ADD CONSTRAINT fk_abastecimentos_viagem_id FOREIGN KEY (viagem_id) REFERENCES viagens(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_despesas_viagem_id'
  ) THEN
    ALTER TABLE despesas ADD CONSTRAINT fk_despesas_viagem_id FOREIGN KEY (viagem_id) REFERENCES viagens(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
