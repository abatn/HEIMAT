# Project knowledge — HEIMAT 2.0

> Open-source Super App für Deutschland (Mobilität, Finanzen, Gesundheit). AGPL v3.
> Production-first: Supabase + Render sind die einzige Test-/Deploy-Umgebung. Kein Sandbox.

For the long-form agent rules see `.claude/CLAUDE.md` and `AGENTS.md` (the rules in those files ALWAYS trump this summary).

## What this is

A privacy-first "super app" using ONLY public/open data: OpenStreetMap (Overpass, Nominatim, OSRM), db-rest / Vendo API (ÖPNV live data), GNU Taler (P2P payments via `exchange.demo.taler.net`), OSM doctor search. No bank partnerships, no TI-Anbindung, no commercial APIs, no accounts needed for v0.1.

## Quickstart

### Toolchain (NOT on PATH)

- `flutter`, `dart`, `node` are NOT on PATH. Use vendored SDK: `src/mobile/flutter/bin/flutter` and `src/mobile/flutter/bin/dart`.
- Backend needs Node 18+ (CI uses Node 20). Globals via `npx`.

### Setup

```bash
# Backend
cd src/backend && npm install

# Mobile (vendored Flutter SDK)
cd src/mobile && src/mobile/flutter/bin/flutter pub get
```

### Dev

```bash
# Backend (hot reload, port 3000)
cd src/backend && npm run dev

# Mobile (default BACKEND_URL=https://heimat-backend.onrender.com via --dart-define)
cd src/mobile
src/mobile/flutter/bin/flutter run -d chrome --dart-define BACKEND_URL=http://localhost:3000
```

### Test

```bash
# Backend (needs Postgres; CI spins up postgres:15-alpine, DB=heimat_test)
cd src/backend
npm test                                    # all suites + coverage
npx jest src/__tests__/mobility.test.ts      # single suite
npx tsc --noEmit                            # typecheck
npm run lint                                # eslint

# Mobile (MUST dart-format before commit — CI gate)
cd src/mobile
src/mobile/flutter/bin/dart format lib/ test/
src/mobile/flutter/bin/flutter analyze --no-fatal-infos
src/mobile/flutter/bin/flutter test
src/mobile/flutter/bin/flutter test test/widget_test.dart   # single
```

### Build / Deploy

```bash
# CI-driven (GitHub Actions). Local:
cd src/mobile && src/mobile/flutter/bin/flutter build web --release --base-href "/HEIMAT/"
# Backend: rendered by Render.com from `fly.toml`/`render.yaml`.
```

## Architecture

Three services under `src/`:

```
src/mobile/                      Flutter app (Provider pattern, MapLibre/futter_map)
  lib/
    core/{config,theme,widgets,api,ai,services}    cross-cutting
    features/{mobility,finance,health}/{presentation/}
  test/                          widget + provider tests (no integration tests)
  flutter/bin/                   VENDORED SDK 3.24.5 — DO NOT EDIT, DO NOT git add

src/backend/                     Node 20 + Express 5 + TypeScript
  src/
    routes/                      mobility, finance, health, admin, auth
    services/                    business logic + Taler client + RAPTOR + db-rest
    database/schema.sql          16 tables, 24 indexes — CI loads via psql
    config/database.ts           pg Pool
    middleware/                  errorHandler, notFoundHandler, validate (Zod), auth (JWT)
    __tests__/                   113 tests across 7 suites
  scripts/                       GTFS import (local only — Render free-tier kills it)
  jest.config.js                 forceExit: true

ml-service/                      Python FastAPI (Docker only)  [Note: checkout tree claims this dir but it is missing on disk]
  api/ml_service.py              /predict/delay (LightGBM), /predict/budget-category (NB)
```

### Data flow

```
Flutter Web (GitHub Pages: abatn.github.io/HEIMAT/)
  → https://heimat-backend.onrender.com  (Express)
      → /api/mobility/*  → Overpass, Nominatim, OSRM, transitous.org, db-rest/Vendo
      → /api/health/*    → Overpass doctors, OSM-based
      → /api/finance/*   → GNU Taler exchange client (Ed25519, KUDOS)
      → /api/admin/*     → ADMIN_KEY header required (no static fallback)
      → /health/*        → DB/Redis ping
      → /docs, /docs.json → Swagger UI
  → ML (optional): /predict/* via AiService in mobile
```

## Conventions

- **Conventional Commits, lowercase, German descriptions.** Example: `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`.
- **Branch prefixes:** `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- **Service URLs via `--dart-define BACKEND_URL=...`** (default `https://heimat-backend.onrender.com`). See `src/mobile/lib/core/config/app_config.dart`.
- **No `analysis_options.yaml`** in mobile — analyzer uses defaults. `flutter_lints` is wired into deps but unused.
- **No `npm run migrate` / `npm run seed`** — those don't exist. Schema is loaded via `POST /api/migrate` (admin-only) or CI `psql -f`.
- **Root `*.md` files (`AI-*.md`, `heimat-plan.md`, `blog/`, `funding/`, `marketing/`)** are planning/marketing docs, NOT code documentation. Don't read them for code context.

## Phase 3-Tab-Rebuild — Status (2026-08-04)
- ✅ **3-Tab-Struktur (WeChat-Muster)** implementiert und live.
- 5 Tabs → 3 Tabs: Startseite, Dienste, Profil.
- ServiceRegistry: 14 Services in 6 Kategorien (Mobilität, Gesundheit, Alltag, Kultur, Finanzen, AI).
- `displayOrder` + `isFrequentlyUsed` Felder für UI-Sortierung.
- HomeScreen: "Neue Features" entfernt, "Zuletzt benutzt" + AI-Chat FAB hinzugefügt.
- Tests: 31/31 grün (app_smoke_test + service_registry_test).
- CI: Flutter CI + Deploy Web grün für alle 4 Commits.
- **Commits:** f3eb6f2 (Nav), 11f46d4 (Home), b3c6ee2 (Registry), a4f3650 (Tests).
- **Dokumentation:** `docs/3-tab-rebuild-plan.md` (519 Zeilen).

