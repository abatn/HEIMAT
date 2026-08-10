# 🏠 HEIMAT 2.0 — Handoff-Prompt für AI-Agenten

> **Version:** v42.0 (2026-08-10) | **Letzte Commits:** `19c7a21` (Adzuna Umlaut + Category Fix)
> **Status:** 10/10 Services im Public-Read-Only-Matrix PASS | audit-no-mocks.sh: 0 Verstöße

---

## Projekt-Kurzsteckbrief

**HEIMAT** ist eine Open-Source "Super App" für Deutschland — Mobilität, Finanzen, Gesundheit, Wetter, Luftqualität, Abfall, E-Laden, Parken, Jobs, Events, Hotels, Bürgeramt, AI-Chat. Privacy-first, nur öffentliche/open Daten. Keine kommerziellen APIs, keine Verträge, keine BaFin-Lizenz.

| Aspekt | Details |
|--------|---------|
| **Frontend** | Flutter 3.24.5 (Web auf GitHub Pages) |
| **Backend** | Node 20 + Express 5 + TypeScript |
| **Datenbank** | PostgreSQL 15 auf Supabase (Supavisor Pooler) |
| **CI/CD** | GitHub Actions (Flutter + Backend + Deploy) |
| **Hosting** | Render (Backend) + GitHub Pages (Flutter Web) |
| **Repo** | https://github.com/abatn/HEIMAT |
| **Live-App** | https://abatn.github.io/HEIMAT/ |
| **Live-Backend** | https://heimat-backend.onrender.com |
| **AI-Backend** | Ollama qwen2.5:3b auf Hetzner VPS (158.180.18.110:11434) |

---

## ⚠️ KRITISCHE REGELN (Nicht verhandelbar)

### 1. Keine Mocks, keine Fakes, keine Simulationen
- `fundLocal` Endpoint gelöscht (HTTP 410 Gone, Commit `2d3ae18`)
- `_computeMockLiveStatus` entfernt (Commit `7718333`)
- **Vor jedem Commit:** `bash scripts/audit-no-mocks.sh` — muss 0 violations sein
- CI-Gate aktiv (Commit `82047ad`)

### 2. Kein `git add -A` / `git add .` vom Repo-Root
- `src/mobile/flutter/` (vendored SDK 3.24.5), `src/mobile/android/`, `src/mobile/ios/`, `.mimocode/`, `.agents/` sind untracked
- **Immer einzelne Files mit `git add <pfad>`**

### 3. Flutter/Dart/Node sind nicht auf PATH
```bash
# Vendored SDK verwenden:
src/mobile/flutter/bin/flutter
src/mobile/flutter/bin/dart
```

### 4. Conventional Commits (lowercase, deutsch)
```
feat(mobilitaet): haltestellen-suche hinzugefuegt
fix(auth): login-routing-bug behoben
docs(knowledge): v42.0 status update
```

### 5. Integration-Test-Regel
- `pumpAndSettle()` ist **VERBOTEN** (infinite Animation Hang)
- Stattdessen: `tester.pump(Duration(milliseconds: 100))` in Intervallen
- `SharedPreferences.setMockInitialValues({})` in jedem `setUp()`
- Stub-Vererbung (`_Stub<X> extends X`) bevorzugt gegenüber Mockito

---

## 🏛️ Projektstruktur (wichtige Dateien)

