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

6. **Route order in Express:** Define `/stops/search` BEFORE `/stops/:id` or Express captures `id="search"` and the search route 500s.

7. **Journey query params:** Backend expects `?from_lat=&from_lng=&to_lat=&to_lng=`. Flutter was sending `?from=lat,lng` — fixed in `mobility_provider.dart`, regression-prone.

8. **Render PORT:** Render routes to whatever port the process binds, but Dockerfile defaults to `ENV PORT=3000` — keep that contract.

9. **CORS/helmet:** Mobile must be able to load API responses. Required helmet config lives in `src/backend/src/index.ts`: `crossOriginResourcePolicy: 'cross-origin'` etc.

10. **GTFS zip import is allowed** (`gtfs.de/nv_free`), CC-BY. NOT a rule violation.

11. **Doctors on the health page are real Overpass results for Berlin** (not hardcoded seed data). `schema.sql:370`: "Keine Seed-Daten".

12. **Finance `user-demo-001` is still hardcoded** in `finance_provider.dart:45`. Backend JWT-Auth is live on Production since 2026-07-25 (`/api/auth/{register,login,me}` end-to-end against `heimat-backend.onrender.com`); Mobile-Finance still needs to be wired against the real token instead of the demo user.

   **Update 2026-07-25 (Commits cfb0561 + e00105d):** WIRING DONE. `_authService.authHeaders` schickt jetzt Bearer-Token in allen 5 Finance-HTTP-Calls (initWallet, loadWallet 2x, loadTransactions, sendMoney). Die `/$userId`-URL-Suffixe wurden entfernt (Backend identifiziert User aus Bearer-Token via `requireAuth`). Backend hat zusätzlich eine `GET /api/finance/wallet`-Route bekommen (Commit e00105d). Schema hat eine alte `wallet_priv` Legacy-Spalte per `ALTER TABLE … DROP COLUMN IF EXISTS` verloren. End-to-End Finance-Roundtrip sollte jetzt mit Token-Auth gegen Render produktiv sein.

13. **Phase 23 Roundtrip ✅ Live (2026-07-25):** Finance-JWT-Integration abgeschlossen. ADMIN_KEY auf Render gesetzt. preDeployCommand (auto) + `/api/admin/migrate` (manual) beide grün am 2026-07-25. security.test.ts Regression-Lock aktiv (Commit 3414aea). Konkret: (a) Mobile `finance_provider.dart` schickt Bearer-Token via `_authService.authHeaders` in allen 5 HTTP-Calls. (b) Backend `GET /api/finance/wallet` Route neu (Commit e00105d). (c) Schema `wallet_priv` Legacy-Spalte per `ALTER TABLE DROP COLUMN IF EXISTS` verloren. (d) Ungeschützter `POST /api/migrate` entfernt (Commit 25ac7ab); nur `/api/admin/migrate` mit `X-Admin-Key` Header bleibt. (e) `src/backend/src/scripts/migrate.ts` (Node.js) läuft im `preDeployCommand` nach `buildCommand` (Commit e7fcd85) — wendet `dist/database/schema.sql` automatisch auf Production-DB an. (f) `src/backend/src/__tests__/security.test.ts` (Commit 3414aea) regresssion-locked dass POST /api/migrate 404 retourniert (sonst 200 mit Schema-loaded-Body). (g) Backend-CI Run #30173698956 für e7fcd85 grün (Lint/Test/Build).

### Phase Q Recap — Stand 2026-07-27
**Commits dieser Phase:** `78a371d` (Refactor + 11 AuthLock-Tests) und `ea29e63` (CI-Format-Fix für 2 Test-Files). Architektur-Drift zwischen Production und Test aufgelöst, CI grün am 2026-07-27.

