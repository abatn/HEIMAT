# HEIMAT 2.0 — Datenqualitäts-Audit

## Executive Summary

Das HEIMAT-Datenmodell (PostgreSQL) umfasst **16 Tabellen** über 4 Domänen (Mobilität, Finanzen, Gesundheit, GTFS). Die Analyse identifiziert **3 kritische**, **4 hohe** und **5 mittlere** Qualitätsprobleme. Die Struktur ist solide, aber es gibt Inkonsistenzen bei Datentypen, fehlende Constraints und potenzielle Integrity-Probleme.

---

## 1. Datenmodell-Übersicht

### 1.1 Tabellenstruktur

| Domäne | Tabellen | Primärschlüssel | Fremdschlüssel |
|--------|----------|-----------------|----------------|
| **Mobilität** | `stops`, `connections` | UUID | `connections → stops` |
| **Finanzen** | `wallets`, `transactions` | UUID | `transactions → wallets` |
| **Gesundheit** | `doctors`, `doctor_slots`, `appointments` | UUID | `slots → doctors`, `appointments → doctors` |
| **GTFS** | `gtfs_stops`, `gtfs_routes`, `gtfs_trips`, `gtfs_stop_times`, `gtfs_calendar`, `gtfs_stop_match`, `gtfs_import_status` | VARCHAR/SERIAL | Mehrere FK-Beziehungen |
| **Taler** | `taler_wallets`, `taler_purses`, `taler_transactions` | UUID | `purses → wallets`, `transactions → purses` |
| **ML** | `delay_logs` | SERIAL | Keine FK |

### 1.2 Gesamtstatistik

| Metrik | Wert |
|--------|------|
| **Tabellen** | 16 |
| **Indizes** | 25 |
| **Fremdschlüssel** | 12 |
| **UNIQUE-Constraints** | 5 |
| **CHECK-Constraints** | 0 |

---

## 2. Kritische Probleme (Severity: CRITICAL)

### 2.1 Fehlende CHECK-Constraints

**Problem:** Keine einzige Tabelle hat CHECK-Constraints für Wertebereiche.

**Betroffene Tabellen:**

| Tabelle | Spalte | Erwarteter Check | Risiko |
|---------|--------|-----------------|--------|
| `wallets` | `balance` | `balance >= 0` | Negatives Guthaben möglich |
| `transactions` | `status` | `IN ('pending', 'completed',', 'failed')` | Ungültige Status-Werte |
| `transactions` | `amount` | `amount > 0` | Negative Transaktionen |
| `doctor_slots` | `day_of_week` | `BETWEEN 0 AND 6` | Ungültige Tage |
| `appointments` | `status` | `IN ('pending', 'confirmed', 'cancelled')` | Ungültige Status |
| `taler_purses` | `status` | `IN ('created', 'merged', 'expired')` | Ungültige Status |

**Empfehlung:**
```sql
ALTER TABLE wallets ADD CONSTRAINT chk_balance_non_negative
  CHECK (balance >= 0);

ALTER TABLE transactions ADD CONSTRAINT chk_status_valid
  CHECK (status IN ('pending', 'completed', 'failed'));

ALTER TABLE transactions ADD CONSTRAINT chk_amount_positive
  CHECK (amount > 0);
```

### 2.2 Inkonsequente Datentypen für Geldbeträge

**Problem:** Geldbeträge werden als `DECIMAL(10,2)` UND als `VARCHAR(50)` gespeichert.

| Tabelle | Spalte | Datentyp | Problem |
|---------|--------|----------|---------|
| `wallets` | `balance` | `DECIMAL(10,2)` | Konsistent |
| `transactions` | `amount` | `DECIMAL(10,2)` | Konsistent |
| `taler_wallets` | `balance` | `VARCHAR(50)` | **INKONSISTENT** |
| `taler_purses` | `amount` | `VARCHAR(50)` | **INKONSISTENT** |
| `taler_transactions` | `amount` | `VARCHAR(50)` | **INKONSISTENT** |

**Risiko:**
- Keine numerischen Berechnungen in SQL möglich
- Sortierung numerisch inkorrekt
- Aggregationen erfordern CAST

**Empfehlung:**
```sql
-- Migration zu DECIMAL
ALTER TABLE taler_wallets
  ALTER COLUMN balance TYPE DECIMAL(12,2) USING balance::DECIMAL;

ALTER TABLE taler_purses
  ALTER COLUMN amount TYPE DECIMAL(12,2) USING amount::DECIMAL;

ALTER TABLE taler_transactions
  ALTER COLUMN amount TYPE DECIMAL(12,2) USING amount::DECIMAL;
```

### 2.3 Fehlende ON DELETE-Strategien

