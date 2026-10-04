-- Migration 006: Tabelas manutencoes e anexos com auditoria e exclusão lógica (US09.1)
BEGIN;

CREATE TABLE IF NOT EXISTS manutencoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    km NUMERIC(10,2) NOT NULL CHECK (km >= 0),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('preventiva', 'corretiva')),
    tipo_servico VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    pecas TEXT NULL,
    oficina VARCHAR(150) NULL,
    profissional VARCHAR(100) NULL,
    tempo_execucao_min INTEGER NULL CHECK (tempo_execucao_min >= 0),
    valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo_id ON manutencoes(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data);
CREATE INDEX IF NOT EXISTS idx_manutencoes_tipo ON manutencoes(tipo);
CREATE INDEX IF NOT EXISTS idx_manutencoes_tipo_servico ON manutencoes(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_manutencoes_excluido_em ON manutencoes(excluido_em);

CREATE TABLE IF NOT EXISTS anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manutencao_id UUID NULL REFERENCES manutencoes(id) ON DELETE CASCADE,
    arquivo_local TEXT NULL,
    url_gcs TEXT NULL,
    tamanho INTEGER NOT NULL CHECK (tamanho > 0 AND tamanho <= 1048576),
    status_upload VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status_upload IN ('pendente', 'enviado', 'erro')),
    tipo_mime VARCHAR(50) NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_anexos_manutencao_id ON anexos(manutencao_id);
CREATE INDEX IF NOT EXISTS idx_anexos_status_upload ON anexos(status_upload);
CREATE INDEX IF NOT EXISTS idx_anexos_excluido_em ON anexos(excluido_em);

COMMIT;