```
HEIMAT/
├── src/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.ts                 # Express App + Router-Mounts
│   │   │   ├── config/database.ts       # pg Pool → Supavisor
│   │   │   ├── database/schema.sql      # 16+ Tabellen
│   │   │   ├── routes/                  # mobility, finance, health, auth,
│   │   │   │                            # admin, weather, airQuality, waste,
│   │   │   │                            # evCharging, parking, events, hotels,
│   │   │   │                            # buergeramt, jobs, career, ai
│   │   │   ├── services/                # Business-Logik (20+ Services)
│   │   │   ├── middleware/              # auth (JWT), validate (Zod), errorHandler
│   │   │   ├── __tests__/               # 200+ Tests, 10+ Suiten
│   │   │   └── scripts/                 # migrate.ts, migrate-status.ts
│   │   └── package.json
│   ├── mobile/
│   │   ├── lib/
│   │   │   ├── main.dart                # App-Start + Provider + Routing
│   │   │   ├── core/                    # auth/ai/api/config/theme/services/widgets
│   │   │   │   ├── auth/auth_gate.dart  # AuthGate single source of truth
│   │   │   │   └── theme/app_colors.dart
│   │   │   └── features/
│   │   │       ├── home/                # AI-Home Dashboard
│   │   │       ├── mobility/            # ÖPNV
│   │   │       ├── finance/             # Taler Wallet
│   │   │       ├── health/              # Ärztesuche + Health AI Agent
│   │   │       ├── weather/             # Wetter (native Flutter)
│   │   │       ├── air_quality/         # Luftqualität
│   │   │       ├── waste/               # Abfallkalender
│   │   │       ├── ev_charging/         # E-Ladestationen
│   │   │       ├── parking/             # Parken
│   │   │       ├── events/              # Veranstaltungen
│   │   │       ├── hotels/              # Hotels
│   │   │       ├── buergeramt/          # Bürgeramt
│   │   │       ├── jobs/                # Job-Suche + Karriere
│   │   │       └── miniprogram/         # Apps-Tab + ServiceRegistry
│   │   └── test/                        # Flutter Tests (200+)
├── scripts/
│   ├── audit-no-mocks.sh                # CI-Gate
│   └── install-audit-hook.sh            # Pre-Commit-Hook
├── knowledge.md                         # Kurzreferenz (diese Datei)
├── AGENTS.md                            # Agenten-Regeln + Commands
├── heimat-plan.md                       # Langfassung Plan
├── docs/ARCHITEKTUR.md                  # Datenfluss-Diagramm
├── render.yaml                          # Render Blueprint
└── .github/workflows/                   # flutter.yml, backend.yml, deploy-web.yml
```

---

## 🚦 CI/CD Pipeline

| Workflow | Jobs | Reihenfolge |
|----------|------|-------------|
| **flutter.yml** | analyze → test → smoke → build-web + android + ios | Format → Analyze → Test → Build |
| **backend.yml** | lint → test → tsc | Lint → Jest (Postgres!) → Typecheck |
| **deploy-web.yml** | Push src/mobile/ → CI → flutter build web → GitHub Pages | |

### Lokale Validation (vor jedem Commit)

```bash
# 1. Backend
cd src/backend
npm run lint && npx tsc --noEmit && npx jest --forceExit

# 2. Mobile
cd src/mobile
src/mobile/flutter/bin/dart format lib/ test/
src/mobile/flutter/bin/flutter analyze --no-fatal-infos
src/mobile/flutter/bin/flutter test

# 3. Audit
bash scripts/audit-no-mocks.sh             # Muss 0 violations sein
```

---

## ✅ Aktueller Stand (v42.0 — 2026-08-10)

### 🎯 Service-Status (10/10 PASS)

| Kategorie | Services | Status | Nachweis |
|-----------|----------|--------|----------|
| **Mobilität** | ÖPNV, Parken, E-Laden | ✅ 3/3 | HTTP 200 + echte Daten (17 Stationen, 6 Parkhäuser) |
| **Gesundheit** | Ärzte, Lebenszeichen | ✅ 2/2 | **50+ Ärzte pro Stadt** (100% Overpass-Live), Checkin aktiv |
| **Alltag** | Wetter, Luft, Abfall, Bürgeramt, Jobs | ✅ 5/5 | **Waste: 120+ Regionen** (6 Adapter), Jobs: Adzuna API |
| **Kultur & Reise** | Events, Hotels | ✅ 2/2 | 30 Events, 4 Hotels |
| **Finanzen** | Taler-Wallet | ✅ 1/1 | Wallet existiert, Auth funktioniert |
| **AI** | HEIMAT AI | ⚠️ 0/1 | Kein lokaler Ollama auf Render, Fallback-text |

### Was funktioniert (Production-Live)