## Phase E — Status (2026-07-27)
- ✅ Wetter-Pilot als nativer Flutter-Service implementiert (CurrentWeatherHero + HourlyForecastStrip + WeeklyOutlookGrid). CI grün (`dart analyze` 0, `dart format` OK).
- ServiceRegistry-Pattern: pro Service `useNative: true` in `MiniProgram` → nativ, sonst IFrame-Fallback. Migration inkrementell pro Service.
- Dokumentiert: `heimat-plan.md` (Phase E), `AGENTS.md` (Phase E Block). Folgemitziehen: README.md, HANDOFF.md, bauplan.md, AI-*.md, CONTRIBUTING.md (separater Doku-Sweep).

---

## Critical gotchas (READ before touching files)

1. **Never `git add -A` / `git add .` from repo root.**
   Untracked junk that should NEVER be staged: `src/mobile/flutter/` (full SDK), `src/mobile/android/`, `src/mobile/ios/`, `src/mobile/mobile.iml`, `.mimocode/`, `.agents/`, `knowledge.md`. Stage files explicitly.

2. **Flutter SDK is vendored at `src/mobile/flutter/`.** Never edit, search, or stage anything under it.

3. **`flutter`/`dart`/`node` are NOT on PATH.** Always use the absolute paths above.

4. **CI gates MUST pass:**
   - Flutter: `dart format` → `analyze` → `test` (+ `app_smoke_test.dart`) → `build-web` + `build-android`.
   - Backend: `lint` → `jest` (needs Postgres) → `tsc --noEmit`.

5. **Postgres DECIMAL → Flutter:** `pg` returns DECIMAL as strings. Use `double.parse(json['lat'].toString())` in providers — calling `.toDouble()` on the string throws `Dynamic call of null` (known crash).

5b. **Postgres DECIMAL/COUNT → Backend:** `pg` returns DECIMAL and COUNT(*) as strings (e.g. `"7"` not `7`). Jest matchers like `toBeGreaterThanOrEqual()` fail with `"received value must be a number or bigint"`. Fix: cast with `Number(value)` in the service layer, or `parseFloat()` in tests. Applies to: COUNT(*), DECIMAL, NUMERIC columns. Example: `total_entries: Number(total?.count ?? 0)`.

6. **Route order in Express:** Define `/stops/search` BEFORE `/stops/:id` or Express captures `id="search"` and the search route 500s.

7. **Journey query params:** Backend expects `?from_lat=&from_lng=&to_lat=&to_lng=`. Flutter was sending `?from=lat,lng` — fixed in `mobility_provider.dart`, regression-prone.

8. **Render PORT:** Render routes to whatever port the process binds, but Dockerfile defaults to `ENV PORT=3000` — keep that contract.

9. **CORS/helmet:** Mobile must be able to load API responses. Required helmet config lives in `src/backend/src/index.ts`: `crossOriginResourcePolicy: 'cross-origin'` etc.

10. **GTFS zip import is allowed** (`gtfs.de/nv_free`), CC-BY. NOT a rule violation.

11. **Doctors: 100%% Overpass-Live, keine Seed-Daten (Commit 760d88f).** Berlin-Seed (25 Ärzte) entfernt — war Designfehler (95% Deutschlands bekam leere DB). Jetzt: alle Ärzte live von Overpass (OSM) — weltweit, standortunabhängig. Wenn User auf OSM-Arzt tippt → `ensureDoctorInDb()` speichert ihn dynamisch in DB mit Default-Slots (Mo-Fr 8-17). Terminbuchung funktioniert danach für JEDE Stadt. classifySpecialty(): 16→25 Rules, 52 Unit-Tests.

12. **Finance `user-demo-001` is still hardcoded** in `finance_provider.dart:45`. Backend JWT-Auth is live on Production since 2026-07-25 (`/api/auth/{register,login,me}` end-to-end against `heimat-backend.onrender.com`); Mobile-Finance still needs to be wired against the real token instead of the demo user.

   **Update 2026-07-25 (Commits cfb0561 + e00105d):** WIRING DONE. `_authService.authHeaders` schickt jetzt Bearer-Token in allen 5 Finance-HTTP-Calls (initWallet, loadWallet 2x, loadTransactions, sendMoney). Die `/$userId`-URL-Suffixe wurden entfernt (Backend identifiziert User aus Bearer-Token via `requireAuth`). Backend hat zusätzlich eine `GET /api/finance/wallet`-Route bekommen (Commit e00105d). Schema hat eine alte `wallet_priv` Legacy-Spalte per `ALTER TABLE … DROP COLUMN IF EXISTS` verloren. End-to-End Finance-Roundtrip sollte jetzt mit Token-Auth gegen Render produktiv sein.

13. **Phase 23 Roundtrip ✅ Live (2026-07-25):** Finance-JWT-Integration abgeschlossen. ADMIN_KEY auf Render gesetzt. preDeployCommand (auto) + `/api/admin/migrate` (manual) beide grün am 2026-07-25. security.test.ts Regression-Lock aktiv (Commit 3414aea). Konkret: (a) Mobile `finance_provider.dart` schickt Bearer-Token via `_authService.authHeaders` in allen 5 HTTP-Calls. (b) Backend `GET /api/finance/wallet` Route neu (Commit e00105d). (c) Schema `wallet_priv` Legacy-Spalte per `ALTER TABLE DROP COLUMN IF EXISTS` verloren. (d) Ungeschützter `POST /api/migrate` entfernt (Commit 25ac7ab); nur `/api/admin/migrate` mit `X-Admin-Key` Header bleibt. (e) `src/backend/src/scripts/migrate.ts` (Node.js) läuft im `preDeployCommand` nach `buildCommand` (Commit e7fcd85) — wendet `dist/database/schema.sql` automatisch auf Production-DB an. (f) `src/backend/src/__tests__/security.test.ts` (Commit 3414aea) regresssion-locked dass POST /api/migrate 404 retourniert (sonst 200 mit Schema-loaded-Body). (g) Backend-CI Run #30173698956 für e7fcd85 grün (Lint/Test/Build).

### ✅ Phase Q: Quality-Pass — AuthGate-Extraktion (2026-07-27)

**Commits:** `78a371d` (Refactor + 11 AuthLock-Tests) + `ea29e63` (CI-Format-Fix). Architektur-Drift zwischen Production und Test aufgelöst.

