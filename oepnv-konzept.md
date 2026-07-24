# ÖPNV-Architektur HEIMAT 2.0 — Konzept (Phase 1b, überarbeitet)

> **Status:** Konzept zur Freigabe. Kein Code wird vor `OK` geschrieben.
> **Grundlage:** `bauplan.md` §12 (Phase 1b) + §1 (100% Open Source, keine Lizenzen) + AGENTS.md.
> **Entscheidung des Users:** EFA-Scraping (20 Verbünde / finalrewind-Mirror) wird verworfen.
> Stattdessen: **eigene GTFS + RAPTOR-Engine**, exakt wie Bauplan spezifiziert.

---

## 0. Warum wir vom EFA-Ansatz weggehen

- EFA-Scraping ist ein **reaktiver Legacy-Ansatz**: wir zappen fremde Verbund-APIs an,
  jeder Verbund hat eigene XML/Session-Logik, und es gibt keine einheitliche Quelle.
- `dbf.finalrewind.org` (der einzige von Render erreichbare Mirror) ist ein **Hobby-Mirror
  mit HTTP-429-Rate-Limit** → unzuverlässig im Produktivbetrieb, keine SLA, kein "echtes" System.
- Bauplan §1 fordert: *"100% Open Source, öffentliche Daten, keine Verträge/Lizenzen"* —
  GTFS (`gtfs.de/nv_free`) erfüllt das. EFA-Scraping tut es faktisch nicht sauber.

**Fazit:** Die richtige, nicht-reaktive Lösung ist eine **eigene Routing-Engine über offene
GTFS-Daten** — wir besitzen die Logik, nicht der Verbund.

---

## 1. Architektur (Bauplan §12, 1:1 übernommen)

```
┌─────────────────────────────────────────────────┐
│                    Frontend                       │
│  Departure-Board (ETA-Cards) │ Journey-Planner   │
├─────────────────────────────────────────────────┤
│                  Backend API (Render)             │
│  /departures │ /journey │ /stops/match           │
├─────────────────────────────────────────────────┤
│              RAPTOR Engine (in-memory + DB)       │
│  Stops → Trips → Routes │ Walking-Footpaths      │
├─────────────────────────────────────────────────┤
│           PostgreSQL (Supabase)                   │
│  gtfs_stops │ gtfs_routes │ gtfs_trips           │
│  gtfs_stop_times │ gtfs_calendar │ gtfs_stop_match│
├─────────────────────────────────────────────────┤
│           Datenquelle (offen, kein Token)         │
│  gtfs.de/nv_free/latest.zip (DE, täglich)        │
│  Overpass (Haltestellen) │ OSRM (Walking)         │
└─────────────────────────────────────────────────┘
```

---

## 2. Komponenten & Zustand (was schon da ist)

| Baustein | Datei | Zustand | Aktion |
|---|---|---|---|
| GTFS-Schema (6 Tabellen + status) | `src/backend/src/database/schema.sql:111-192` | ✅ vorhanden | unverändert |
| GTFS-Import (Streaming, IPv4) | `src/backend/scripts/import-gtfs-local.ts` | ✅ vorhanden | **wird genutzt** (nicht auf Render) |
| RAPTOR-Engine | `src/backend/src/services/raptorService.ts` | ❌ gelöscht | **neu bauen** (sql-basiert, RAM-schonend) |
| GTFS-Service | `src/backend/src/services/gtfsService.ts` | ❌ gelöscht | **neu bauen** (nur Status/Cache-Queries) |
| Mobility-Routen | `src/backend/src/routes/mobility.ts` | ⚠️ nutzt EFA | auf RAPTOR umstellen |
| Admin-Debug | `src/backend/src/routes/admin.ts` | ⚠️ EFA-Endpoints | durch GTFS-Status ersetzen |
| Frontend EFA-Felder | `departure_board.dart` / `journey_planner.dart` | ⚠️ EFA-Schema | auf RAPTOR/GTFS-Schema anpassen |
| EFA-Service | `src/backend/src/services/efaService.ts` | ⚠️ aktiver Ansatz | **löschen** |

---

## 3. GTFS-Import (Bauplan §12.1 + §3)

- **Wo:** via `import-gtfs-local.ts` (nicht auf Render, wegen 244MB RAM-Limit).
  - Download `https://download.gtfs.de/germany/nv_free/latest.zip` (~244MB).
  - Streaming-Parser (schon implementiert, vermeidet OOM bei >500MB `stop_times`).
  - Schreibt direkt in Supabase-Postgres (IPv4 erzwungen via `dns.lookup`).
