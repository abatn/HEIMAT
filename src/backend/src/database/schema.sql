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
-- Indizes auf gtfs_transfers muessen NACH dem CREATE TABLE stehen (PostgreSQL
-- validiert ON <table> sofort — ein Index vor Tabelle schlaegt fehl mit
-- "relation does not exist").
CREATE INDEX IF NOT EXISTS idx_gtfs_transfers_from ON gtfs_transfers(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_transfers_to ON gtfs_transfers(to_stop_id);

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
    purse_priv_pkcs8 TEXT NOT NULL,
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

-- ============================================
-- CHECK-IN (Lebenszeichen, Phase AI-Health-2)
-- ============================================

-- User Check-in Einstellungen (timer-basiert, KEIN Sensor-Tracking)
CREATE TABLE IF NOT EXISTS checkin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT false,
    interval_hours INTEGER DEFAULT 24,          -- Normal: 24h zwischen Check-ins
    interval_health_hours INTEGER DEFAULT 6,     -- Bei Gesundheits-Kontext: 6h
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_email VARCHAR(255),
    auto_112_enabled BOOLEAN DEFAULT false,      -- Nur aktivierbar mit vorherigem Gesundheits-Symptom
    last_ping_at TIMESTAMP,
    health_context_symptoms TEXT,                 -- Vom User im Chat gemeldete Symptome (z.B. "Brustschmerz")
    health_context_reported_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checkin_settings_user ON checkin_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_settings_active ON checkin_settings(is_active) WHERE is_active = true;

-- Check-in Ereignisse (Eskalations-Historie)
CREATE TABLE IF NOT EXISTS checkin_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(30) NOT NULL,             -- 'ping' | 'missed' | 'escalation_push' | 'escalation_contact' | 'escalation_emergency' | 'deactivated'
    escalation_stage INTEGER DEFAULT 0,          -- 0=ping, 1=push, 2=contact, 3=112
    details TEXT,                                 -- Zusätzliche Informationen
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checkin_events_user ON checkin_events(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_events_type ON checkin_events(event_type);

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
-- SEED DATA: 25 Berliner Arztpraxen
-- ============================================
-- Idempotent: wird nur ausgeführt wenn doctors-Tabelle leer ist.
-- Zweck: Specialty-Chips liefern sofort echte Ergebnisse statt leerer Liste.
-- Alle Praxen haben realistische Berliner Adressen + GPS-Koordinaten.
-- Abdeckung: alle 20 classifySpecialty()-Kategorien.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM doctors WHERE name = 'Praxis Dr. Katja Meißner') THEN

    -- 1. Allgemeinmedizin (3 Praxen)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Praxis Dr. Katja Meißner')::uuid, 'Praxis Dr. Katja Meißner', 'Allgemeinmedizin', 'Alexanderstraße 7, 10178 Berlin', '+49 30 12345678', 'meissner@praxis-berlin.de', 52.5219, 13.4132),
      (md5('Gemeinschaftspraxis Dr. Weber & Dr. Klein')::uuid, 'Gemeinschaftspraxis Dr. Weber & Dr. Klein', 'Allgemeinmedizin', 'Kantstraße 45, 10625 Berlin', '+49 30 23456789', 'info@gp-weber-klein.de', 52.5074, 13.3216),
      (md5('Hausarztpraxis am Prenzlauer Berg')::uuid, 'Hausarztpraxis am Prenzlauer Berg', 'Allgemeinmedizin', 'Schönhauser Allee 120, 10437 Berlin', '+49 30 34567890', 'kontakt@hausarzt-pb.de', 52.5488, 13.4134);

    -- 2. Zahnarzt (2 Praxen)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Zahnarztpraxis Dr. Müller')::uuid, 'Zahnarztpraxis Dr. Müller', 'Zahnarzt', 'Kastanienallee 55, 10435 Berlin', '+49 30 45678901', 'mueller@zahnarzt-berlin.de', 52.5483, 13.4107),
      (md5('Dental Clinic Berlin Mitte')::uuid, 'Dental Clinic Berlin Mitte', 'Zahnarzt', 'Friedrichstraße 89, 10117 Berlin', '+49 30 56789012', 'info@dental-mitte.de', 52.5244, 13.3884);

    -- 3. Augenarzt (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Augenärztin Dr. Breitenbach')::uuid, 'Augenärztin Dr. Breitenbach', 'Augenarzt', 'Wilmersdorfer Straße 38, 10627 Berlin', '+49 30 67890123', 'breitenbach@augenarzt-berlin.de', 52.5065, 13.3091);

    -- 4. HNO-Arzt (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('HNO-Praxis Dr. Schmidt')::uuid, 'HNO-Praxis Dr. Schmidt', 'HNO-Arzt', 'Greifswalder Straße 42, 10405 Berlin', '+49 30 78901234', 'schmidt@hno-prenzlberg.de', 52.5359, 13.4315);

    -- 5. Hautarzt (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Hautarzt Praxis Helena Dröge')::uuid, 'Hautarzt Praxis Helena Dröge', 'Hautarzt', 'Motzstraße 22, 10777 Berlin', '+49 30 89012345', 'droege@hautarzt-schoeneberg.de', 52.4986, 13.3545);

    -- 6. Kinderarzt (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Kinderarztpraxis am Traveplatz')::uuid, 'Kinderarztpraxis am Traveplatz', 'Kinderarzt', 'Petersburger Platz 1, 10249 Berlin', '+49 30 90123456', 'info@kinderarzt-fhain.de', 52.5176, 13.4572);

    -- 7. Frauenarzt (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Praxis für Gynäkologie Dr. Ridha')::uuid, 'Praxis für Gynäkologie Dr. Ridha', 'Frauenarzt', 'Hohenzollerndamm 30, 10713 Berlin', '+49 30 11234567', 'ridha@gyn-wilmersdorf.de', 52.4928, 13.3011);

    -- 8. Kardiologe (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Kardiologische Praxis Dr. Weber')::uuid, 'Kardiologische Praxis Dr. Weber', 'Kardiologe', 'Schloßstraße 22, 12163 Berlin', '+49 30 22345678', 'weber@kardio-steglitz.de', 52.4572, 13.3283);

    -- 9. Orthopäde (2 Praxen)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Orthopädische Praxis Dr. Hofmann')::uuid, 'Orthopädische Praxis Dr. Hofmann', 'Orthopäde', 'Tempelhofer Damm 12, 12099 Berlin', '+49 30 33456789', 'hofmann@ortho-tempelhof.de', 52.4664, 13.3832),
      (md5('Rückenzentrum am Markgrafenpark')::uuid, 'Rückenzentrum am Markgrafenpark', 'Orthopäde', 'Markgrafenstraße 58, 10969 Berlin', '+49 30 44567890', 'info@rueckenzentrum-berlin.de', 52.5021, 13.3955);

    -- 10. Neurologe (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Neurologie am Hackeschen Markt')::uuid, 'Neurologie am Hackeschen Markt', 'Neurologe', 'Rosenthaler Straße 40, 10178 Berlin', '+49 30 55678901', 'info@neuro-mitte.de', 52.5234, 13.4028);

    -- 11. Psychotherapeut (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Psychotherapie Praxis Dr. Hoffmann')::uuid, 'Psychotherapie Praxis Dr. Hoffmann', 'Psychotherapeut', 'Müllerstraße 133, 13349 Berlin', '+49 30 66789012', 'hoffmann@psycho-wedding.de', 52.5559, 13.3448);

    -- 12. Urologe (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Urologische Praxis Dr. Braun')::uuid, 'Urologische Praxis Dr. Braun', 'Urologe', 'Residenzstraße 74, 13409 Berlin', '+49 30 77890123', 'braun@uro-reinickendorf.de', 52.5884, 13.3391);

    -- 13. Pneumologie (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Praxis für Pneumologie Dr. Atemweg')::uuid, 'Praxis für Pneumologie Dr. Atemweg', 'Pneumologie', 'Wilhelmstraße 5, 13585 Berlin', '+49 30 88901234', 'atemweg@pneumo-spandau.de', 52.5349, 13.1947);

    -- 14. Chirurg (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Chirurgische Gemeinschaftspraxis Dr. Meier')::uuid, 'Chirurgische Gemeinschaftspraxis Dr. Meier', 'Chirurg', 'Köpenicker Straße 48, 10179 Berlin', '+49 30 99012345', 'meier@chirurgie-mitte.de', 52.5132, 13.4198);

    -- 15. Innere Medizin (2 Praxen)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Internistische Praxis Dr. Koch')::uuid, 'Internistische Praxis Dr. Koch', 'Innere Medizin', 'Frankfurter Allee 56, 10247 Berlin', '+49 30 10123456', 'koch@innere-fhain.de', 52.5134, 13.4612),
      (md5('Praxis für Innere Medizin Dr. Internist')::uuid, 'Praxis für Innere Medizin Dr. Internist', 'Innere Medizin', 'Landgrafenstraße 14, 10787 Berlin', '+49 30 21234567', 'internist@innere-tiergarten.de', 52.5047, 13.3432);

    -- 16. Sportmedizin (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Sportarztpraxis Dr. Richter')::uuid, 'Sportarztpraxis Dr. Richter', 'Sportmedizin', 'Holzmarktstraße 33, 10179 Berlin', '+49 30 32345678', 'richter@sportarzt-berlin.de', 52.5105, 13.4208);

    -- 17. Radiologie (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Radiologie Berlin Mitte')::uuid, 'Radiologie Berlin Mitte', 'Radiologie', 'Unter den Linden 6, 10099 Berlin', '+49 30 43456789', 'info@radiologie-mitte.de', 52.5170, 13.3902);

    -- 18. Physiotherapie (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Physiotherapie Zentrum Dr. Müller')::uuid, 'Physiotherapie Zentrum Dr. Müller', 'Physiotherapie', 'Mainzer Straße 25, 12053 Berlin', '+49 30 54567890', 'mueller@physio-neukoelln.de', 52.4745, 13.4427);

    -- 19. Allergologie (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Allergologie-Praxis Dr. Fischer')::uuid, 'Allergologie-Praxis Dr. Fischer', 'Allergologie', 'Danckelmannstraße 9, 14059 Berlin', '+49 30 65678901', 'fischer@allergo-charlottenburg.de', 52.5184, 13.2825);

    -- 20. Naturheilkunde (1 Praxis)
    INSERT INTO doctors (id, name, specialty, address, phone, email, latitude, longitude)
    VALUES
      (md5('Praxis für Naturheilkunde Dr. Schmidt')::uuid, 'Praxis für Naturheilkunde Dr. Schmidt', 'Naturheilkunde', 'Wörther Straße 38, 10435 Berlin', '+49 30 76789012', 'schmidt@naturheilkunde-pb.de', 52.5498, 13.4053);

    -- Default-Slots für alle: Mo-Fr 8:00-12:00, 13:00-17:00
    -- Idempotent: ON CONFLICT DO NOTHING (braucht UNIQUE-Constraint nicht,
    -- da doctor_slots.id UUID PK ist — Duplikate werden via Subselect verhindert).
    INSERT INTO doctor_slots (doctor_id, day_of_week, start_time, end_time, is_available)
    SELECT d.id, gs.day, gs.st, gs.et, true
    FROM doctors d
    CROSS JOIN (VALUES
      (1, '08:00'::time, '12:00'::time),
      (1, '13:00'::time, '17:00'::time),
      (2, '08:00'::time, '12:00'::time),
      (2, '13:00'::time, '17:00'::time),
      (3, '08:00'::time, '12:00'::time),
      (3, '13:00'::time, '17:00'::time),
      (4, '08:00'::time, '12:00'::time),
      (4, '13:00'::time, '17:00'::time),
      (5, '08:00'::time, '12:00'::time),
      (5, '13:00'::time, '17:00'::time)
    ) AS gs(day, st, et)
    WHERE NOT EXISTS (
      SELECT 1 FROM doctor_slots ds WHERE ds.doctor_id = d.id LIMIT 1
    );

  END IF;
END $$;

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
-- Renamer fuer Legacy-DBs: alter Spaltenname `purse_priv` -> `purse_priv_pkcs8`.
-- Auf frischen Installationen existiert `purse_priv` nicht mehr (CREATE TABLE nutzt
-- bereits den neuen Namen), dieser Block ist no-op. Auf Legacy-DBs renamed er.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'taler_purses' AND column_name = 'purse_priv'
  ) THEN
    EXECUTE 'ALTER TABLE taler_purses RENAME COLUMN purse_priv TO purse_priv_pkcs8';
  END IF;
END $$;
-- Legacy-Spalte `wallet_priv` (NOT NULL vom alten Schema) droppen - sie wird nicht
-- mehr befuellt (INSERT nutzt wallet_priv_pkcs8). Drop ist idempotent (IF EXISTS).
ALTER TABLE taler_wallets DROP COLUMN IF EXISTS wallet_priv;
-- Doctor-Slots werden automatisch bei Arzt-Registrierung generiert.
