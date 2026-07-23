-- HEIMAT 2.0 Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTH / USER
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- MOBILITÄT
-- ============================================

-- Haltestellen (Cache fuer OpenStreetMap/Overpass-Daten)
CREATE TABLE IF NOT EXISTS stops (
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
CREATE TABLE IF NOT EXISTS connections (
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
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaktionen
CREATE TABLE IF NOT EXISTS transactions (
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
CREATE TABLE IF NOT EXISTS doctors (
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
CREATE TABLE IF NOT EXISTS doctor_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Termine
CREATE TABLE IF NOT EXISTS appointments (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (trip_id, stop_id, stop_sequence)
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
CREATE INDEX IF NOT EXISTS idx_gtfs_transfers_from ON gtfs_transfers(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_transfers_to ON gtfs_transfers(to_stop_id);

-- GTFS Import-Status (polling von /api/admin/gtfs-status)
CREATE TABLE IF NOT EXISTS gtfs_import_status (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL, -- 'running'|'done'|'failed'
    message TEXT,
    stage VARCHAR(40),           -- 'download'|'extract'|'stops'|'routes'|'trips'|'stop_times'|'calendar'|'transfers'
    progress INTEGER DEFAULT 0,   -- 0-100
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GTFS Transfer-Edges (Walking graph für RAPTOR)
CREATE TABLE IF NOT EXISTS gtfs_transfers (
    from_stop_id VARCHAR(255) NOT NULL,
    to_stop_id VARCHAR(255) NOT NULL,
    transfer_type INTEGER DEFAULT 0,
    min_transfer_time INTEGER DEFAULT 0,
    PRIMARY KEY (from_stop_id, to_stop_id)
);

-- ============================================
-- INDIZES
-- ============================================

-- Stops
CREATE INDEX IF NOT EXISTS idx_stops_location ON stops(latitude, longitude);

-- Connections
CREATE INDEX IF NOT EXISTS idx_connections_departure ON connections(departure_stop_id);
CREATE INDEX IF NOT EXISTS idx_connections_arrival ON connections(arrival_stop_id);

-- Wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Doctors
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_location ON doctors(latitude, longitude);

-- Doctor Slots
CREATE INDEX IF NOT EXISTS idx_doctor_slots_doctor ON doctor_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_slots_day ON doctor_slots(day_of_week);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ============================================
-- TALER EXCHANGE (real GNU Taler protocol integration)
-- ============================================
--
-- Wahrheit liegt am Exchange: GET https://exchange.demo.taler.net/reserves/<reserve_pub>
-- Diese Tabellen sind nur Cache. KEINE erfundenen Balance-Werte.
-- ============================================

-- Taler Wallets (echte EdDSA-Key-Paare; Balance = Snapshot vom Exchange per GET /reserves/<pub>)
CREATE TABLE IF NOT EXISTS taler_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    wallet_pub TEXT NOT NULL,                       -- Crockford-Base32 Public-Key (Taler-Format)
    wallet_priv_pkcs8 TEXT NOT NULL,                 -- PKCS8 ecoded ed25519 Private (in DB gecacht)
    balance VARCHAR(50) NOT NULL DEFAULT '0',        -- LETZTE vom Exchange bestätigte Bilanz (Snapshot, "KUDOS:0" wenn unbekannt)
    currency VARCHAR(10) NOT NULL DEFAULT 'KUDOS',
    exchange_reserve_pub TEXT,                       -- Verknüpfung zur Taler-Reserve am Exchange (nullable bis Reserve gebunden)
    exchange_base_url TEXT,                          -- z.B. https://exchange.demo.taler.net/
    last_probed_at TIMESTAMP,                        -- Wann wir zuletzt /reserves/<pub> abgefragt haben
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Taler Reserves (Cache, NICHT Truth-Source — Truth lebt am Exchange unter /reserves/<pub>)
CREATE TABLE IF NOT EXISTS taler_reserves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    reserve_pub TEXT NOT NULL UNIQUE,                -- Crockford-Base32
    reserve_priv_pkcs8 TEXT NOT NULL,                -- PKCS8 für Ed25519-Reserve-Signaturen (für openReserve)
    initial_balance VARCHAR(50) NOT NULL,             -- Taler-Format: "KUDOS:25"
    current_balance VARCHAR(50) NOT NULL DEFAULT 'KUDOS:0',
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',     -- unknown|partial|full|closed (per /reserves/<pub>)
    exchange_base_url TEXT NOT NULL,                  -- z.B. https://exchange.demo.taler.net/
    last_probed_at TIMESTAMP,
    raw_exchange_response JSONB,                       -- Antwort-Body der letzten /reserves/<pub> GET
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_taler_reserves_user ON taler_reserves(user_id);
CREATE INDEX IF NOT EXISTS idx_taler_reserves_pub ON taler_reserves(reserve_pub);

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

-- Taler Transaktions-Log (alle Geldbewegungen — sowohl Exchange-Reserve-Transaktionen
-- als auch HEIMAT-interne P2P-Purse-Buchungen)
CREATE TABLE IF NOT EXISTS taler_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserve_id UUID REFERENCES taler_reserves(id),
    purse_id UUID REFERENCES taler_purses(id),
    from_wallet_id VARCHAR(255) NOT NULL,
    to_wallet_id VARCHAR(255) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KUDOS',
    contract_hash VARCHAR(128),
    kind VARCHAR(20) DEFAULT 'p2p',                -- 'reserve_open'|'reserve_withdraw'|'p2p'|'purse_funding'|'purse_merge'
    status VARCHAR(20) DEFAULT 'completed',
    exchange_tx_signature TEXT,                    -- Echte Exchange-Signature (Wire-Proof), falls vorhanden
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
-- ML: DELAY LOGGING (Verspätungsvorhersage)
-- ============================================

-- Delay-Logs: Täglich Abfahrten + reale Ankunftszeiten für ML-Training
CREATE TABLE IF NOT EXISTS delay_logs (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(255) NOT NULL,
    line VARCHAR(100) NOT NULL,
    stop_id VARCHAR(255),
    stop_name VARCHAR(255),
    scheduled_departure TIMESTAMP NOT NULL,
    actual_departure TIMESTAMP,
    delay_minutes INTEGER DEFAULT 0,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für ML-Training
CREATE INDEX IF NOT EXISTS idx_delay_logs_trip ON delay_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_delay_logs_line ON delay_logs(line);
CREATE INDEX IF NOT EXISTS idx_delay_logs_scheduled ON delay_logs(scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_delay_logs_logged_at ON delay_logs(logged_at);

-- ============================================
-- SEED DATA
-- ============================================

-- Keine Seed-Daten: Haltestellen/Ärzte live aus Overpass, Wallets & Reserves live vom GNU Taler Exchange.

-- ============================================
-- IDEMPOTENTE MIGRATIONEN (für bestehende DBs ohne neuen Spalten/Tabellen)
-- ============================================
ALTER TABLE taler_wallets ADD COLUMN IF NOT EXISTS wallet_priv_pkcs8 TEXT NOT NULL DEFAULT '';
ALTER TABLE taler_wallets ADD COLUMN IF NOT EXISTS exchange_reserve_pub TEXT;
ALTER TABLE taler_wallets ADD COLUMN IF NOT EXISTS exchange_base_url TEXT;
ALTER TABLE taler_wallets ADD COLUMN IF NOT EXISTS last_probed_at TIMESTAMP;
CREATE TABLE IF NOT EXISTS taler_reserves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    reserve_pub TEXT NOT NULL UNIQUE,
    reserve_priv_pkcs8 TEXT NOT NULL DEFAULT '',
    initial_balance VARCHAR(50) NOT NULL,
    current_balance VARCHAR(50) NOT NULL DEFAULT 'KUDOS:0',
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    exchange_base_url TEXT NOT NULL,
    last_probed_at TIMESTAMP,
    raw_exchange_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_taler_reserves_user ON taler_reserves(user_id);
CREATE INDEX IF NOT EXISTS idx_taler_reserves_pub ON taler_reserves(reserve_pub);
ALTER TABLE taler_transactions ADD COLUMN IF NOT EXISTS reserve_id UUID REFERENCES taler_reserves(id);
ALTER TABLE taler_transactions ADD COLUMN IF NOT EXISTS kind VARCHAR(20) DEFAULT 'p2p';
ALTER TABLE taler_transactions ADD COLUMN IF NOT EXISTS exchange_tx_signature TEXT;
ALTER TABLE taler_purses ADD COLUMN IF NOT EXISTS purse_priv_pkcs8 TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taler_purses' AND column_name = 'purse_priv'
  ) THEN
    -- nur auf Legacy-DBs umbenennen; auf frischen Installationen existiert purse_priv nicht
    EXECUTE 'ALTER TABLE taler_purses RENAME COLUMN purse_priv TO purse_priv_pkcs8';
  END IF;
END $$;
-- Doctor-Slots werden automatisch bei Arzt-Registrierung generiert.
