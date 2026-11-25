-- Migration 025: Tabela fotos_veiculo e coluna foto_capa_id em veiculos (US32.1)
BEGIN;

CREATE TABLE IF NOT EXISTS fotos_veiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    legenda VARCHAR(255) NULL,
    arquivo_local TEXT NULL,
    url_gcs TEXT NULL,
    tamanho_bytes INTEGER NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 1048576),
    mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    status_upload VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status_upload IN ('pendente', 'enviado', 'erro')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_fotos_veiculo_veiculo_data
    ON fotos_veiculo (veiculo_id, data ASC);

ALTER TABLE veiculos
    ADD COLUMN IF NOT EXISTS foto_capa_id UUID NULL REFERENCES fotos_veiculo(id) ON DELETE SET NULL;

COMMIT;
