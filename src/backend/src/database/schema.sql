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
-- SEED DATA
-- ============================================

-- Haltestellen kommen live aus OpenStreetMap/Overpass (kein Seed noetig).

-- Demo-Ärzte (Berlin)
INSERT INTO doctors (name, specialty, address, phone, latitude, longitude) VALUES
('Dr. Anna Schmidt', 'Allgemeinmedizin', 'Hauptstraße 10, 10115 Berlin', '+49 30 12345678', 52.5200, 13.4050),
('Dr. Markus Weber', 'Zahnarzt', 'Berlinstraße 20, 10178 Berlin', '+49 30 87654321', 52.5170, 13.3888),
('Dr. Lisa Müller', 'Augenarzt', 'Auguststraße 5, 10117 Berlin', '+49 30 11223344', 52.5250, 13.4020),
('Dr. Thomas Koch', 'HNO-Arzt', 'Kantstraße 15, 10623 Berlin', '+49 30 5556667', 52.5055, 13.3380),
('Dr. Sarah Fischer', 'Hautarzt', 'Schloßstraße 8, 12163 Berlin', '+49 30 9998887', 52.4840, 13.3840);

-- Demo-Wallets
INSERT INTO wallets (user_id, balance, currency) VALUES
('user1', 150.00, 'EUR'),
('user2', 75.50, 'EUR'),
('user3', 200.00, 'EUR');

-- Demo-Ärzte-Slots (Montag-Freitag 8-17 Uhr)
INSERT INTO doctor_slots (doctor_id, day_of_week, start_time, end_time)
SELECT id, generate_series(1, 5), '08:00'::TIME, '12:00'::TIME
FROM doctors;

INSERT INTO doctor_slots (doctor_id, day_of_week, start_time, end_time)
SELECT id, generate_series(1, 5), '13:00'::TIME, '17:00'::TIME
FROM doctors;
