-- Migration 012: Contexto do Registro (US27.1)
-- Colunas tipo_percurso e nota em abastecimentos, nota em manutencoes;
-- Tabelas etiquetas e registros_etiquetas.

BEGIN;

-- 1. Colunas em abastecimentos
ALTER TABLE abastecimentos
  ADD COLUMN IF NOT EXISTS tipo_percurso VARCHAR(20) NULL CHECK (tipo_percurso IN ('urbano', 'rodoviario', 'misto')),
  ADD COLUMN IF NOT EXISTS nota VARCHAR(500) NULL;

-- 2. Coluna em manutencoes
ALTER TABLE manutencoes
  ADD COLUMN IF NOT EXISTS nota VARCHAR(500) NULL;

-- 3. Tabela de Etiquetas com unicidade insensível a maiúsculas por usuário
CREATE TABLE IF NOT EXISTS etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(50) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluido_em TIMESTAMPTZ NULL
);

-- Índice único case-insensitive por usuário (apenas registros ativos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_etiquetas_usuario_nome_upper 
  ON etiquetas(usuario_id, UPPER(TRIM(nome))) 
  WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_etiquetas_usuario_id ON etiquetas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_etiquetas_excluido_em ON etiquetas(excluido_em);

-- 4. Tabela de Registros Etiquetas (vínculo polimórfico com abastecimentos, despesas e manutencoes)
CREATE TABLE IF NOT EXISTS registros_etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  etiqueta_id UUID NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  tipo_registro VARCHAR(20) NOT NULL CHECK (tipo_registro IN ('abastecimento', 'despesa', 'manutencao')),
  registro_id UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_registros_etiquetas_etiqueta_id ON registros_etiquetas(etiqueta_id);
CREATE INDEX IF NOT EXISTS idx_registros_etiquetas_polimorfico ON registros_etiquetas(tipo_registro, registro_id);
CREATE INDEX IF NOT EXISTS idx_registros_etiquetas_usuario_id ON registros_etiquetas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_registros_etiquetas_excluido_em ON registros_etiquetas(excluido_em);

COMMIT;