| Bereich | Status | Details |
|---------|--------|---------|
| **User-Auth** | ✅ Live | JWT + bcryptjs, Register/Login/Logout, Token-Roundtrip |
| **Finance-Roundtrip** | ✅ Live | Bearer-Header in 5 Calls, Wallet-Erstellung |
| **Mobilität** | ✅ Live | Overpass (4 Mirrors optimiert), Nominatim, OSRM, transitous |
| **Ärzte** | ✅ Live | **100% Overpass-Live**, 50+ Berlin, 49+ Stuttgart, 51+ Hamburg |
| **Health AI** | ✅ Live | WHO ICD-API v2 + Triage Rules Engine + Ollama Fallback |
| **Health Agent Phase 1+2** | ✅ 105 Tests | Gedächtnis, Medikamente, Mental Health, Prävention, Nachsorge |
| **Wetter** | ✅ Live | DWD Open-Meteo + Bright Sky Fallback (Mirror-Pattern) |
| **Luftqualität** | ✅ Live | UBA CAMS, 24 Records |
| **Abfallkalender** | ✅ Live | **120+ Regionen**, 6 Adapter (AbfallNavi, AbfallPlus, BSR, AWB Köln, AWM München, Stadtreinigung HH/Leipzig/Stuttgart) |
| **E-Ladestationen** | ✅ Live | 17 echte Records (OSM Overpass) |
| **Parken** | ✅ Live | 6 echte Records (OSM Overpass) |
| **Jobs** | ✅ Live | **Adzuna API** (alle 7 Kategorien) + Arbeitnow Fallback + Skill-Matching + Karriere-Pfad |
| **Events** | ✅ Live | 30 echte Records (Wikidata `wikibase:around`) |
| **Hotels** | ✅ Live | 4 echte Records (OSM/Wikidata) |
| **Bürgeramt** | ✅ Live | 20 echte Records (Overpass `out center`) |
| **AI-Home Dashboard** | ✅ Live | Tageszeit-Greeting + Quick Actions + Stat-Karten |
| **AuthGate** | ✅ Live | Extrahiert + 11 Regression-Tests |
| **Security** | ✅ Live | POST /api/migrate entfernt, audit-no-mocks.sh in CI |
| **GPS-Timeout** | ✅ Behoben | 3s→10s für alle 5 Provider (Browser-Permission-Prompt) |
| **API-Retry** | ✅ Live | 503/502/429 mit exponential backoff |

### ✅ Abgeschlossene Phasen (nicht mehr offen)

| Phase | Status | Details |
|-------|--------|---------|
| **Phase A** | ✅ | Mini-Program-Container (WebView-Framework) |
| **Phase B** | ✅ | Wetter-Mini-Programm (DWD Open-Meteo + Bright Sky) |
| **Phase C** | ✅ | E-Ladestationen + Parken (OSM Overpass) |
| **Phase D** | ✅ | Events, Hotels, Bürgeramt (Wikidata + Overpass) |
| **Phase E** | ✅ | Wetter nativ in Flutter (CurrentWeatherHero + Forecast) |
| **Phase Q** | ✅ | AuthGate-Extraktion + 11 Tests |
| **Health Phase 1** | ✅ | Gedächtnis, Medikamente, Voice, Notfall-Kontext (63 Tests) |
| **Health Phase 2** | ✅ | Mental Health, Prävention, Nachsorge (42+34 Tests) |
| **Waste v32-38** | ✅ | 6 Adapter, 120+ Regionen, 8/12 Großstädte verifiziert |
| **Jobs v39-42** | ✅ | Adzuna API, Umlaut-Fix, Category-Filter, Skill-Matching |

---

## ⚠️ Verbleibende offene Tasks

| # | Task | Status | Priorität |
|---|------|--------|-----------|
| 1 | **Wallet 0.00 KUDOS** | Kein EUR-Exchange live. Manueller Bank-Wire nötig | 🔴 Blockiert (extern) |
| 2 | **Futai Chat Integration** | Mini-Program-Container steht, aber keine Futai-Integration | 🟢 Niedrig |
| 3 | **Health AI Phase 3** | Foto-Analyse, erweiterte Differentialdiagnose | 🟢 Niedrig |
| 4 | **TypeScript 7 Upgrade** | typescript-eslint@8 inkompatibel | 🟡 Mittel |

---

## 🔧 Technische Details

### Backend-Architektur
- **Express 5 + TypeScript**: Routes in `routes/`, Services in `services/`
- **DB**: `config/database.ts` → `pg.Pool` → Supavisor `aws-0-eu-west-1.pooler.supabase.com:5432`
- **Auth**: JWT via `middleware/auth.ts` (`requireAuth` + `requireAdmin`)
- **Schema**: `database/schema.sql` (16+ Tabellen), automatisch via kompilierten Startup-Hook vor `app.listen`
- **Tests**: Jest mit `--forceExit`, benötigt Postgres (CI spinnt `postgres:15-alpine`)

### Flutter-Architektur
- **Provider-Pattern**: ChangeNotifier pro Feature
- **Routing**: Hash-Routing (`/#/login`, `/#/register`)
- **AuthGate**: Single Source of Truth in `lib/core/auth/auth_gate.dart`
- **ServiceRegistry**: `lib/features/miniprogram/domain/service_registry.dart`
- **API-Client**: `lib/core/api/api_client.dart` → `heimat-backend.onrender.com` (mit Retry-Logik)
- **Theme**: `lib/core/theme/app_colors.dart`

### Externe APIs

