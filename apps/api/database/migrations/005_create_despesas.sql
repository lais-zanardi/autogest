-- Migration 005: Tabela despesas por categoria (US22.1)
BEGIN;

CREATE TABLE IF NOT EXISTS despesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('Combustível', 'Manutenção', 'Seguro', 'Imposto', 'Lavagem', 'Outros')),
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descricao TEXT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_despesas_veiculo_id ON despesas(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data_hora ON despesas(data_hora);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria);
CREATE INDEX IF NOT EXISTS idx_despesas_excluido_em ON despesas(excluido_em);

COMMIT;