- **Wann:** einmalig + täglich (cron oder manuell). Bauplan: *"Feed-Import NICHT über Render"*.
- **Verifikation:** `SELECT count(*) FROM gtfs_*` nach Import → Ziel: ~500k stops, ~10M stop_times.
- **Bestehender Block (vergangen):** IPv6-ENETUNREACH zu Supabase. Gelöst durch
  `resolveToIpv4()` im Script. **Nächster Schritt vor Code:** Import ausführen + verifizieren.

---

## 4. RAPTOR-Engine (Bauplan §12.3) — das Herzstück

Statt GTFS komplett in RAM zu laden (Render 512MBLimit), **sql-gestützter RAPTOR**:
- Round-based Public Transit Optimized Router direkt über die GTFS-Tabellen.
- Initialisierung: Fuß-Wege (Walking-Footpaths) zwischen nahen Stops via OSRM/Overpass (100m).
- Pareto-optimal: schnellste + wenigste Umstiege (Bauplan §12.3).
- Kalender-Filter: nur heute gültige `service_id` aus `gtfs_calendar`.
- **Kein** GTFS-RT nötig für MVP (Verspätungen = Innovations-Layer, siehe §6).

### API-Endpoints (Bauplan §12.5)
- `GET /api/mobility/departures?stop_id=&limit=` → nächste Abfahrten (sql, `departure_time >= now`)
- `GET /api/mobility/journey?from_lat=&from_lng=&to_lat=&to_lng=` → RAPTOR-Routing
- `GET /api/mobility/stops/match?osm_id=` → Overpass↔GTFS-Matching (`gtfs_stop_match`)

---

## 5. Stop-Matching (Bauplan §12.4)

- Overpass-Haltestelle (OSM-ID + lat/lng) ↔ GTFS-Stop (≤100m Koordinate).
- Fuzzy Name-Match (Levenshtein) als Score.
- Ergebnis in `gtfs_stop_match` gecached → wiederverwendbar.

---

## 6. Innovations-Layer (Bauplan §12.7) — der nicht-reaktive Teil

Das ist die eigentliche "Innovation", nicht das Anzapfen einer API:

1. **Smart Transfer:** Walking-Connections zwischen nahegelegenen Stops automatisch
   als Umstiegs-Option anbieten (statt nur gleicher Stop).
2. **Accessibility-Routing:** barrierefreie Stops (`wheelchair_boarding`) bevorzugen.
3. **ML-Verspätungsvorhersage:** historische Abweichungen lernen (LightGBM/spaCy-Stack
   aus `AI-Architektur.md`) → ETA statt starrer Fahrplanzeit. *Optionale Phase 2.*

---

## 7. Deployment & Tradeoffs (Bauplan §9)

- **Cold-Start:** erste Abfahrts-Abfrage nach Deploy etwas langsamer (DB-Warmup).
  RAPTOR sql-basiert → kein riesiger RAM-Graph nötig.
- **GTFS täglich neu:** cron-Import, nicht auf Render.
- **Kein Token, keine Lizenz** → erfüllt Projektprinzip.

---

## 8. Reihenfolge der Umsetzung (nach OK)

1. **GTFS-Import ausführen + verifizieren** (`import-gtfs-local.ts` gegen Supabase).
2. `raptorService.ts` neu bauen (sql-basiert, Departures + Journey).
3. `gtfsService.ts` neu bauen (Status/Match-Cache-Queries).
4. `mobility.ts` auf RAPTOR umstellen (`/departures`, `/journey`, `/stops/match`).
5. `admin.ts` EFA-Endpoints → `/gtfs-status` ersetzen.
6. `efaService.ts` löschen.
7. Frontend EFA-Felder → RAPTOR/GTFS-Schema (`departure_board.dart`, `journey_planner.dart`).
8. Verifikation: `tsc --noEmit`, `flutter analyze`, Live-`curl` Render (Berlin ≠ München).

---

## 9. Offene Fragen an den User (nur falls relevant)

- ML-Verspätungsvorhersage jetzt oder später? (Bauplan markiert sie als Innovation, nicht MVP.)
- GTFS-Feed `nv_free` (ganz DE) oder regionaler (VBB/MVV) für schnelleren Import?