**Problem:** Nur `doctor_slots` hat `ON DELETE CASCADE`. Alle anderen FKs haben implizites `NO ACTION`.

**Betroffene FKs:**

| FK | Aktuell | Risiko |
|----|---------|--------|
| `connections.departure_stop_id → stops.id` | NO ACTION | Orts-Löschung blockiert Verbindungen |
| `connections.arrival_stop_id → stops.id` | NO ACTION | Wie oben |
| `transactions.from_wallet_id → wallets.id` | NO ACTION | Wallet-Löschung blockiert Transaktionen |
| `transactions.to_wallet_id → wallets.id` | NO ACTION | Wie oben |
| `gtfs_trips.route_id → gtfs_routes.route_id` | NO ACTION | Routen-Löschung blockiert Fahrten |
| `gtfs_stop_times.trip_id → gtfs_trips.trip_id` | NO ACTION | Fahrten-Löschung blockiert Zeiten |

**Empfehlung:**
```sql
-- Für nicht-kritische Beziehungen: CASCADE oder SET NULL
ALTER TABLE connections
  DROP CONSTRAINT IF EXISTS connections_departure_stop_id_fkey,
  ADD CONSTRAINT connections_departure_stop_id_fkey
    FOREIGN KEY (departure_stop_id) REFERENCES stops(id) ON DELETE CASCADE;

-- Für Finanzen: RESTRICT (Löschung verhindern)
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_from_wallet_id_fkey,
  ADD CONSTRAINT transactions_from_wallet_id_fkey
    FOREIGN KEY (from_wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT;
```

---

## 3. Hohe Probleme (Severity: HIGH)

### 3.1 Fehlende Updated-At-Trigger

**Problem:** `updated_at` wird nie automatisch aktualisiert.

**Betroffene Tabellen:** `stops`, `wallets`, `doctors`, `appointments`, `taler_wallets`

**Empfehlung:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stops_updated_at
  BEFORE UPDATE ON stops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 Keine Indexe auf häufig abgefragten Spalten

**Problem:** Einige WHERE-Klauseln haben keine Index-Unterstützung.

| Query-Muster | Fehlender Index |
|-------------|-----------------|
| `WHERE status = 'completed'` | `transactions(status)` existiert, aber nicht für `taler_transactions(status)` |
| `WHERE created_at > NOW() - INTERVAL '7 days'` | Kein Index auf `created_at` in den meisten Tabellen |
| `WHERE doctor_id = ? AND day_of_week = ?` | Komposit-Index fehlt |

**Empfehlung:**
```sql
CREATE INDEX idx_taler_transactions_status ON taler_transactions(status);
CREATE INDEX idx_appointments_created ON appointments(created_at);
CREATE INDEX idx_doctor_slots_composite ON doctor_slots(doctor_id, day_of_week);
```

### 3.3 Redundante Timestamp-Spalten

**Problem:** Einige Tabellen haben `created_at` und `updated_at`, andere nur `created_at`.

| Tabelle | created_at | updated_at |
|---------|-----------|------------|
| `stops` | ✅ | ✅ |
| `connections` | ✅ | ❌ |
| `wallets` | ✅ | ✅ |
| `transactions` | ✅ | ❌ |
| `doctors` | ✅ | ✅ |
| `doctor_slots` | ✅ | ❌ |
| `appointments` | ✅ | ✅ |

**Empfehlung:** Einheitlich `created_at` + `updated_at` überall einführen.

### 3.4 Keine Soft-Delete-Strategie

**Problem:** Löschung entfernt Daten physisch. Kein Archivierungskonzept.

**Risiko:**
- Vergangene Transaktionen gehen verloren
- Historische GTFS-Daten nicht wiederherstellbar
- Audit-Trail fehlt

**Empfehlung:** `deleted_at TIMESTAMP NULL` Spalte hinzufügen für kritische Tabellen.

---

## 4. Mittlere Probleme (Severity: MEDIUM)

### 4.1 GTFS: Kein `ON DELETE CASCADE` fürgtige FKs

**Problem:** `gtfs_stop_times` → `gtfs_trips` → `gtfs_routes` Kette ohne CASCADE.

**Risiko:** GTFS-Reimport erfordert manuelles Löschen in korrekter Reihenfolge.

### 4.2 `delay_logs` ohne FK zu `gtfs_trips`

**Problem:** `delay_logs.trip_id` referenziert keine Tabelle.

**Risiko:** Orphan-Daten möglich, referenzielle Integrität nicht gegeben.

### 4.3 `gtfs_calendar` mit VARCHAR-Datumsfeldern

**Problem:** `start_date` und `end_date` sind `VARCHAR(8)` statt `DATE`.

