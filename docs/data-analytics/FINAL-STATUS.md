# HEIMAT 2.0 — Abschluss-Status: Skills, Analysen & Agent-Prompt

## Zusammenfassung

Alle 6 Data-Analytics-Analysen wurden durchgeführt, der heimat-dev Skill erstellt, und der Agent-Prompt aktualisiert. Die wichtigste Erkenntnis: **7 von 8 dokumentierten Bugs sind bereits behoben.**

---

## 1. Skills

### heimat-dev Skill (erstellt)

**Pfad:** `.opencode/skills/heimat-dev/SKILL.md`

| Inhalt | Status |
|--------|--------|
| Critical Rules (git add -A, vendored SDK, German commits) | ✅ |
| Flutter & Backend Commands | ✅ |
| CI Gates | ✅ |
| Known Bugs & Fixes (6 Bugs dokumentiert) | ✅ Aktualisiert |
| Conventions & File Map | ✅ |

---

## 2. Data Analytics Analysen (6/6 abgeschlossen)

| # | Analyse | Datei | Key Finding |
|---|---------|-------|-------------|
| T1 | Market Sizing | `market-sizing.md` | SAM: €340-520M, SOM Year 1: €0.5-2M |
| T2 | KPI Design | `kpi-design.md` | 3 Primary + 6 Driver + 4 Guardrail KPIs |
| T3 | Data Quality | `data-quality-audit.md` | 16 Tables, 3 Critical, 4 High Issues |
| T4 | Metric Diagnostics | `metric-diagnostics.md` | **7/8 Bugs bereits gefixt** |
| T5 | Dashboard | `dashboard.html` | Self-contained HTML Health View |
| T6 | Investor Report | `investor-report.md` | Funder-ready mit €50K Ask |

---

## 3. Bug-Status (aktualisiert)

### Bereits gefixt (7/8)

| Bug | Datei | Fix |
|-----|-------|-----|
| #1 Journey-Parameter | `mobility_provider.dart:294` | Korrekte `from_lat`/`from_lng` Params |
| #2 ISO-Datum | `departure_board.dart:102` | `DateTime.parse()` statt `split(':')` |
| #4 Graue Linien | `dbVendoService.ts:101` | `PRODUCT_COLORS` Mapping |
| #5 Stop-Mapping | `dbVendoService.ts:157` | transitous.org direkt (kein Name-Matching) |
| #6 db-rest Port | `dbVendoService.ts` | Kein db-rest mehr, transitous.org |
| #7 DB_REST_URL | `dbVendoService.ts` | Kein db-rest Dependency |
| #8 Route-Konflikt | `mobility.ts:29` | `/stops/search` VOR `/stops/:id` |

### Offen (1/8)

| Bug | Datei | Status | Nächster Schritt |
|-----|-------|--------|-----------------|
| #3 Kein GPS | `mobility_screen.dart:33` | Default-Startpunkt Berlin | `geolocator` Package + Berechtigung |

---

## 4. Agent-Prompt (aktualisiert)

**Pfad:** `docs/data-analytics/AGENT-PROMPT.md`

Änderungen:
- Bug-Status in Sektion 4 aktualisiert (7/8 gefixt)
- Bug #3 als einziger offener Bug markiert
- Transitous.org als Primary-Data-Source dokumentiert
- db-rest als deprecated markiert

---

## 5. App-Ziele vs. Ist-Zustand

### Aus AGENTS.md

| Ziel | Ist-Zustand | Status |
|------|-------------|--------|
| **Flutter App (map/ÖPNV, Taler, Ärzte)** | Alle 3 Features implementiert | ✅ |
| **Node.js Backend (Port 3000)** | 9/9 Endpoints live | ✅ |
| **Python ML Service (Port 8000)** | Docker-only, implementiert | ✅ |
| **Docker Compose** | Vollständig (5 Services) | ✅ |
| **CI/CD (GitHub Actions)** | 10/10 grün | ✅ |
| **PostgreSQL (16 Tabellen)** | Schema migriert auf Supabase | ✅ |

### Features

| Feature | Status | Datenquelle |
|---------|--------|-------------|
| **Interaktive Karte** | ✅ LIVE | OpenStreetMap + MapLibre |
| **ÖPNV-Haltestellen** | ✅ LIVE | Overpass API |
| **Routing** | ✅ LIVE | OSRM |
| **ÖPNV-Verbindungssuche** | ✅ LIVE | transitous.org |
| **Live-Abfahrten** | ✅ LIVE | transitous.org |
| **GTFS-Import** | ⚠️ LOKAL | Nur via `import-gtfs-local.ts` |
| **Taler-Wallet** | ✅ LIVE | Echt GNU Taler Exchange (exchange.demo.taler.net) |
| **P2P-Zahlungen** | ✅ LIVE | Echt GNU Taler Exchange (exchange.demo.taler.net) |
| **Ärzte-Suche** | ✅ LIVE | Overpass API |
| **Arzt-Registrierung** | ✅ LIVE | PostgreSQL |
| **Terminbuchung** | ✅ LIVE | PostgreSQL |

---

## 6. Nächste Schritte (priorisiert)

### Sofort (heute)

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 1 | GPS-Integration (geolocator) | 2h | Personalisierung |
| 2 | GTFS-Feed lokal importieren | 1h | Echte ÖPNV-Daten |

### Diese Woche

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 3 | CHECK-Constraints hinzufügen | 1h | Datenqualität |
| 4 | ON DELETE Strategien | 2h | Referenzielle Integrität |
| 5 | Updated-At Trigger | 1h | Audit-Trail |

### Nächster Monat

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 6 | Taler VARCHAR → DECIMAL Migration | 2h | Numerische Berechnungen |
| 7 | Beta-Tester rekrutieren | Laufend | Nutzer-Feedback |
| 8 | Prototype Fund Antrag | 4h | €50.000 Fördermittel |

---

## 7. Dateiübersicht

```
docs/data-analytics/
├── AGENT-PROMPT.md          # Reproduzierbarer Agent-Prompt
├── FINAL-STATUS.md          # Diese Datei
├── market-sizing.md         # TAM/SAM/SOM Analyse
├── kpi-design.md            # KPI-Framework
├── data-quality-audit.md    # DB-Schema Audit
├── metric-diagnostics.md    # Bug-Diagnose
├── dashboard.html           # Project Health Dashboard
└── investor-report.md       # Investor/Funder Report

.opencode/skills/
└── heimat-dev/
    └── SKILL.md             # HEIMAT Development Skill
```

---

## 8. Fazit

| Metrik | Wert |
|--------|------|
| **Skills erstellt** | 1 (heimat-dev) |
| **Analysen durchgeführt** | 6/6 |
| **Bugs behoben** | 7/8 (87.5%) |
| **API-Endpoints live** | 9/9 |
| **CI/CD** | 10/10 grün |
| **Nächster Meilenstein** | GPS-Integration + Beta-Release |

Das HEIMAT MVP ist funktional und bereit für den Beta-Test. Die Data-Analytics-Analysen liefern die Grundlage für Fördermittel-Anträge und Community-Wachstum.

---

*Stand: Juli 2026*
