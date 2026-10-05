-- AutoGest - Base Schema PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Veículos (Garagem)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    plate VARCHAR(10) NOT NULL,
    fuel_type VARCHAR(20) NOT NULL,
    initial_odometer NUMERIC(10,2) NOT NULL,
    current_odometer NUMERIC(10,2) NOT NULL,
    fipe_value NUMERIC(12,2) NULL,
    tank_capacity_l NUMERIC(6,2) DEFAULT 50.0,
    preferred_fuel VARCHAR(30) DEFAULT 'Gasolina',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ NULL
);

-- Tabela veiculos com padrão português e exclusão lógica (US04.1)
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

-- Tabela de Abastecimentos
CREATE TABLE IF NOT EXISTS refuels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    odometer NUMERIC(10,2) NOT NULL,
    fuel_type VARCHAR(20) NOT NULL,
    price_per_liter NUMERIC(8,3) NOT NULL,
    total_value NUMERIC(10,2) NOT NULL,
    liters NUMERIC(8,3) NOT NULL,
    is_full_tank BOOLEAN NOT NULL DEFAULT TRUE,
    calculated_kml NUMERIC(6,2) NULL,
    receipt_image_url TEXT NULL,
    station_name VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Leituras de Hodômetro (US05.1)
CREATE TABLE IF NOT EXISTS leituras_hodometro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    km NUMERIC(10,2) NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origem VARCHAR(30) NOT NULL CHECK (origem IN ('abastecimento', 'manual', 'manutencao')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

-- Tabela de Abastecimentos (US05.1)
CREATE TABLE IF NOT EXISTS abastecimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_combustivel VARCHAR(30) NOT NULL,
    litros NUMERIC(8,3) NOT NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    valor_litro NUMERIC(8,3) NOT NULL,
    km NUMERIC(10,2) NOT NULL,
    consumo_kml NUMERIC(6,2) NULL,
    latitude NUMERIC(10,8) NULL,
    longitude NUMERIC(11,8) NULL,
    tanque_cheio BOOLEAN NOT NULL DEFAULT TRUE,
    posto VARCHAR(100) NULL,
    imagem_comprovante_url TEXT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

-- Tabela de Logs Climatológicos (OpenWeatherMap)
CREATE TABLE IF NOT EXISTS weather_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refuel_id UUID NOT NULL REFERENCES refuels(id) ON DELETE CASCADE,
    latitude NUMERIC(10,8) NOT NULL,
    longitude NUMERIC(11,8) NOT NULL,
    temperature_celsius NUMERIC(4,1) NOT NULL,
    condition VARCHAR(50) NOT NULL,
    humidity INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Preços Médios ANP
CREATE TABLE IF NOT EXISTS fuel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(2) NOT NULL,
    city VARCHAR(100) NOT NULL,
    fuel_type VARCHAR(20) NOT NULL,
    avg_price_anp NUMERIC(8,3) NOT NULL,
    reference_date DATE NOT NULL
);

-- Tabela de Despesas por Categoria (US22.1)
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

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_refuels_vehicle_id ON refuels(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_refuels_date ON refuels(date);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculo_id ON despesas(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data_hora ON despesas(data_hora);
CREATE INDEX IF NOT EXISTS idx_despesas_excluido_em ON despesas(excluido_em);

-- Tabela de Manutenções (US09.1)
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

-- Tabela de Anexos / Comprovantes de Manutenção (US09.1)
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

-- Tabela de Regras Preventivas de Manutenção (US10.1)
CREATE TABLE IF NOT EXISTS regras_manutencao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_servico VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NULL,
    intervalo_km INTEGER NULL CHECK (intervalo_km IS NULL OR intervalo_km > 0),
    intervalo_dias INTEGER NULL CHECK (intervalo_dias IS NULL OR intervalo_dias > 0),
    antecedencia_km INTEGER NOT NULL DEFAULT 500 CHECK (antecedencia_km >= 0),
    antecedencia_dias INTEGER NOT NULL DEFAULT 15 CHECK (antecedencia_dias >= 0),
    ultima_troca_data TIMESTAMPTZ NULL,
    ultima_troca_km INTEGER NULL CHECK (ultima_troca_km IS NULL OR ultima_troca_km >= 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    excluido_em TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_regras_manutencao_veiculo_id ON regras_manutencao(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_tipo_servico ON regras_manutencao(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_ativo ON regras_manutencao(ativo);
CREATE INDEX IF NOT EXISTS idx_regras_manutencao_excluido_em ON regras_manutencao(excluido_em);
