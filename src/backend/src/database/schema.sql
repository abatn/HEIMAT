-- HEIMAT 2.0 Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MOBILITÄT
-- ============================================

-- Haltestellen (Cache fuer OpenStreetMap/Overpass-Daten)
CREATE TABLE stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    osm_id BIGINT UNIQUE,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    stop_type VARCHAR(50), -- 'bus', 'tram', 'subway', 'train'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verbindungen
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    departure_stop_id UUID REFERENCES stops(id),
    arrival_stop_id UUID REFERENCES stops(id),
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    line VARCHAR(50) NOT NULL,
    transport_type VARCHAR(50) NOT NULL, -- 'bus', 'tram', 'subway', 'train'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FINANZEN
-- ============================================

-- Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaktionen
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_wallet_id UUID REFERENCES wallets(id),
    to_wallet_id UUID REFERENCES wallets(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- GESUNDHEIT
-- ============================================

-- Ärzte
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verfügbare Zeitslots
CREATE TABLE doctor_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Termine
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_email VARCHAR(255),
    patient_phone VARCHAR(50),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- GTFS-ÖPNV-DATEN
-- ============================================

-- GTFS Haltestellen
CREATE TABLE IF NOT EXISTS gtfs_stops (
    stop_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    zone_id VARCHAR(50),
    stop_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GTFS Routen/Linien
CREATE TABLE IF NOT EXISTS gtfs_routes (
    route_id VARCHAR(255) PRIMARY KEY,
    short_name VARCHAR(100),
    long_name VARCHAR(255),
    route_type INTEGER NOT NULL, -- 0=tram,1=subway,2=rail,3=bus
    route_color VARCHAR(7), -- '#FF0000'
    route_text_color VARCHAR(7), -- '#FFFFFF'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GTFS Fahrten
CREATE TABLE IF NOT EXISTS gtfs_trips (
    trip_id VARCHAR(255) PRIMARY KEY,
    route_id VARCHAR(255) NOT NULL REFERENCES gtfs_routes(route_id),
    headsign VARCHAR(255),
    direction_id INTEGER, -- 0=outbound, 1=inbound
    service_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GTFS Abfahrtszeiten
CREATE TABLE IF NOT EXISTS gtfs_stop_times (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(255) NOT NULL REFERENCES gtfs_trips(trip_id),
    stop_id VARCHAR(255) NOT NULL REFERENCES gtfs_stops(stop_id),
    arrival_time VARCHAR(8), -- 'HH:MM:SS'
    departure_time VARCHAR(8),
    stop_sequence INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GTFS Kalender (Verkehrstage)
CREATE TABLE IF NOT EXISTS gtfs_calendar (
    service_id VARCHAR(255) PRIMARY KEY,
    monday BOOLEAN DEFAULT false,
    tuesday BOOLEAN DEFAULT false,
    wednesday BOOLEAN DEFAULT false,
    thursday BOOLEAN DEFAULT false,
    friday BOOLEAN DEFAULT false,
    saturday BOOLEAN DEFAULT false,
    sunday BOOLEAN DEFAULT false,
    start_date VARCHAR(8), -- 'YYYYMMDD'
    end_date VARCHAR(8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GTFS ↔ Overpass Stop-Matching
CREATE TABLE IF NOT EXISTS gtfs_stop_match (
    id SERIAL PRIMARY KEY,
    overpass_osm_id BIGINT NOT NULL,
    gtfs_stop_id VARCHAR(255) NOT NULL REFERENCES gtfs_stops(stop_id),
    match_score REAL DEFAULT 0.0, -- 0.0-1.0
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(overpass_osm_id, gtfs_stop_id)
);

-- GTFS Indizes
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_location ON gtfs_stops(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_name ON gtfs_stops(name);
CREATE INDEX IF NOT EXISTS idx_gtfs_routes_type ON gtfs_routes(route_type);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route ON gtfs_trips(route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_service ON gtfs_trips(service_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_trip ON gtfs_stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop ON gtfs_stop_times(stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_departure ON gtfs_stop_times(departure_time);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_match_osm ON gtfs_stop_match(overpass_osm_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_match_gtfs ON gtfs_stop_match(gtfs_stop_id);

-- ============================================
-- INDIZES
-- ============================================

-- Stops
CREATE INDEX idx_stops_location ON stops(latitude, longitude);

-- Connections
CREATE INDEX idx_connections_departure ON connections(departure_stop_id);
CREATE INDEX idx_connections_arrival ON connections(arrival_stop_id);

-- Wallets
CREATE INDEX idx_wallets_user ON wallets(user_id);

-- Transactions
CREATE INDEX idx_transactions_from ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to ON transactions(to_wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Doctors
CREATE INDEX idx_doctors_specialty ON doctors(specialty);
CREATE INDEX idx_doctors_location ON doctors(latitude, longitude);

-- Doctor Slots
CREATE INDEX idx_doctor_slots_doctor ON doctor_slots(doctor_id);
CREATE INDEX idx_doctor_slots_day ON doctor_slots(day_of_week);

-- Appointments
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================
-- TALER EXCHANGE (Simulator)
-- ============================================

-- Taler Wallets (ein Wallet pro User, echte EdDSA-Key-Paare)
CREATE TABLE IF NOT EXISTS taler_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    wallet_pub TEXT NOT NULL,
    wallet_priv TEXT NOT NULL,
    balance VARCHAR(50) NOT NULL DEFAULT '0',
    currency VARCHAR(10) NOT NULL DEFAULT 'KUDOS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Taler Purses (ephemeral P2P-Transfer-Objekte)
CREATE TABLE IF NOT EXISTS taler_purses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purse_pub TEXT NOT NULL,
    purse_priv TEXT NOT NULL,
    amount VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KUDOS',
    contract_hash VARCHAR(128),
    sender_wallet_id UUID NOT NULL REFERENCES taler_wallets(id),
    receiver_wallet_id UUID REFERENCES taler_wallets(id),
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    merged_at TIMESTAMP
);

-- Taler Transaktions-Log (alle Geldbewegungen)
CREATE TABLE IF NOT EXISTS taler_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purse_id UUID REFERENCES taler_purses(id),
    from_wallet_id VARCHAR(255) NOT NULL,
    to_wallet_id VARCHAR(255) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KUDOS',
    contract_hash VARCHAR(128),
    status VARCHAR(20) DEFAULT 'completed',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Taler Indizes
CREATE INDEX IF NOT EXISTS idx_taler_wallets_user ON taler_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_taler_purses_sender ON taler_purses(sender_wallet_id);
CREATE INDEX IF NOT EXISTS idx_taler_purses_receiver ON taler_purses(receiver_wallet_id);
CREATE INDEX IF NOT EXISTS idx_taler_purses_status ON taler_purses(status);
CREATE INDEX IF NOT EXISTS idx_taler_transactions_purse ON taler_transactions(purse_id);
CREATE INDEX IF NOT EXISTS idx_taler_transactions_from ON taler_transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_taler_transactions_to ON taler_transactions(to_wallet_id);

-- ============================================
-- SEED DATA
-- ============================================

-- Keine Seed-Daten: Haltestellen/Ärzte live aus Overpass, Wallets via GNU Taler (Phase 3).
-- Doctor-Slots werden automatisch bei Arzt-Registrierung generiert.
