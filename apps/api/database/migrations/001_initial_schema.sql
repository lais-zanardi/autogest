-- Migration 001: Initial Schema Setup for AutoGest

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS fuel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(2) NOT NULL,
    city VARCHAR(100) NOT NULL,
    fuel_type VARCHAR(20) NOT NULL,
    avg_price_anp NUMERIC(8,3) NOT NULL,
    reference_date DATE NOT NULL
);

COMMIT;