| Schritt | Datei | Was geändert |
|---------|-------|--------------|
| 1 | `lib/core/auth/auth_gate.dart` (NEU) | AuthGate extrahiert, `authenticated` Parameter required → kein silent-default-widget |
| 2 | `lib/main.dart` (EDIT) | Inline `class AuthGate` 11-zeilen-Block entfernt; Route: `AuthGate(authenticated: const MainScreen())` |
| 3 | `test/auth_gate_test.dart` (REWRITE) | Importiert echtes AuthGate via package; 2 Tests → 5 Tests (unauth/auth/transition/loading/partial-auth) |
| 4 | `test/auth_integration_test.dart` (NEU) | `_FakeAuthProvider extends AuthProvider` + `_MockMainWithLogout` Stub; 6 Tests (Cold-Start/Login/Popup-Logout/Cycle/AUTH-LOCK/RegisterScreen) |
| – | **Total** | **4 Dateien, 11 neue authlock-regression-Tests, ~470 Lines new code** |

**Lessons in Freebuffs knowledge.md "Lessons-Learned" Section bereits verriegelt:** `pumpAndSettle()` verboten, Stub-Erbschaft-Pattern gegenüber Mockito bevorzugt, AuthGate-Required-Parameter-Pattern.

## HEIMAT Expansion Plan (Phase 25-26) — Juli 2026

### Vision: HEIMAT als WeChat/Grab-Alternative mit deutscher Open-Source-DNA

Basierend auf WeChat (China) und Grab (Singapur) wird HEIMAT von 3 auf **10+ Services** expandiert — alles mit offenen Daten, staatlichen Quellen und AI-Unterstützung.

### Neue Services

| # | Service | Datenquelle | Typ | Echtzeit | AI-Feature |
|---|---------|------------|-----|----------|------------|
| 4 | 💬 **Chat/Social (Futai)** | Futai (github.com/abatn/futai) | Open Source | ✅ | Ollama-KI-Twin + Gedächtnis |
| 5 | 🌤️ **Wetter** | DWD (Deutscher Wetterdienst) | 🏛️ Staatlich CC-BY | ✅ | Unwetter-Früherkennung |
| 6 | 🌬️ **Luftqualität** | Umweltbundesamt (UBA) | 🏛️ Staatlich Open Data | ✅ | Gesundheitsempfehlung |
| 7 | 🗑️ **Abfallkalender** | Kommunale Open-Data-Portale | 🏛️ Staatlich | ✅ | Sortier-Tipps + Erinnerung |
| 8 | 🔌 **E-Ladestationen** | OpenStreetMap + GoingElectric | 🌍 Open Source | ⚠️ | Routenplanung inkl. Ladestopps |
| 9 | 💼 **Job-Suche** | BA (inoffizielle/Community-API) + Adzuna | 🏛️ Staatlich / Kommerziell | ✅ | Job-Matching + Skill-Gap |
| 10 | 📰 **Veranstaltungen** | Wikidata + OSM + Stadtportale | 🌍 Open Source | ✅ | Personalisierte Empfehlung |
| 11 | 🏨 **Hotels & Unterkünfte** | OSM + Wikidata (nur Standort-Daten, keine Buchung) | 🌍 Open Source | ❌ | Reiseplanung mit Budget |
| 12 | 🅿️ **Parken** | OpenStreetMap (OSM) | 🌍 Open Source | ⚠️ | — |
| 13 | 🏛️ **Bürgeramt-Services** | Kommunale APIs | 🏛️ Staatlich | ✅ | AI-Terminfindung |

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
| **C** | E-Ladestationen (OSM) + Parken (OSM) | 2-3 |
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