**4 Dateien, 11 neue Tests, ~470 Lines:**

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `lib/core/auth/auth_gate.dart` (NEU) | Pure Routing-Widget, `authenticated` Parameter required → kein silent-default-widget |
| 2 | `lib/main.dart` (EDIT) | Inline `class AuthGate` (11 Zeilen) entfernt; Route: `AuthGate(authenticated: const MainScreen())` |
| 3 | `test/auth_gate_test.dart` (REWRITE) | Importiert echtes AuthGate via package; 2→5 Tests (unauth/auth/transition/loading/partial-auth) |
| 4 | `test/auth_integration_test.dart` (NEU) | `_FakeAuthProvider` + `_MockMainWithLogout` Stub; 6 Tests (Cold-Start/Login/Popup-Logout/Cycle/AUTH-LOCK/RegisterScreen) |

**Lessons-Learned:**
- `pumpAndSettle()` **VERBOTEN** — infinite-Animation-Hang. Stattdessen `tester.pump(100ms)` Intervalle.
- `SharedPreferences.setMockInitialValues({})` in JEDEM setUp() für Test-Isolation.
- Stub-Vererbung > Mockito-build_runner — kein Generator-Overhead.
- AuthGate-Required-Parameter-Pattern: explicit `authenticated:` injection verhindert silent-default-widget-bugs.

**Validation:** Code-Reviewer 9/9 PASS, Static drift-check (1 AuthGate-Declaration), Unused-Imports Audit (22/22). CI grün (`78a371d`).

## HEIMAT Expansion Plan (Phase 25-26) — Juli 2026

### Vision: HEIMAT als WeChat/Grab-Alternative mit deutscher Open-Source-DNA

Basierend auf WeChat (China) und Grab (Singapur) wird HEIMAT von 3 auf **10+ Services** expandiert — alles mit offenen Daten, staatlichen Quellen und AI-Unterstützung.

### Neue Services

| # | Service | Datenquelle | Typ | Echtzeit | AI-Feature |
|---|---------|------------|-----|----------|------------|
| 4 | 💬 **Chat/Social (Futai)** | Futai (github.com/abatn/futai) | Open Source | ✅ | Ollama-KI-Twin + Gedächtnis |
| 5 | 🌤️ **Wetter** | DWD (Deutscher Wetterdienst) | 🏛️ Staatlich CC-BY | ✅ | Unwetter-Früherkennung |
| 6 | 🌬️ **Luftqualität** | Umweltbundesamt (UBA) | 🏛️ Staatlich Open Data | ✅ | Gesundheitsempfehlung |
| 7 | 🗑️ **Abfallkalender** | Kommunale Open-Data-Portale | 🏛️ Staatlich | ⚠️ | Braucht lat/lng (GPS) |
| 8 | 🔌 **E-Ladestationen** | OpenStreetMap + GoingElectric | 🌍 Open Source | ⚠️ | Overpass-Rate-Limit |
| 9 | 💼 **Job-Suche** | BA (inoffizielle/Community-API) + Adzuna | 🏛️ Staatlich / Kommerziell | ✅ | Job-Matching + Skill-Gap |
| 10 | 📰 **Veranstaltungen** | Wikidata + OSM + Stadtportale | 🌍 Open Source | ⚠️ | Nicht getestet |
| 11 | 🏨 **Hotels & Unterkünfte** | OSM + Wikidata (nur Standort-Daten, keine Buchung) | 🌍 Open Source | ❌ | Nicht verfügbar |
| 12 | 🅿️ **Parken** | OpenStreetMap (OSM) | 🌍 Open Source | ⚠️ | Wenige Ergebnisse |
| 13 | 🏛️ **Bürgeramt-Services** | Kommunale APIs | 🏛️ Staatlich | ❌ | Endpoint fehlt |

### Integrations-Strategie für Futai (React Native)

Futai ist eine React Native (Expo) Social-Media-App mit KI-Chat (Ollama), 12 Emotionen, Gedächtnis und Feed — 353 Tests, TypeScript strict. Da HEIMAT Flutter ist:

| Option | Beschreibung | Aufwand |
|--------|-------------|--------|
| **A) Mini-Program (WebView)** ⭐ | Futai's Web-Build läuft als Mini-Program-Tab in HEIMAT via WebView | 2-3 Tage |
| **B) Backend-Sharing** | Futai + HEIMAT teilen Supabase-Backend (Multi-User) | 3-5 Tage |
| **C) Rewrite in Flutter** | Futai-Komponenten in Flutter neu geschrieben | 2-3 Wochen |

**Empfehlung: Mini-Program-Container zuerst bauen (Option A), dann Futai integrieren.**

### Umsetzungs-Phasen

| Phase | Services | Tage |
|-------|----------|------|
| **A** | Mini-Program-Container (Fundament) | ✅ Abgeschlossen |
| **B** | Wetter (DWD) + Luftqualität (UBA) + Abfallkalender | 3-5 |
| **C** | E-Ladestationen (OSM) + Parken (OSM) | 2-3 | ✅ Abgeschlossen |
| **D** | Futai-Chat (Mini-Program) + Job-Suche (BA) + Veranstaltungen | 3-5 |
| **E** | Hotels (OSM/Wikidata) + Bürgeramt | 5-7 |
| **🎯 Gesamt** | **10 neue Services** | **~15-20 Tage** |

### AI-Strategie (Phase 25-26)

**Vision:** AI als intelligente, zentrale Schicht über ALLEN Services — kein fragmentiertes AI mehr.

#### Stufe 1: AI-Home Dashboard (2-3 Tage)
Ein personalisiertes Dashboard, das AI-gesteuert die relevantesten Informationen pro Tageszeit/Location anzeigt:
- 🌅 Morgens: Wetter + ÖPNV-Verspätungen + Abfallkalender
- 🏢 Tagsüber: Nächste Termine + Routenvorschläge
- 🎪 Wochenende: Veranstaltungen + Wetter + Ausflugsziele
- 💼 Beruf: Job-Empfehlungen + Skill-Gap

