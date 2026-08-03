-- =====================================================================
-- Migration 002: Health AI Agent Phase 2
-- Mental Health (PHQ-9) + Prävention + Nachsorge
-- =====================================================================

-- =====================================================================
-- 1. PHQ-9 Responses (Depressions-Screening)
-- =====================================================================
CREATE TABLE IF NOT EXISTS phq9_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    
    -- PHQ-9 Antworten (0=Überhaupt nicht, 1=Mehrtage, 
    -- 2=Mehr als die Hälfte, 3=Fast täglich)
    q1_lustlos INTEGER CHECK (q1_lustlos BETWEEN 0 AND 3),
    q2_niedergeschlagen INTEGER CHECK (q2_niedergeschlagen BETWEEN 0 AND 3),
    q3_schlafprobleme INTEGER CHECK (q3_schlafprobleme BETWEEN 0 AND 3),
    q4_muedigkeit INTEGER CHECK (q4_muedigkeit BETWEEN 0 AND 3),
    q5_appetit INTEGER CHECK (q5_appetit BETWEEN 0 AND 3),
    q6_schlecht INTEGER CHECK (q6_schlecht BETWEEN 0 AND 3),
    q7_konzentration INTEGER CHECK (q7_konzentration BETWEEN 0 AND 3),
    q8_bewegung INTEGER CHECK (q8_bewegung BETWEEN 0 AND 3),
    q9_selbstverletzung INTEGER CHECK (q9_selbstverletzung BETWEEN 0 AND 3),
    
    -- Berechneter Score
    total_score INTEGER,  -- Summe 0-27
    severity VARCHAR(20),  -- 'leicht', 'mittel', 'schwer', 'sehr_schwer'
    
    -- Ollama-Analyse
    ai_analysis TEXT,      -- Ollama's Bewertung
    ai_recommendation TEXT, -- Empfehlung
    
    -- Kontext
    additional_notes TEXT, -- User-Zusatzinfos
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phq9_user ON phq9_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_phq9_date ON phq9_responses(created_at DESC);

-- =====================================================================
-- 2. Prevention Recommendations (Vorsorge-Empfehlungen)
-- =====================================================================
CREATE TABLE IF NOT EXISTS prevention_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    
    -- Empfehlung
    category VARCHAR(50),        -- 'Vorsorge', 'Screening', 'Impfung', 'Lebensstil'
    title VARCHAR(255),
    description TEXT,
    priority VARCHAR(20),        -- 'hoch', 'mittel', 'niedrig'
    
    -- Basiert auf
    based_on VARCHAR(100),       -- 'Alter', 'Geschlecht', 'Risikofaktor', 'Familie'
    relevant_until DATE,         -- Gültig bis
    
    -- Status
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    doctor_id UUID,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prevention_user ON prevention_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_prevention_active ON prevention_recommendations(user_id, is_completed);

-- =====================================================================
-- 3. Post-Appointment Follow-ups (Nachsorge)
-- =====================================================================
CREATE TABLE IF NOT EXISTS post_appointment_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    appointment_id UUID,
    doctor_id UUID,
    
    -- Follow-up Details
    followup_date DATE NOT NULL,       -- Wann soll gefragt werden?
    followup_type VARCHAR(50),         -- 'check_in', 'medication', 'symptom'
    
    -- User-Response
    responded BOOLEAN DEFAULT false,
    response_text TEXT,
    response_severity INTEGER,         -- 1-10
    
    -- Ollama-Analyse
    ai_analysis TEXT,
    needs_followup BOOLEAN DEFAULT false, -- Braucht weiteres Follow-up?
    next_followup_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'responded', 'closed'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_followup_user ON post_appointment_followups(user_id);
CREATE INDEX IF NOT EXISTS idx_followup_pending ON post_appointment_followups(status, followup_date);

-- =====================================================================
-- 4. Erweiterung user_health_profile (bereits in Migration 001)
-- =====================================================================
-- Die Spalten werden nur hinzugefügt, falls sie noch nicht existieren
DO $$
BEGIN
    -- last_checkup_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_health_profile' AND column_name = 'last_checkup_date'
    ) THEN
        ALTER TABLE user_health_profile ADD COLUMN last_checkup_date DATE;
    END IF;
    
    -- next_checkup_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_health_profile' AND column_name = 'next_checkup_date'
    ) THEN
        ALTER TABLE user_health_profile ADD COLUMN next_checkup_date DATE;
    END IF;
    
    -- risk_factors
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_health_profile' AND column_name = 'risk_factors'
    ) THEN
        ALTER TABLE user_health_profile ADD COLUMN risk_factors TEXT[];
    END IF;
    
    -- family_history_detailed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_health_profile' AND column_name = 'family_history_detailed'
    ) THEN
        ALTER TABLE user_health_profile ADD COLUMN family_history_detailed JSONB;
    END IF;
END $$;

-- =====================================================================
-- 5. Seed-Daten: PHQ-9 Fragen (Referenz)
-- =====================================================================
-- PHQ-9 ist ein standardisiertes Instrument, keine Seed-Daten nötig
-- Die Fragen sind in der Software hardcoded (siehe mentalHealthService.ts)

-- =====================================================================
-- 6. Seed-Daten: Präventions-Regeln (Referenz)
-- =====================================================================
-- Präventions-Regeln werden in der Software definiert (siehe preventionService.ts)
-- Beispiele:
-- - Prostatavorsorge: Männlich, ≥50
-- - Mammographie: Weiblich, ≥50
-- - Darmkrebsvorsorge: ≥50
-- - Lungenkrebs-Screening: Raucher, ≥50
-- - Herz-Kreislauf-Check: Risikofaktoren

-- =====================================================================
-- FERTIG
-- =====================================================================
-- Migration 002 abgeschlossen.
-- Tabellen: phq9_responses, prevention_recommendations, post_appointment_followups
-- Erweiterung: user_health_profile (4 neue Spalten)
