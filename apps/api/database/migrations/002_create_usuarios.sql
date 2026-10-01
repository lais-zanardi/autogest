-- Migration 002: Tabela usuarios com campos padronizados de sincronização e exclusão lógica (US01.6)

BEGIN;

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_firebase_uid ON usuarios(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

COMMIT;