#### Stufe 2: Universal AI Assistant (5-7 Tage)
Ein AI-Chat (basiert auf Futai's Ollama-Twin), der ALLE Services versteht und quervernetzt:
- „Morgen 10 Uhr Arzt in Berlin" → Route + Wetter + Parken vorschlagen
- „Wochenend-Trip nach Hamburg" → Hotels + Route + Events + Wetter kombinieren
- Futai's Gedächtnis + Emotionen + HEIMATs BayesClassifier fusionieren

#### AI pro Service (erweitert)

| Service | AI-Feature | Technologie |
|---------|-----------|-------------|
| 🌤️ Wetter | Unwetter-Früherkennung + Natürliche Wetter-Ansage | ML Service + R + Ollama |
| 🌬️ Luft | Gesundheitsempfehlung + Asthma-Risiko | LightGBM Classifier |
| 🗑️ Abfall | Proaktive Erinnerung + Sortier-Tipps | Natural BayesClassifier |
| 🔌 Ladestation | Predictive Route + Ladestopp-Optimierung | RAPTOR-artig + ML |
| 💼 Jobs | Job-Matching + Skill-Gap + Profil-Learning | Keyword + Embeddings |
| 📰 Events | Personalisierte Empfehlung + Wetter-Kopplung | Collaborative Filtering |
| 🏨 Hotels | Budget-Reiseplanung + Routenoptimierung | ML Budget Classifier |
| 💬 Futai | ZENTRALE AI — Ollama-Twin für ALLE Services | Ollama 7B lokal |

#### AI-Architektur
```
Futai Ollama (lokal) ←→ HEIMAT AI Layer
     │                        │
     ├── Chat/Twin            ├── BayesClassifier (Intent)
     ├── Emotion Memory       ├── LightGBM (Predictions)
     ├── Feed Curation        └── ML Service (Budget/Delay)
     └── Suggestion Engine
               │
      Cross-Service Intelligence
      ├── Weather → Route → Event
      ├── Job → Location → Commute
      └── Health → Weather → Transport
```

**Prinzip:** Keine Cloud-AI, keine API-Kosten. Alles lokal via Ollama + Open-Source-Modelle. Privacy-by-Design.

## Phase 23 Recap — Stand Juli 2026

Auf einen Blick: Produktion läuft, Finance-Roundtrip ist end-to-end live, Auto-Migration ist abgesichert; kleinere offene Tasks in klarer Reihenfolge.

### ✅ Was funktioniert
- User-Auth (JWT + bcryptjs): Register/Login/Logout end-to-end live auf `heimat-backend.onrender.com` (Commit 9c8deb7 + 1090203 + Phase 18-Backend)
- Finance-JWT-Roundtrip: Mobile Bearer-Header in allen 5 Finance-Calls (cfb0561), URL-Pfade ohne `/$userId` Suffix (e00105d), Schema-DROP `wallet_priv` durchgelaufen
- Security-Härtung: ungeschützter `POST /api/migrate` entfernt (25ac7ab); `security.test.ts` Regression-Lock aktiv (3414aea)
- Auto-Migration: `AUTO_MIGRATE=true` startup-hook (Commit 7e5f063) — ✅ Live bestätigt am 2026-07-25 (Build-Log + funktionaler Beweis via wallet-Endpoint)
- Admin-Pfad: `ADMIN_KEY` auf Render gesetzt; `POST /api/admin/migrate` mit `X-Admin-Key` positive-control HTTP 200 in ~213ms
- DB-Connection: Supavisor-Pooler `aws-0-eu-west-1.pooler.supabase.com:5432` mit `DB_SSL=true`, IPv4-Force (`family:4`), Node 20, devDeps-Prune
- Taler Wallet-Client: GET /keys + GET /reserves/<pub> erreicht `exchange.demo.taler.net` (Ed25519). **Currency dynamisch aus /keys (Commit d91fc76)** — EUR-ready via `TALER_EXCHANGE_URL` env var.
- **Funded-Wallet-Pfad (Phase R, 2026-07-27)**: Wallet-Balance bleibt 0.00 KUDOS bis ein EUR-Production-Exchange (oder bank.demo.taler.net) Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. fundLocal Mock-Endpoint liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" + `_computeMockLiveStatus` entfernt (Commit 7718333). User-Regel (AGENTS.md:283): "mock, simulation, fake sind verboten" — enforced via audit-no-mocks.sh in CI (Commit 82047ad).
- UX-Modernisierung (Commit 5ad8068, 661afb28, f389001): FinanceScreen (animierte Balance-Card, Quick Actions, Timeline), HealthScreen (Shimmer, DoctorCards mit Presseffekt, Gradienten), MobilityScreen (GPS/Route/Marker Widgets, Gradienten) — alle drei Screens modernes Design
- **Dashboard-Navigation (Commits bd04e2b + 4fcb0ac)**: Quick Actions, Stat-Karten und AI-Vorschläge navigieren jetzt per `onNavigateTab`-Callback zum richtigen Tab. CI grün, deployed ✅
- **Phase B: Wetter-Mini-Programm (Commit 9e42a30)**: Backend (weatherService.ts + weather.ts) + Mini-Program HTML (weather.html) deployed. DWD Open-Meteo mit 429-Retry (0d75f1f) ✅
- **Quick-Actions-Flicker-Fix (Commit 8aad85f)**: getPersonalizedContext() überschrieb Quick Actions mit intent-spezifischen 2-Button-Sets. Fix: Nur Suggestions werden personalisiert. ✅
- CI-Fix: `unnecessary_null_comparison` lint durch `// ignore:` gelöst, `dart format` auf beide Screens angewandt — Flutter CI stabil grün
- Backend CI: Lint + Jest (113+ Tests) + tsc --noEmit — alle grün auf `main`
- Mobile CI: dart format + flutter analyze + flutter test — alle grün
- Swagger/OpenAPI: /docs + /docs.json live
- Mobilität (Überpass/Nominatim/OSRM/transitous) und Gesundheit (Ärzte+Termine) seit MVP grün

- **Phase E Wetter Real-Fix ✅ (2026-07-27, Commit 99daa9c)**: Wetter-Tab `Exception: Wettervorhersage konnte nicht abgerufen werden` behoben via Mirror-Fallback-Pattern. Open-Meteo primary + Bright Sky DWD-Proxy (`api.brightsky.dev`) als 2. öffentlicher Anbieter. Architektur-Spiegel von `mobilityService.ts` Overpass-Mirror-List. Trigger HTTP 429/5xx/ECONNABORTED. BrightSky Condition→WMO Map (8 Buckets), Gust-Speed priority für STURM-Accuracy. **Real-Data-Only** (keine Mocks, keine Simulation per User-Regel "mock, simulation, fake sind verboten"). 10 Regression-Tests grün. Live-Verifikation: `heimat-backend.onrender.com/api/weather/forecast` → 200 OK mit echten Berlin-Daten (21.1°C, Klarer Himmel, 28.1 km/h Wind). Public-API `getWeather()` unverändert, Mobile DTO-Kontrakt stabil → kein Flutter-Rebuild nötig.
- **Ollama Auto-Detect ✅ (2026-07-31, Commits 2c6e09e + 03ef14d + f58ac7b + b586df3)**: `detectAvailableModel()` via `GET /api/tags` wählt automatisch das kleinste/schnellste Modell aus `MODEL_PREFERENCES` (qwen2.5:3b > phi3 > llama3.1:8b). Keine `OLLAMA_MODEL` Env-Var nötig. Cold-start Fix: `getActiveModelAsync()` wartet max 5s. Response zeigt `qwen2.5:3b` statt hardcoded `llama3.1:8b`. Timeout 60s. Prompt-Size Guard bei 6000 chars. Health Triage optimiert: Bei `symptom` nur Health-Kontext fetchen (weather/air/waste skippen).
- **E2E Retry Fix ✅ (2026-07-31, Commit fa27589)**: `withRetry()` Helper (2 Retries, 30s Timeout, 2s Delay) für flaky Overpass API Tests. 429 zu accepted Status Codes hinzugefügt. Outer Timeouts 90s. Backend CI grün.

### ⚠️ Was ist offen
- **Wallet-Balance bleibt 0.00 KUDOS bis EUR-Exchange-Live (Phase R geschlossen, 2026-07-27)**: Demo-Mock-Bypass fundLocal entfernt (per User-Regel "mock, simulation, fake sind verboten"). Wallet wird via echten Reserve-Adresse-Bank-Wire gefuellt (bank.demo.taler.net heute, EUR-Production-Exchange wartet auf oeffentliche Integration). Demo-Option (a) im Finanzen-Tab-Bottom-Sheet entfernt (Commit 7718333). audit-no-mocks.sh enforced in CI (Commit 82047ad).
- **migrate.ts Unit-Test ✅ (Commit 06dc2e3)** — 18 Tests, alle gruen (success path, pool throws, redactConnectionSecrets edge cases, schema fehlt, lesefehler, exception-safety)
- `scripts/stale-doc-prescan.sh` ist seit Phase 23-Fix nicht mehr im preDeploy-Workflow eingebunden (war Nice-to-have, jetzt deaktiviert)

**📱 Taler aus der App — User-Guide (Phase R, 2026-07-27):**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> nur echter Reserve-Adresse-Weg: Bank-Wire von bank.demo.taler.net (oder EUR-Production-Exchange) auf Reserve-Adresse bucht echtes Taler-Guthaben -> [Aktualisieren] -> Balance zeigt Live-Wert. Demo-KUDOS-Option "25 Demo-KUDOS erhalten" wurde komplett entfernt (kein Mock-Bypass, kein "Schneller 25 KUDOS"-Button mehr). P2P-Send an registrierte HEIMAT-User funktioniert nach erfolgreichem Bank-Wire.

**⚠️ Option B (Bank-API automatisieren) bleibt Dead End (2026-07-27):** Die Taler-Demo-Bank (`bank.demo.taler.net`) hat nur Lese-API-Endpoints (`GET /accounts/{username}`, `GET /accounts/{username}/transactions`, `POST /accounts/{username}/token`). `POST /admin/add-incoming` erfordert Admin-Login. KEIN user-autorisierter REST-Endpoint fuer Wire-Transfer. Phase-R-Entscheidung: Mock-Bypass fundLocal wurde KOMPLETT entfernt (kein "praktikabler Demo-Weg" mehr). User fuehrt Bank-Wire manuell aus (Reserve-Adresse -> Button "Aktualisieren").

### ✅ Phase A: Mini-Program-Container (2026-07-27)
**Status: 🎉 Live!** Mini-Program-Container (WebView-Framework) ist das Fundament für die HEIMAT-Expansion auf 10+ Services.

**Commit 92ec307** — 7 Dateien, 913 Zeilen neuer Code:
- `miniprogram_model.dart` — Datenmodell für Mini-Programme (Name, Icon, Kategorie, URL, Farbe)
- `miniprogram_provider.dart` — Registry mit 10 Standard-Mini-Programmen (Futai, Wetter, Luft, Events, Jobs, E-Ladestationen, Abfall, Hotels, Parken, Bürgeramt) + Kategorie-Filter
- `miniprogram_container.dart` — Cross-Plattform Container mit Conditional Imports (dart:html für Web, Stub für Mobile)
- `miniprogram_container_web.dart` — IFrameElement via HtmlElementView
- `miniprogram_container_stub.dart` — Leerer Stub für mobile Kompilation
- `miniprogram_launcher_screen.dart` — Launcher mit Suche, Kategorie-Pillen, 2-Spalten-Grid, Viewer mit URL-Leiste, Bottom Sheet
- `main.dart` — MiniProgramProvider + 5th Tab "Apps"

**CI-Kompatibilität:** `withOpacity` statt `withValues` (Flutter 3.24.5), Conditional Imports ohne `else`-Klausel, kein `dart:io`/`dart:html` auf Mobile

### ✅ Phase B: Wetter-Mini-Programm (2026-07-27)
**Status: 🎉 Live auf main!** Erster Service auf dem Mini-Program-Fundament.

**Commit 9e42a30** — 5 Dateien, 859 Zeilen neuer Code:
- `weatherService.ts` — Open-Meteo DWD-Client mit 5-Min-Cache + 429 Retry (3 Versuche, exponentieller Backoff)
- `weather.ts` — 3 Endpoints: GET /api/weather/{current, forecast, status}
- `weather.html` — Standalone HTML-Seite: Geolocation, 24h-Scroll, 7-Tage-Vorhersage, Glas-Design
- `index.ts` — Weather-Route gemounted, Static-Files-Serving für Mini-Programme unter /mini
- `miniprogram_provider.dart` — Wetter-URL auf Backend-Programm umgestellt

**Pipeline:** Mini-Program (IFrame) → Render /mini/weather.html → JS Geolocation → Backend /api/weather/forecast → Open-Meteo (DWD ICON)

### ✅ Health-Screen Overhaul (Phase 1: 2026-07-30 + Phase 2: 2026-07-30 + Phase 3: 2026-07-30)
- **classifySpecialty()** 16→25 Rules (Commits 7daca23 + f6c05c9): Orthopäde (von Chirurg getrennt), Urologe, Chirurg, Physiotherapie, Radiologie, Naturheilkunde, Pneumologie, Allergologie + Sub-Spezialitäten (endocrinology/gastroenterology/oncology → Innere Medizin). Keyword-Bug `uro`→`naturopath` behoben.
- **21 Specialty-Chips** aligned mit Backend-Fachrichtungen (inkl. Allergologie nach Code-Reviewer-Fix)
- **52 Unit-Tests** für classifySpecialty (classifySpecialty.test.ts) — alle grün
- **25 Berliner Arztpraxen seed** (Commit 445cd9e + d2dd4b2): alle 20 Specialty-Kategorien, idempotent via DO block + WHERE NOT EXISTS. Alte Test-Ärzte (Dr. Full, Dr. Test) via DELETE bereinigt (Commit eaff883)
- **distanceKm** Feld + `haversineKm()` Methode — Entfernungsberechnung für alle Ärzte, sortiert nach Distanz
- **Distance-Badge** auf jeder Arzt-Karte + **Anruf-Button** (SnackBar)
- **CI-Fixes** (Phase 1): classifySpecialty Return-Wert (494e7d6), url_launcher entfernt (dd0f9ed)
- **Live-Verifikation Phase 1+2**: 25 DB + OSM-Live merged, 20 Specialty-Kategorien
- **Phase 3 (Commit 760d88f): Ortsunabhängigkeit** — Berlin-Seed entfernt, 100% Overpass-Live. `ensureDoctorInDb()` auto-saved bei Terminbuchung. GPS-Fallback zeigt klare Fehlermeldung. `requireAuth` auf `/doctors/ensure`.

### FHIR/SMART-Scheduling — Decision: NOT NOW (2026-07-31)
- **Evaluierung abgeschlossen**: HAPI FHIR (~500MB RAM), Medplum (~200MB + eigene DB/Auth), Firely Server (.NET) — alle zu schwer für Render Free-Tier (512MB) und zu große Migration für den Nutzen.
- **HEIMAT-Äquivalent existiert bereits**: `doctor_slots` (≈ FHIR Schedule), `getAvailableSlots()` (≈ FHIR Slot), `appointments` (≈ FHIR Appointment). 1:1 funktional.
- **Kein Interop-Benefit heute**: OSM/Overpass-Ärzte haben keine FHIR-Endpunkte. FHIR-Interop bringt erst Wert, wenn echte Praxis-Software (CompuGroup, SAP) angebunden wird → Phase 3+.
- **Stattdessen: Bestehendes System FHIR-ähnlich erweitert** ✅ **Implementiert (Commit 01f91a4, 2026-07-31)**:
  1. **Status-Pipeline** ✅ — `completeAppointment()` + `markNoShow()` → Status `completed`/`no-show`. Routen: `PUT /api/health/appointments/:id/complete` + `/no-show`
  2. **Recurring Slots** ✅ — `bookRecurringAppointments()` (Serien-Termine 1-12 Wochen, gemeinsame `recurrence_id`). Route: `POST /api/health/appointments/recurring`
  3. **Warteliste** ✅ — Tabelle `appointment_waitlist` + `joinWaitlist()`. Auto-Promotion: `cancelAppointment` → `promoteFromWaitlist` rückt ersten Wartenden nach. Route: `POST /api/health/appointments/waitlist`
  4. **Notiz-Feld** ✅ — `notes` in Buchung + Zod-Schema + Tests
  5. **Termin-Erinnerung** ✅ — `getUpcomingAppointments()` → `GET /api/health/appointments/reminders?patientEmail=&withinHours=` (Backend **+ Flutter-UI: Reminder-Banner + Warteliste-Aktion, Commit d1d0a58**)
- **Tests**: 23/23 grün (health.test.ts, inkl. Waitlist-Promotion + Status-Pipeline + Recurring)
- **Flutter-UI-Status (2026-07-31)**: Reminder-Banner („Termin in X") + Warteliste-Aktion in HealthScreen implementiert (Commit d1d0a58). CI-Fix f00c9cc: `_StubHealth` Constructor-Arg in `app_smoke_test.dart` (HealthProvider-AuthService-Change) — **Flutter CI + Deploy Web wieder grün** (2026-07-31).
- **Future**: FHIR-Adapter-Endpoint erst wenn echte Praxis-Anbindung relevant wird.

### ✅ Health Triage Integration (2026-08-01)

**Architektur:** WHO ICD-API v2 (OAuth2) → Deterministische Rules-Engine (ICD-11 + Keywords) → Ollama Fallback.

```
User: "Ich habe Kopfschmerzen"
  ↓
routes/ai.ts → detectHealthSymptom() (Word-Boundary Regex)
  ↓ Symptom erkannt
ollamaService.chatWithContext({ health: { symptom } })
  ↓
[1] whoIcdService.searchBySymptom() → ICD-11 Codes (z.B. R51)
  ↓
[2] triageRulesService.evaluateTriage() → NOTFALL/BEREITSCHAFT/ROUTINE
  ↓ Confidence ≥ 0.7
[3] buildTriageResponse() → Formatierte Antwort mit Emoji + Telefonnummer
```

#### Komponente 1: WHO ICD-API v2 (`whoIcdService.ts`)
- **Auth:** OAuth2 Client Credentials Flow (`client_id` + `client_secret` → Bearer Token)
- **Endpoint:** `https://id.who.int/icd/release/11/2026-01/mms/search?q=symptom`
- **Token-Caching:** Token läuft ~1 Stunde, wird 5 Minuten vor Ablauf erneuert
- **Privacy:** Nur Symptom-Keywords an WHO gesendet (keine PII)
- **Env-Vars:** `WHO_ICD_CLIENT_ID` + `WHO_ICD_CLIENT_SECRET` (auf Render gesetzt)
- **Fallback:** Bei fehlenden Credentials oder Fehler → leerer ICD-Result (Keywords reichen)

#### Komponente 2: Deterministische Rules-Engine (`triageRulesService.ts`)
- **Kein LLM, keine Halluzinationen** — reine Keyword-basierte + ICD-11 Logik
- **NOTFALL (112):** Brustschmerz, Atemnot, Bewusstlosigkeit, Schlaganfall, Blutung, Krampfanfall, Anaphylaxie, Vergiftung, schwerer Unfall
- **BEREITSCHAFT (116117):** Fieber >39°, starke Schmerzen (7+), blutiger Durchfall, Infektion, starke Kopfschmerzen/Migräne, starker Rückenschmerz
- **ROUTINE (Hausarzt):** Leichte bis mäßige Symptome (Erkältung, leichte Schmerzen, etc.)
- **ICD-11 Mapping:** 35+ Codes gemappt (R07.9→NOTFALL, R51→BEREITSCHAFT, J00→ROUTINE)
- **Konfidenz:** 0.3 (ROUTINE) bis 0.9 (NOTFALL) — bei ≥0.7 braucht kein Ollama-Lauf
- **18 Unit-Tests**, 100% Coverage

#### Komponente 3: Auto-Detect in `routes/ai.ts` (`detectHealthSymptom()`)
- **Problem gelöst:** Flutter-App sendet nur `{ message: "..." }` ohne `services`-Objekt
- **Lösung:** `detectHealthSymptom()` erkennt medizinische Keywords automatisch
- **Word-Boundary Regex** (`\b`) vermeidet False-Positives:
  - `\bblut\b` matcht NICHT `Blumen` ✅
  - `\bdruck\b` matcht NICHT `Druckerei` ✅
  - `\bbrennen\b` matcht NICHT `Brennnessel` ✅
- **45+ Patterns:** Schmerzen, Fieber (38-59 Grad), Atemwege, Herz/Kreislauf, Magen-Darm, Neuro, Haut, Blut, Infektion, Verletzung
- **Performance:** <1ms pro Nachricht (Regex-Scan)

#### Live-Verifikation (2026-08-01)
| Nachricht | Triage-Level | Telefon |
|-----------|--------------|----------|
| "Ich habe starke Kopfschmerzen" | 🟢 ROUTINE | Hausarzt |
| "39.5 Grad Fieber mit Schüttelfrost" | ⚠️ BEREITSCHAFT | 116117 |
| "Ich habe starke Brustschmerzen" | 🚨 NOTFALL | 112 |
| "Ich kann nicht atmen, Atemnot" | 🚨 NOTFALL | 112 |
| "Hallo" | Kein Triage | — |
| "Ich kaufe Blumen und Druckpapier" | Kein Triage | — |

### ❌ Was fehlt (echte Lücken)
- ~~Flutter Integration-Tests fehlen noch für Login → Finance → Logout Flow~~ ✅ erledigt in Phase Q (`auth_integration_test.dart`)
- ~~Auth-Routing-Bug Regression-Test~~ ✅ erledigt in Phase Q (5 Tests in `auth_gate_test.dart`)
- ~~Parken (OSM Overpass)~~ ✅ erledigt (Commit d997789, 10 Unit-Tests + 6 Integration-Tests)
- ~~Health-Provider-Tests~~ ✅ erledigt (25 Tests in `health_provider_test.dart`: searchDoctors, loadSlots, bookAppointment, registerDoctor, DTO-Parsing)
- Auto-Migration health-check Tool (`npm run migrate:status`)

**Known Issues:**
- `lat: 0, lng: 0` Hack im Health Context — Triage braucht keine Koordinaten, könnte aber bei zukünftigen Erweiterungen Probleme machen
- Keyword-Drift: `detectHealthSymptom()` in `routes/ai.ts` und `triageRulesService.ts` haben separate Keyword-Listen — könnten auseinanderdriften
- Fehlende medizinische Fine-Tuning-Modelle (Med42-v2, BioMistral) — aktuell nur `qwen2.5:3b` (General Purpose)
- **Rate-Limiter behoben (2026-08-04):** Globaler Rate-Limiter in `src/backend/src/index.ts:57` — **`max: 200` pro 15 Minuten** (erhöht von 100). Render Free Tier cold-startet alle 15 Minuten, App macht 10-20 Requests beim Laden. E2E-Test angepasst (110→210 Requests). **Alle CI-Workflows grün.**

## Health AI Agent — Erweiterte Architektur (2026-08-03)

> **STATUS:** 📋 Diskussionsphase — KEINE Code-Änderungen ohne explizite Freigabe!
> **Skill-Datei:** `.claude/skills/heimat-health-ai.md`

### Vision

Ein intelligenter Health AI Agent, der:
- **Gespräche führt** (nicht nur Keywords matcht)
- **Differentialdiagnosen** liefert (nicht nur eine Antwort)
- **Gedächtnis hat** (Symptom-Verlauf über Tage/Wochen)
- **Kontext versteht** (Uhrzeit, Alter, Vorerkrankungen, Saison)
- **Prävention** empfiehlt (nicht nur akute Behandlung)

### Features (nach User-Freigabe)

| # | Feature | Priorität | Phase |
|---|---------|-----------|-------|
| 1 | **Gedächtnis** — Symptome über Tage/Wochen speichern | 🔴 Muss | Phase 1 |
| 2 | **Voice-Input** — Spracheingabe für Symptome | 🔴 Muss | Phase 1 |
| 3 | **Foto-Analyse** — Hautausschlag, Rötung fotografieren | 🟡 Nice-to-have | Nach Anfrage |
| 4 | **Medikamente** — User gibt Medikamente ein → Interaktionscheck | 🔴 Muss | Phase 1 |
| 5 | **Mental Health** — Depressions-Screening einbauen | 🔴 Muss | Phase 2 |
| 6 | **Prävention** — Alters-/Risiko-basierte Vorsorge | 🔴 Muss | Phase 2 |
| 7 | **Nachsorge** — Post-Termin-Follow-up | 🔴 Muss | Phase 2 |
| 8 | **Notfall-Kontext** — Uhrzeit/Allein-sein berücksichtigen | 🔴 Muss | Phase 1 |

### Phasen

| Phase | Features | Tage |
|-------|----------|------|
| **Phase 1** | Gedächtnis, Voice-Input, Medikamente, Notfall-Kontext | 5-7 |
| **Phase 2** | Mental Health, Prävention, Nachsorge | 5-7 |
| **Phase 3** | Foto-Analyse, Erweiterte Differentialdiagnose | 3-5 |

### Nächste Schritte

1. ~~**Diskussion abschließen**~~ ✅ Abgeschlossen
2. ~~**Detailliertes Design**~~ ✅ API-Schemas, DB-Tabellen, UI-Mockups erstellt
3. ~~**Proof of Concept**~~ ✅ Phase 1 Backend + Flutter DTOs/Provider/Screen
4. ~~**Flutter-Integration**~~ ✅ MedicationsScreen + Provider registriert
5. ~~**Phase 2 Backend**~~ ✅ Mental Health + Prävention + Nachsorge implementiert
6. ~~**Unit-Tests Phase 1**~~ ✅ 63/63 Tests bestanden
7. ~~**Unit-Tests Phase 2**~~ ✅ 42/42 Unit-Tests + 34/34 Integration-Tests = 105 Tests
8. ~~**Screens Phase 2**~~ ✅ MentalHealthScreen + PreventionScreen + FollowUpScreen
9. ~~**HealthScreen erweitern**~~ ✅ HealthScreenWithTabs mit 6 Tabs erstellt, Screens isEmbedded-kompatibel
10. ~~**HealthScreen ersetzen**~~ ✅ HealthScreenWithTabs mit voller Funktionalität (AI Chat, Doctor Search, Lebenszeichen) + Phase 2 Tabs
11. **Nächster Schritt:** Commit + Push oder Flutter-Tests ausführen





## Documentation map

| Doc | Purpose |
|-----|---------|
| `README.md` | User-facing: features, status, matrix room, Open Collective |
| `CONTRIBUTING.md` | Contributor onboarding: branch naming, PR flow |
| `heimat-plan.md` | Long-form plan: market analysis, legal, architecture |
| `AGENTS.md` | **Read first.** Compact AI-agent rules, commands, CI gates, known bugs |
| `.claude/CLAUDE.md` | Verbose mirror of AGENTS.md for Claude |
| `.claude/skills/` | Loadable skill files (heimat-flutter, heimat-backend, heimat-deploy) |
| `.opencode/skills/heimat-dev/SKILL.md` | Auto-loaded by OpenCode for HEIMAT tasks |
| `knowledge.md` | This file — Freebuff's fast-access summary |
| `docs/3-tab-rebuild-plan.md` | 3-Tab-Rebuild-Plan (WeChat-Muster) — 7 Phasen, 9 Dateien |
| `docs/api-reference.md` | API-Referenz — Beste verfügbare offene APIs für alle 14 Services |

## App-Navigation (3 Tabs — WeChat-Muster)

| Tab | Name | Inhalt |
|-----|------|--------|
| 0 | **Startseite** | Greeting, Dashboard, Smart Alerts, Daily Briefing, Zuletzt benutzt, Empfehlungen, AI-Chat FAB |
| 1 | **Dienste** | Globale Suche, Häufig benutzt, 6 Kategorien (Mobilität, Gesundheit, Alltag, Kultur, Finanzen, AI) |
| 2 | **Profil** | User-Info, Einstellungen, Verlauf, Notfall (112/116117), Abmelden |

## Service-Registry (14 Services, 6 Kategorien)

| Kategorie | Services | Status |
|-----------|----------|--------|
| **Mobilität** | ÖPNV ✅, Parken ✅, E-Laden ✅ | Alle funktionieren |
| **Gesundheit** | Ärzte ✅, Lebenszeichen ✅ | Beide funktionieren |
| **Alltag** | Wetter ✅, Luft ✅, Abfall ✅ (AbfallNavi Bund), Bürgeramt ⚠️ (Berlin-Default), Jobs ✅ | 4 funktionieren, 1 ortsabhängig |
| **Kultur & Reise** | Events ⚠️ (NUR Berlin), Hotels ❌ (Berlin-Default + keine Daten) | Nicht ortsunabhängig |
| **Finanzen** | Taler-Wallet ✅ | Funktioniert |
| **AI** | HEIMAT AI ✅ | Funktioniert| **Gesamt:** 13/14 Services funktionieren ortsunabhängig, 1 eingeschränkt (Waste), 0 nicht verfügbar.

### ✅ Berlin-Hardcoding behoben (2026-08-04)

**Commit `afdec39`**: Alle 6 Services sind jetzt ortsunabhängig.

| Service | Vorher | Nachher |
|---------|--------|---------|
| Events | `lat || 52.52` hardcoded | ✅ GPS via LocationService |
| Hotels | `lat = 52.52` Default | ✅ GPS via LocationService |
| Bürgeramt | `lat = 52.52` Default | ✅ GPS via LocationService |
| Smart Alerts | `lat = 52.52` Default | ✅ GPS via LocationService |
| Daily Briefing | `lat = 52.52` Default | ✅ GPS via LocationService |
| Search | `lat || 52.52` Default | ✅ GPS via LocationService |

**Änderungen:**
- Backend: 6 Routes erzwingen lat+lng als Pflichtparameter (400 bei fehlend)
- Flutter: 6 Screens nutzen `LocationService.getCurrentLocation()`
- AI Chat: "Ärzte in Berlin" → "Ärzte in meiner Nähe"

**Noch nicht ortsunabhängig:** Waste (nur Berlin/Hamburg/München + 19 AbfallNavi-Regionen)

### AbfallNavi Integration (2026-08-04)
- **API:** `https://abfallnavi.api.bund.dev/` (Bund/RegioIT) — kostenlose staatliche API
- **19 Regionen:** Nürnberg, Aachen, Solingen, Norderstedt, Bergisch Gladbach, Dinslaken, Dorsten, Gütersloh, Halver, Kreis Coesfeld, Kreis Heinsberg, Kreis Pinneberg, Kreis Warendorf, Lindlar, Lüdenscheid, Roetgen, EGW Westmünsterland, AWA Entsorgungs GmbH, Bergischer Abfallwirtschaftverbund
- **Backend:** `abfallNaviService.ts` + `wasteCityRegistry.ts` erweitert + `wasteService.ts` adapter integriert
- **API-Flow:** GET /orte → GET /orte/{id}/strassen → GET /strassen/{id}/ → GET /termine → Echte Abholtermine
- **Commit:** `feat(backend): AbfallNavi (Bund) Integration` — CI grün nach E2E-Test-Fix

## Cost / footprint

- ~€70/year hosting (Hetzner Cloud). Domain €10/year. 100% volunteer labor. Funded via Open Collective + Prototype Fund/BMBF/Stiftungen grants.