### ✅ Health-Screen Overhaul (2026-07-30, Commits 9934c45 + 494e7d6 + dd0f9ed)
- **classifySpecialty()** von 6 auf 15 Regeln erweitert (Kinderarzt, Frauenarzt, Kardiologe, Orthopädie, Neurologe, Psychotherapeut, Pneumologie, Allergologie, Innere Medizin, Sportmedizin)
- **distanceKm** Feld + `haversineKm()` Methode — Entfernungsberechnung für alle Ärzte, sortiert nach Distanz
- **12 Specialty-Chips** statt 6 (Kinder, Frauen, Herz, Ortho, Neuro, Psyche)
- **Distance-Badge** auf jeder Arzt-Karte (blaue Pille, z.B. "1.2 km")
- **Anruf-Button** für alle Ärzte mit Telefon (SnackBar mit Telefonnummer)
- **CI-Fixes**: classifySpecialty Return-Wert an Tests angepasst (494e7d6), url_launcher entfernt wegen Platform-Channel-Mock-Problem (dd0f9ed)
- Backend `tsc --noEmit` ✅ | `audit-no-mocks.sh` ✅ 0 violations

### ❌ Was fehlt (echte Lücken)
- ~~Flutter Integration-Tests fehlen noch für Login → Finance → Logout Flow~~ ✅ erledigt in Phase Q (`auth_integration_test.dart`)
- ~~Auth-Routing-Bug Regression-Test~~ ✅ erledigt in Phase Q (5 Tests in `auth_gate_test.dart`)
- Auto-Migration health-check Tool (`npm run migrate:status`)

### ✅ Phase Q: Quality-Pass (2026-07-27, Commit 78a371d, CI grün via ea29e63)

**AuthGate-Extraktion + 11 neue authlock-regression-Tests:**

1. **`lib/core/auth/auth_gate.dart` NEU**: Pure Routing-Widget mit required `authenticated` Parameter. Single Source of Truth für auth-Routen-Entscheidung. main.dart injiziert MainScreen; Tests injizieren Mock-Widget. Eliminiert Drift zwischen Production und Test.
2. **`main.dart` EDIT**: Inline `class AuthGate extends StatelessWidget` Block entfernt (war 11 Zeilen). Route '/' jetzt `AuthGate(authenticated: const MainScreen())`.
3. **`test/auth_gate_test.dart` REWRITE**: Importiert echtes AuthGate via package-Pfad (keine inline Copy mehr). 5 Tests: unauth→LoginScreen, auth→MockMain, transition logout→LoginScreen, loading-state, partial-auth (token ohne user_id edge case).
4. **`test/auth_integration_test.dart` NEU**: `_FakeAuthProvider extends AuthProvider` (Stub-Vererbungs-Pattern, mirror zu `_StubFinance` in `app_smoke_test.dart`). `_MockMainWithLogout` mit PopupMenuButton Logout-Spiegel. 6 Tests: Cold-Start, Login transition, Logout via PopupTap, Login-Logout-Login cycle, AUTH-LOCK state-injection, RegisterScreen Top-Level.

**Lessons-Learned (für Future-Tests):**
- `pumpAndSettle()` **VERBOTEN** im Mobile-Test-Code — infinite-Animation-Hang hält Tests für immer auf (siehe Phase E Wetter-Flicker). Stattdessen `tester.pump(Duration(milliseconds: 100))` mit 100-200ms Intervallen.
- `SharedPreferences.setMockInitialValues({})` in JEDEM setUp() für Test-Isolation.
- Stub-Vererbung > Mockito-build_runner — kein Generator-Overhead, kein hidden Magic.
- AuthGate-Required-Parameter-Pattern: explicit `authenticated:` injection verhindert silent-default-widget-bugs (keine versteckte Render-Verzweigung wenn Caller vergisst zu spezifizieren).

**Validation:**
- Code-Reviewer-minimax-m3: 9/9 Fragen PASS (Q1-Q9); 5 minor feedback (non-blocker).
- Static drift-check: nur 1 AuthGate-Declaration gesamt im Repo (in `auth_gate.dart`).
- Unused-Imports Audit: alle 22 Imports in `main.dart` werden verwendet.

CI: Code gepusht (`78a371d`), Flutter CI Pipeline (analyze + test + smoke) läuft automatisch.



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

## Cost / footprint

- ~€70/year hosting (Hetzner Cloud). Domain €10/year. 100% volunteer labor. Funded via Open Collective + Prototype Fund/BMBF/Stiftungen grants.
