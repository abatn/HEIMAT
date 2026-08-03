-- ====================================================================
-- HEIMAT 2.0 Migration: Health AI Agent
-- ====================================================================
-- Version: 001
-- Erstellt: 2026-08-03
-- Beschreibung: Neue Tabellen für Health AI Agent (Gedächtnis, Medikamente, Profil)
--
-- WICHTIG: Diese Migration ist idempotent (kann mehrfach ausgeführt werden).
-- ====================================================================

-- ====================================================================
-- 1. HEALTH MEMORY (Gedächtnis — Symptom-Verlauf)
-- ====================================================================
-- Speichert Symptome über Tage/Wochen für Ollama-Gedächtnis.
-- Ermöglicht Erkennung chronischer Muster und saisonaler Trends.

CREATE TABLE IF NOT EXISTS health_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    
    -- Symptom-Details
    symptom_text TEXT NOT NULL,                          -- User-Eingabe ("Kopfschmerzen seit 3 Tagen")
    symptom_category VARCHAR(100),                       -- Klassifikation (Kopfschmerz, Bauchschmerz, etc.)
    severity INTEGER CHECK (severity BETWEEN 1 AND 10),  -- Schmerzskala 1-10
    duration VARCHAR(50),                                -- "seit 3 Tagen", "seit 2 Wochen"
    
    -- Triage-Ergebnis (gespeichert)
    triage_level VARCHAR(20),                            -- 'NOTFALL', 'BEREITSCHAFT', 'ROUTINE'
    triage_confidence REAL,                              -- 0.0-1.0
    icd_codes TEXT[],                                    -- ICD-11 Codes (Array)
    
    -- Kontext
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    time_of_day INTEGER CHECK (time_of_day BETWEEN 0 AND 23),  -- 0-23 Uhr
    weather_condition VARCHAR(50),                       -- Optional: Wetter bei Symptomen
    season VARCHAR(20),                                  -- 'fruehling', 'sommer', 'herbst', 'winter'
    
    -- Medikamente (optional)
    medications_used TEXT[],                             -- Welche Medikamente genommen wurden
    
    -- Follow-up
    is_resolved BOOLEAN DEFAULT false,                   -- Ist das Symptom verschwunden?
    resolved_at TIMESTAMP,
    doctor_visit BOOLEAN DEFAULT false,                  -- Hat der User einen Arzt besucht?
    doctor_id UUID,                                      -- Welcher Arzt (falls gebucht)
    
    -- Metadaten
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes fuer Health Memory
CREATE INDEX IF NOT EXISTS idx_health_memory_user ON health_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_health_memory_symptom ON health_memory(symptom_category);
CREATE INDEX IF NOT EXISTS idx_health_memory_created ON health_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_health_memory_user_date ON health_memory(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_memory_user_symptom ON health_memory(user_id, symptom_category);
CREATE INDEX IF NOT EXISTS idx_health_memory_triage ON health_memory(triage_level);
CREATE INDEX IF NOT EXISTS idx_health_memory_resolved ON health_memory(is_resolved) WHERE is_resolved = false;

-- ====================================================================
-- 2. USER MEDICATIONS (Medikamentenliste)
-- ====================================================================
-- User speichert seine Medikamente fuer Interaktions-Checks.

CREATE TABLE IF NOT EXISTS user_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    
    -- Medikament
    name VARCHAR(255) NOT NULL,                          -- "Aspirin", "Ibuprofen 400mg"
    active_ingredient VARCHAR(255),                      -- "ASS", "Ibuprofen"
    dosage VARCHAR(100),                                 -- "500mg", "1-0-1"
    frequency VARCHAR(100),                              -- "taeglich", "bei Bedarf"
    
    -- Kategorie
    category VARCHAR(100),                               -- "Schmerzmittel", "Blutdruck", "Antibiotikum"
    is_prescription BOOLEAN DEFAULT false,               -- Rezeptpflichtig?
    
    -- Zeitraum
    start_date DATE,
    end_date DATE,                                       -- NULL = noch aktiv
    is_active BOOLEAN DEFAULT true,
    
    -- Notizen
    notes TEXT,                                          -- "Nur nach dem Essen"
    
    -- Metadaten
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes fuer User Medications
CREATE INDEX IF NOT EXISTS idx_medications_user ON user_medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON user_medications(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_medications_name ON user_medications(name);
CREATE INDEX IF NOT EXISTS idx_medications_category ON user_medications(category);

-- ====================================================================
-- 3. MEDICATION INTERACTIONS (Bekannte Interaktionen — Referenz)
-- ====================================================================
-- Referenz-Tabelle fuer bekannte Medikamenten-Interaktionen.
-- Quellen: BfArM, ABDA, DEGAM Leitlinien.

CREATE TABLE IF NOT EXISTS medication_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Interaktions-Paar
    drug_a VARCHAR(255) NOT NULL,                        -- "ASS"
    drug_b VARCHAR(255) NOT NULL,                        -- "Ibuprofen"
    
    -- Schweregrad
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('schwerwiegend', 'mittel', 'leicht')),
    
    -- Beschreibung
    description TEXT NOT NULL,                           -- "Erhoehtes Blutungsrisiko"
    recommendation TEXT NOT NULL,                        -- "Vermeiden Sie die Kombination"
    
    -- Quelle
    source VARCHAR(100),                                 -- "BfArM", "ABDA", "DEGAM"
    
    -- Metadaten
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Eindeutigkeit
    UNIQUE (drug_a, drug_b)
);

