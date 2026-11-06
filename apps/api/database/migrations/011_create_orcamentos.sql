-- Migration 011: Criação da Tabela de Orçamentos Mensais por Veículo (US15.1)
-- Armazena o teto mensal em centavos (teto_mensal), percentual de aviso (padrão 80%)
-- e controle de notificações únicas por nível e por mês (aviso_enviado_mes e critico_enviado_mes no formato AAAA-MM).

CREATE TABLE IF NOT EXISTS orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    teto_mensal BIGINT NOT NULL CHECK (teto_mensal > 0),
    percentual_aviso INTEGER NOT NULL DEFAULT 80 CHECK (percentual_aviso > 0 AND percentual_aviso <= 100),
    aviso_enviado_mes VARCHAR(7) NULL,
    critico_enviado_mes VARCHAR(7) NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_veiculo_id ON orcamentos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_excluido_em ON orcamentos(excluido_em);