**Risiko:** Datumsvergleiche inkorrekt, keine INTERVAL-Berechnungen.

### 4.4 Kein Unique-Constraint für `doctors.name + address`

**Problem:** Gleicher Arzt kann mehrfach eingetragen werden.

### 4.5 `connections`-Tabelle potenziell redundant

**Problem:** `connections` speichert statische Verbindungen, aber GTFS `gtfs_stop_times` dynamische.

**Empfehlung:** Prüfen ob `connections` überhaupt benötigt wird (oder nur für Overpass-Fallback).

---

## 5. Datenfluss-Analyse

### 5.1 Datenpipelines

```
Overpass API ──→ stops (Cache) ──→ Frontend
                  │
GTFS-Datei ──→ gtfs_* Tabellen ──→ RAPTOR ──→ departures/journey
                  │
Vendo API ──→ dbRestService ──→ Frontend (live)
                  │
Taler SDK ──→ taler_* Tabellen ──→ Frontend (Wallet)
                  │
Overpass API ──→ doctors (Cache) ──→ Frontend
```

### 5.2 Datenqualitäts-Checks pro Pipeline

| Pipeline | Check | Methode |
|----------|-------|---------|
| Overpass → stops | Duplikate (osm_id) | UNIQUE Index ✅ |
| GTFS → gtfs_* | Schema-Konformität | Import-Script |
| Vendo → departures | Echtzeit vs. geplant | delay_minutes Tracking |
| Taler → transactions | Referenzielle Integrität | FK + Trigger |

---

## 6. Automatisierte Tests

### 6.1 Empfohlene DB-Tests

```sql
-- Test: Kein negativer Saldo
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM wallets WHERE balance < 0
) THEN 'FAIL' ELSE 'PASS' END AS test_balance_non_negative;

-- Test: Alle Status-Werte gültig
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM transactions
  WHERE status NOT IN ('pending', 'completed', 'failed')
) THEN 'FAIL' ELSE 'PASS' END AS test_valid_status;

-- Test: Keine Orphan-Records
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM transactions t
  LEFT JOIN wallets w ON t.from_wallet_id = w.id
  WHERE w.id IS NULL
) THEN 'FAIL' ELSE 'PASS' END AS test_no_orphan_transactions;
```

### 6.2 Monitoring-Query

```sql
-- Tägliche Datenqualitäts-Übersicht
SELECT
  'wallets' AS tabelle,
  COUNT(*) AS gesamt,
  COUNT(CASE WHEN balance < 0 THEN 1 END) AS negative_balancen,
  COUNT(CASE WHEN updated_at < NOW() - INTERVAL '30 days' THEN 1 END) AS stale_records
FROM wallets
UNION ALL
SELECT
  'transactions',
  COUNT(*),
  COUNT(CASE WHEN status NOT IN ('pending', 'completed', 'failed') THEN 1 END),
  COUNT(CASE WHEN completed_at IS NULL AND status = 'completed' THEN 1 END)
FROM transactions;
```

---

## 7. Priorisierte Empfehlungen

### Sofort (vor nächstem Release)

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 1 | CHECK-Constraints für Status und Beträge | 1h | Hoch |
| 2 | ON DELETE-Strategien für FKs | 2h | Hoch |
| 3 | Updated-At-Trigger | 1h | Mittel |

### Mittelfristig (nächste 3 Monate)

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 4 | Taler-VARCHAR → DECIMAL Migration | 2h | Hoch |
| 5 | Fehlende Indexe hinzufügen | 1h | Mittel |
| 6 | gtfs_calendar DATE-Datumsfelder | 1h | Niedrig |

### Langfristig

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 7 | Soft-Delete für kritische Tabellen | 4h | Mittel |
| 8 | Audit-Log-Tabelle | 4h | Niedrig |
| 9 | DB-Health-Check-Endpoint | 2h | Mittel |

---

## 8. Fazit

| Metrik | Wert |
|--------|------|
| **Gesamtbewertung** | Solide, mit Verbesserungspotenzial |
| **Kritische Probleme** | 3 (Constraints, Datentypen, FKs) |
| **Hohe Probleme** | 4 (Trigger, Indexe, Timestamps, Soft-Delete) |
| **Mittlere Probleme** | 5 (GTFS, Calendar, Unique Constraints) |
| **Nächster Schritt** | CHECK-Constraints + ON DELETE implementieren |

Das Datenmodell ist funktional und deckt alle MVP-Anforderungen ab. Die identifizierten Probleme sind typisch für Early-Stage-Projekte und können iterativ behoben werden.

---

*Analyse basiert auf schema.sql (Stand: Juli 2026). Alle Empfehlungen sind Vorschläge — keine muss zwingend umgesetzt werden.*