-- Indizes fuer Medication Interactions
CREATE INDEX IF NOT EXISTS idx_interactions_drug_a ON medication_interactions(drug_a);
CREATE INDEX IF NOT EXISTS idx_interactions_drug_b ON medication_interactions(drug_b);
CREATE INDEX IF NOT EXISTS idx_interactions_severity ON medication_interactions(severity);

-- ====================================================================
-- 4. USER HEALTH PROFILE (Gesundheitsprofil)
-- ====================================================================
-- Gesundheitsprofil fuer praeventive Empfehlungen und bessere Triage.

CREATE TABLE IF NOT EXISTS user_health_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Demografie
    birth_date DATE,
    gender VARCHAR(20),                                  -- 'maennlich', 'weiblich', 'divers'
    weight_kg DECIMAL(5,1),
    height_cm DECIMAL(5,1),
    
    -- Risikofaktoren
    is_smoker BOOLEAN DEFAULT false,
    is_pregnant BOOLEAN DEFAULT false,
    
    -- Vorerkrankungen
    chronic_conditions TEXT[],                           -- ['Diabetes Typ 2', 'Bluthochdruck']
    allergies TEXT[],                                    -- ['Penicillin', 'Nuesse']
    family_history TEXT[],                               -- ['Herzinfarkt (Vater 58)']
    
    -- Versicherung
    insurance_type VARCHAR(50),                          -- 'gesetzlich', 'privat'
    
    -- Praeferenzen
    preferred_language VARCHAR(10),                      -- 'de', 'en', 'tr'
    preferred_gender_doctor VARCHAR(20),                 -- 'maennlich', 'weiblich', 'egal'
    needs_accessibility BOOLEAN DEFAULT false,
    
    -- Metadaten
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indizes fuer User Health Profile
CREATE INDEX IF NOT EXISTS idx_health_profile_user ON user_health_profile(user_id);

-- ====================================================================
-- 5. MEDICATION INTERACTIONS SEED (Beispiel-Interaktionen)
-- ====================================================================
-- Idempotent: wird nur ausgefuehrt wenn Tabelle leer ist.
-- Quellen: BfArM, ABDA, DEGAM Leitlinien.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM medication_interactions LIMIT 1) THEN
        
        INSERT INTO medication_interactions (drug_a, drug_b, severity, description, recommendation, source) VALUES
        
        -- Schwerwiegende Interaktionen
        ('ASS', 'Ibuprofen', 'schwerwiegend', 
         'ASS + Ibuprofen: Erhoehtes Blutungsrisiko durch kombinierte Hemmung der Thrombozytenfunktion.',
         'Vermeiden Sie die Kombination. Nutzen Sie entweder ASS ODER Ibuprofen, nicht beide. Sprechen Sie mit Ihrem Arzt ueber Alternativen.',
         'BfArM'),
        
        ('Marcumar', 'ASS', 'schwerwiegend',
         'Marcumar + ASS: Erhoehtes Blutungsrisiko, insbesondere im Magen-Darm-Trakt.',
         'Kombination vermeiden. Bei zwingender Indikation: Gastroprotektive Therapie und engmaschige INR-Kontrolle.',
         'BfArM'),
        
        ('Metformin', 'Kontrastmittel', 'schwerwiegend',
         'Metformin + iodhaltige Kontrastmittel: Risiko einer Laktatazidose.',
         'Metformin 48h vor und 48h nach Kontrastmittel-Gabe absetzen. Nierenfunktion pruefen.',
         'DEGAM'),
        
        -- Mittlere Interaktionen
        ('Ibuprofen', 'Ramipril', 'mittel',
         'Ibuprofen kann die blutdrucksenkende Wirkung von Ramipril abschwaechen.',
         'Blutdruck engmaschig kontrollieren. Bei Langzeiteinnahme: Alternative Schmerzmittel erwaeugen.',
         'ABDA'),
        
        ('Paracetamol', 'Alkohol', 'mittel',
         'Paracetamol + Alkohol: Erhoehtes Risiko fuer Leberschaeden.',
         'Waeahrend der Einnahme von Paracetamol Alkohol meiden oder nur in geringen Mengen konsumieren.',
         'BfArM'),
        
        ('Aspirin', 'Alkohol', 'mittel',
         'ASS + Alkohol: Erhoehtes Blutungsrisiko, insbesondere im Magen.',
         'Waeahrend der Einnahme von ASS Alkohol meiden.',
         'BfArM'),
        
        -- Leichte Interaktionen
        ('Ibuprofen', 'Paracetamol', 'leicht',
         'Kombination ist in der Regel sicher, aber Wirkstoffe sollten nicht gleichzeitig eingenommen werden.',
         'Bei Bedarf im Wechsel einnehmen (z.B. Ibuprofen morgens, Paracetamol nachmittags).',
         'DEGAM'),
        
        ('Cetirizin', 'Alkohol', 'leicht',
         'Cetirizin + Alkohol: Verstaerkte Sedierung moeglich.',
         'Alkoholkonsum waehrend der Einnahme einschraenken.',
         'ABDA');
        
    END IF;
END $$;

-- ====================================================================
-- 6. COMPLETION MESSAGE
-- ====================================================================
-- Erfolgreiche Migration wird in der Log ausgegeben.

DO $$
BEGIN
    RAISE NOTICE 'Migration 001_health_ai_agent.sql erfolgreich ausgefuehrt:';
    RAISE NOTICE '  - health_memory (Gedächtnis) erstellt';
    RAISE NOTICE '  - user_medications (Medikamente) erstellt';
    RAISE NOTICE '  - medication_interactions (Interaktionen) erstellt';
    RAISE NOTICE '  - user_health_profile (Profil) erstellt';
    RAISE NOTICE '  - Beispiel-Interaktionen geladen';
END $$;