| API | Endpoint | Service |
|-----|----------|---------|
| Overpass | `overpass.osm.ch` (primär) + 3 Mirrors | mobility, health, parking, evCharging, buergeramt, events, hotels |
| Nominatim | `nominatim.openstreetmap.org/search\|reverse` | mobility, health |
| OSRM | `router.project-osrm.org/route/v1/driving/` | mobility |
| transitous.org | `api.transitous.org/api/v1/...` | ÖPNV |
| Open-Meteo DWD | `api.open-meteo.com/v1/forecast` | weather |
| Bright Sky DWD | `api.brightsky.dev/weather` | weather (Fallback) |
| Open-Meteo CAMS | `air-quality-api.open-meteo.com/v1/air-quality` | airQuality |
| AbfallNavi | `abfallnavi.api.bund.dev` | waste (19 Regionen) |
| AbfallPlus | `app.abfallplus.de` | waste (90+ Städte) |
| BSR | `umnewforms.bsr.de` (ICS) | waste (Berlin) |
| AWB Köln | `awbkoeln.de/api/calendar` | waste (Köln) |
| AWM München | `awm-muenchen.de` | waste (München) |
| Stadtreinigung HH/Leipzig/Stuttgart | Diverse | waste |
| Adzuna | `api.adzuna.com/v1/api/jobs/de/search` | jobs (alle Kategorien) |
| Arbeitnow | `api.arbeitnow.com/api/job-board-api` | jobs (Fallback) |
| Wikidata SPARQL | `query.wikidata.org/sparql` | events, hotels |
| WHO ICD-API v2 | `id.who.int/icd/release/11/...` | health triage |
| Ollama | `158.180.18.110:11434` (qwen2.5:3b) | AI chat |
| Taler Exchange | `exchange.demo.taler.net/keys\|/reserves/<pub>` | finance |

### Overpass-Mirror-Reihenfolge (optimiert)
1. `overpass.osm.ch` — 🥇 Primär (~0.2s, 50km-Test bestanden)
2. `maps.mail.ru` — 🥈 Backup (~7s, zuverlässig)
3. `overpass-api.de` — 🥉 Backup (instabil bei großen Radien)
4. `overpass.kumi.systems` — 4. Nur letzter Ausweg (instabil)

---

## 📋 Prompting für den nächsten Agenten

Übergib diesen Prompt wie folgt an den nächsten AI-Agenten:

> "Analysiere knowledge.md + AGENTS.md und setze die nächste offene Task um.
> **Regeln:** Keine Mocks/Simulationen, kein git add -A, Conventional Commits (lowercase, deutsch).
> **Validation:** dart format → flutter analyze → flutter test → tsc --noEmit → npm run lint → jest --forceExit → audit-no-mocks.sh.
> **Version:** v42.0 — 10/10 Services PASS."

---

## 📊 Wichtige Commits (letzte 2 Wochen)

| Commit | Was | Datum |
|--------|-----|-------|
| `19c7a21` | fix(jobs): Adzuna Umlaut-Bug + Category-Bug gefixt | 2026-08-10 |
| `bdfb25f` | fix(jobs): Umlaut-Normalisierung entfernt — Adzuna akzeptiert UTF-8 | 2026-08-10 |
| `c979984` | fix(jobs): Adzuna category Query-Parameter aktiviert | 2026-08-10 |
| `4beb936` | fix(ollama): Route-Timeout 25s→120s fuer Chat-Endpoint | 2026-08-10 |
| `e2ef8d3` | fix(ollama): Timeout 5s→120s, keep_alive:10, Warmup-Call | 2026-08-10 |
| `abb5053` | fix(waste): AbfallNavi `/haus/` → `/hausnummern/` | 2026-08-09 |
| `0265d40` | fix(waste): Hausnummern separat laden via getHausnummern() | 2026-08-09 |
| `6aa43f1` | fix(waste): Stuttgart Adapter komplett neu (X-Requested-With Header) | 2026-08-09 |
| `fe05ca8` | feat(waste): AbfallPlus Integration (90+ Städte) | 2026-08-09 |
| `9cdb9fb` | fix(waste): abfall.io deprecated (403 Forbidden) | 2026-08-09 |
| `e389c1e` | fix(waste): Karlsruhe deprecated | 2026-08-09 |
| `af03864` | fix(overpass): Mirror-Reihenfolge optimiert (osm.ch primär) | 2026-08-08 |
| `afdec39` | fix(services): Berlin-Hardcoding entfernt (alle 6 Services ortsunabhängig) | 2026-08-04 |
| `25a9170` | fix(gps): Timeout 3s→10s + API-Retry-Logik | 2026-08-08 |
