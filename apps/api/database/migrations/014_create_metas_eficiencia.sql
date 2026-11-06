-- Migration 014: Tabela metas_eficiencia (US08.1)
BEGIN;

CREATE TABLE IF NOT EXISTS metas_eficiencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  consumo_alvo_kml NUMERIC(6,2) NOT NULL CHECK (consumo_alvo_kml > 0),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluido_em TIMESTAMPTZ NULL
);

-- Uma meta ativa por veículo
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_eficiencia_veiculo_ativa
  ON metas_eficiencia(veiculo_id)
  WHERE ativa = TRUE AND excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_metas_eficiencia_veiculo_id ON metas_eficiencia(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_metas_eficiencia_excluido_em ON metas_eficiencia(excluido_em);

COMMIT;
