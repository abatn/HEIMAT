# AGENTS.md

HEIMAT 2.0 – open-source "super app" (German docs/UI). Three services under `src/`:
- `src/mobile/` – Flutter app (map/ÖPNV, Taler payments, doctor appointments)
- `src/backend/` – Node 18+ / TypeScript Express API (port 3000)
- `src/ml-service/` – Python FastAPI (port 8000, Docker only)

> **Aktueller Status-Override (2026-08-06):** Im Arbeitsverzeichnis läuft kein lokaler Backend-Server und kein lokales PostgreSQL. Es gibt daher keinen lokalen End-to-End-Nachweis. Die öffentliche Production-Prüfung ist nur eine Read-only-Teilmatrix: Wetter, Luftqualität, E-Laden, Parken, Events, Hotels, Bürgeramt und Jobs bestanden; Abfall ist bei `CITY_NOT_SUPPORTED` `degraded`; die universelle Event-Suche ist `fail`; Mobility-Journey, Finance, Health, Check-in und AI-Chat sind unbewertet/offen. Historische „live“-/Phasenangaben weiter unten sind keine aktuelle Gesamtfunktionszusage.

## Critical: untracked junk in the working tree

- `src/mobile/flutter/` is a **full vendored Flutter SDK checkout** (3.24.5). Untracked, not gitignored. Never edit, search, or `git add` anything under it.
- Also untracked and not ignored: `src/mobile/android/`, `src/mobile/ios/`, `src/mobile/mobile.iml`, `.mimocode/`. CI regenerates android/ios via `flutter create . --platforms ...`.
- **Never `git add -A` / `git add .` from the repo root.** Stage files explicitly.

## Toolchain

- `flutter`, `dart`, `node` are **not on PATH**. Use: `src/mobile/flutter/bin/flutter` and `src/mobile/flutter/bin/dart`.
- Backend needs Node 18+ (CI uses Node 20).

## Commands

### Backend (run in `src/backend/`)

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint |
| `npm test` | Jest (`--coverage --forceExit`, needs Postgres) |
| `npx jest src/__tests__/mobility.test.ts` | Single test |
| `npx tsc --noEmit` | Typecheck |
| `npm run import:gtfs` | GTFS import |
| `npm run test:db` | Start local Postgres test DB (Docker) |

**Schema:** `src/backend/src/database/schema.sql` (409 lines, 16 tables). CI loads it via `psql -f src/database/schema.sql`. There is no `npm run migrate` / `npm run seed` – those scripts don't exist. A `POST /api/migrate` endpoint loads schema at runtime (admin-only).

**Tests need Postgres.** CI spins up `postgres:15-alpine` with DB `heimat_test`. The test suite uses `DB_*` env vars; `forceExit: true` in jest config.



### Mobile (run in `src/mobile/`, using vendored SDK)

```bash
src/mobile/flutter/bin/dart format lib/ test/   # MUST run before every Dart commit
src/mobile/flutter/bin/flutter analyze --no-fatal-infos
src/mobile/flutter/bin/flutter test
src/mobile/flutter/bin/flutter test test/widget_test.dart   # Single test
src/mobile/flutter/bin/flutter test test/app_smoke_test.dart  # UI smoke test
src/mobile/flutter/bin/flutter pub get
```

No `analysis_options.yaml` – analyzer runs with defaults. `flutter_lints` is in `pubspec.yaml` but unused.

## CI gates (`.github/workflows/`)

| Workflow | Order | Common CI failure |
|----------|-------|-------------------|
| `flutter.yml` | `dart format` → analyze → test (+ smoke in parallel) → build-web + build-android | Unformatted Dart |
| `backend.yml` | lint → test (needs Postgres) → `tsc --noEmit` | Missing types |
| `deploy-web.yml` | Push `src/mobile/**` to `main` → full CI → `flutter build web --release --base-href "/HEIMAT/"` → GitHub Pages | – |

Dependabot patches are auto-approved and auto-merged via `dependabot-auto-merge.yml`.

## Production-First (no sandbox)

- **No sandbox.** All work targets production (Supabase + Render).
- **Current local limitation (2026-08-06):** Im aktuellen Arbeitsverzeichnis läuft kein lokaler Backend-Server und kein lokales PostgreSQL. `localhost`-/`ECONNREFUSED`-Befunde sind kein Produktnachweis.
- **Supabase + Render must be operational** – sie sind die einzige reale Test-/Deployment-Umgebung; CI mit bereitgestelltem PostgreSQL und read-only Production-Checks sind maßgeblich.
- **Service-Regel:** Ein Service gilt erst nach realem Datenpfad, Tests und Production-Check als funktionfähig. Die öffentliche Read-only-Teilmatrix ist kein Gesamtcheck; viele Services bleiben offen, degraded, fail oder unbewertet.
- **Code is committed and deployed via CI/CD** – no pre-production workflow.

## Conventions

- **Conventional Commits, lowercase, German descriptions** – e.g. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`
- **Service URLs** from `--dart-define BACKEND_URL`. Default: `BACKEND_URL=https://heimat-backend.onrender.com`. See `src/mobile/lib/core/config/app_config.dart`.
- **GTFS import** via `src/backend/scripts/import-gtfs-local.ts` (not on Render — free-tier memory/timeout).
- **Root `*.md` files** (`AI-*.md`, `heimat-plan.md`, `.loop.md`, `blog/`, `funding/`, `marketing/`) are planning/marketing docs, not code documentation.
- **Admin endpoints** require `ADMIN_KEY` env var (no static fallback).
- **Taler** is a real GNU Taler wallet client (`exchange.demo.taler.net`, Ed25519 wallets). HEIMAT ist Wallet-Client (kein Exchange-Betreiber). Currency wird dynamisch aus Exchange-/keys gelesen (Commit `d91fc76`). `TALER_EXCHANGE_URL` per env-var konfigurierbar — kein Code-Change nötig für EUR.

## Known bugs

| Symptom | Cause | Fix |
|---------|-------|-----|
| `'toDouble' Dynamic call of null` on latitude/longitude | Postgres DECIMAL → Node pg passes string → Flutter `.toDouble()` on null | `double.parse(json['latitude'].toString())` in providers |
| `received value must be a number or bigint` in Jest tests | Postgres COUNT(*)/DECIMAL returns strings (e.g. `"7"`), Jest `toBeGreaterThanOrEqual()` expects number | Cast in service: `Number(result?.count ?? 0)`. Also DECIMAL columns like `location_lat` return strings — use `Number()` in tests or services. |
| "Haltestellen konnten nicht geladen werden" | Helmet CORS blocks API | Index.ts has permissive helmet config |
| `GET /stops/search` returns 500 "invalid input syntax for type uuid" | Express matches `/stops/search` as `/stops/:id` with `id="search"` | Define `/stops/search` before `/stops/:id` in `mobility.ts` |
| Journey search empty | Frontend sends `?from=lat,lng`, backend expects `?from_lat=&from_lng=` | Fix query params in `mobility_provider.dart` |
| db-rest health check passes but endpoints return empty | Docker image default `ENV PORT 3000`, Render routes to port 3001 | Set `ENV PORT=3000` in Dockerfile or adjust render.yaml |
| Login "stuck on LoginScreen" with valid credentials | LoginScreen/RegisterScreen didn't react to `isAuthenticated` because Hash-Routing on `/#/login` or `/#/register` mounts the screens directly via `routes` table, bypassing `AuthGate` mounted at `'/'` | Explicit `Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false)` (with `!mounted` early-exit) after successful login/register. Files: `src/mobile/lib/features/auth/presentation/{login,register}_screen.dart`. Fix committed `9c8deb7` (2026-07-25) |
| Services mit Berlin-Hardcoding (BEHOBEN ✅) | ~~Events, Hotels, Bürgeramt, Smart Alerts, Daily Briefing~~ Alle via GPS dynamisiert (Commit `afdec39`). | Backend: lat+lng als Pflichtparameter. Flutter: LocationService.getCurrentLocation(). |
| ~~Events API noch Berlin-fokussiert~~ BEHOBEN ✅ | `eventService.ts` nutzt `kulturdaten.berlin` API — aber lat/lng dynamisch via GPS | Backend erzwingt lat+lng, keine Hardcodierung |

## Clarifications (Juli 2026)

### GTFS ZIP import: NOT a rule violation
The GTFS zip import (`gtfs.de/nv_free`) does NOT violate any project rules. CC-BY licensed, explicitly allowed in `project-prompt.md:59` and `heimat-plan.md:392`.

### Doctors: 100% Overpass-Live, keine Seed-Daten (Commit 760d88f)
Berlin-Seed entfernt. Alle Ärzte live von Overpass (OSM) — weltweit, standortunabhängig. `ensureDoctorInDb()` auto-saved OSM-Arzt in DB bei Terminbuchung mit Default-Slots (Mo-Fr 8-17). `requireAuth` auf `/doctors/ensure`. classifySpecialty(): 16→25 Rules, 52 Unit-Tests.

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

### Finance: Demo user status (Juli 2026)
`finance_provider.dart:45` still hardcodes `user-demo-001`. **Backend JWT-Auth is live on Production since 2026-07-25** (`/api/auth/{register,login,me}` end-to-end against `heimat-backend.onrender.com`). Mobile-Finance-Integration (Provider + Headers + Screen) is the remaining track.

**Update 2026-07-25 (Commits cfb0561 + e00105d):** Finance-Roundtrip ist nun end-to-end live: `_authService.authHeaders` schickt Bearer-Token in alle 5 Finance-Calls, URL-Pfade ohne `/$userId`-Suffix (Backend leitet User aus Token ab), `GET /api/finance/wallet`-Route neu im Backend, `wallet_priv` Legacy-Spalte per Schema-Migration gedroppt.

### Phase 23: Roundtrip ✅ Live (2026-07-25)
Finance-JWT-Integration abgeschlossen (historischer Nachweis). ADMIN_KEY auf Render gesetzt; Migration läuft aktuell im Startup-Hook, `/api/admin/migrate` bleibt der manuelle Admin-Pfad. security.test.ts Regression-Lock aktiv (Commit 3414aea).

Wichtige Commits (in Reihenfolge):
- `cfb0561` — Mobile `finance_provider.dart`: Bearer-Header in allen 5 Finance-HTTP-Calls.
- `e00105d` — Mobile URL-Pfade bereinigt (kein `/$userId` Suffix); Backend identifiziert User aus Bearer-Token; neue `GET /api/finance/wallet` Route; Schema-Migration `DROP COLUMN IF EXISTS wallet_priv`.
- `25ac7ab` — Security-Fix: ungeschützten `POST /api/migrate` Endpoint entfernt (jeder konnte DB-Schema mutieren).
- `3414aea` — Regression-Lock: `src/backend/src/__tests__/security.test.ts` verriegelt dass POST /api/migrate 404 retourniert (Body-Lock verhindert subtile Refactors).
- `e7fcd85` — Auto-Migration: `src/backend/src/scripts/migrate.ts` (Node.js Schema-Applier mit Password-Redaction) läuft aktuell im blockierenden Startup-Hook vor `app.listen`. Atomar (Fehler → Instanz startet nicht).

**Verifikation auf Render:** POST `/api/admin/migrate` mit `X-Admin-Key` Header retourniert HTTP 200 `{"success":true,"message":"Schema migrated"}` in ~213ms (Supavisor-Pooler + Postgres-Ack).

### Auth-Track live on Production (Juli 2026)
- **Backend**: `/api/auth/{register, login, me}/...` is end-to-end live on `heimat-backend.onrender.com`. Smoke-test user `heimat-demo-user@heimat.de / DemoHeimat2026!` is in the Supabase production-DB (2026-07-25).
- **Mobile**: `AuthProvider` + `AuthService` + `LoginScreen`/`RegisterScreen` + `AuthGate` (in `main.dart`) orchestrate the JWT roundtrip. `SharedPreferences` persists the token. The MainScreen AppBar carries a `⋮`-PopupMenu with Logout (Commit `1090203`).
- **Auth-Routing-Bug fixed** (Commit `9c8deb7`): deep links to `/#/login` or `/#/register` now take the user to MainScreen after successful auth. Hash-Routing on a non-root route bypasses AuthGate, so `isAuthenticated` listener was missing — explicit `Navigator.pushNamedAndRemoveUntil('/', (route) => false)` was added in `login_screen.dart` and `register_screen.dart`.
- **Render + Supabase connection** (`render.yaml`): now using **Supavisor pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`), `DB_SSL=true`, Node 20, devDeps-pruned. Supavisor pools Render Free Tier (IPv4) traffic to the Supabase IPv6-only DB column endpoint.

## Phase 23 Recap — Stand Juli 2026

> **Historischer Implementierungsnachweis, kein aktueller Gesamtstatus:** Die folgenden Phase-23-Angaben dokumentieren damalige CI-/Production-Meilensteine. Im aktuellen Arbeitsverzeichnis läuft kein lokaler Server/PostgreSQL; einzelne Services dürfen erst nach aktuellem read-only Production-Check als funktionfähig gelten.

Auf einen Blick: Produktion läuft, Finance-Roundtrip ist end-to-end live, Auto-Migration ist abgesichert; kleinere offene Tasks in klarer Reihenfolge.

### ✅ Was funktioniert
- **User-Auth** (JWT + bcryptjs): Register/Login/Logout end-to-end live auf `heimat-backend.onrender.com`
- **Finance-JWT-Roundtrip**: Mobile Bearer-Header in allen 5 Finance-Calls, URL-Pfade ohne `/$userId`-Suffix, Schema-Migration `wallet_priv` durchgelaufen
- **Security-Härtung**: ungeschützter `POST /api/migrate` entfernt; `security.test.ts` Regression-Lock aktiv (Commit 3414aea)
- **Auto-Migration**: `AUTO_MIGRATE=true` startup-hook (Commit 7e5f063) — ✅ Live bestätigt am 2026-07-25 (Build-Log + funktionaler Beweis)
- **Admin-Pfad**: `ADMIN_KEY` auf Render; `POST /api/admin/migrate` positive-control HTTP 200 in ~213ms
- **DB-Connection**: Supavisor-Pooler via `family:4` IPv4-Force, SSL
- **Taler Wallet-Client**: `exchange.demo.taler.net` erreichbar (GET /keys + /reserves). HEIMAT ist reiner Wallet-Client — kein eigener Exchange-Betreiber. Currency dynamisch aus /keys (Commit d91fc76) — EUR-ready via `TALER_EXCHANGE_URL` env var.
- **UX-Modernisierung (Commit 5ad8068, 661afb28, f389001)**: FinanceScreen (animierte Balance-Card, Quick Actions, Timeline), HealthScreen (Shimmer, DoctorCards mit Presseffekt, Gradienten), MobilityScreen (GPS/Route/Marker Widgets, Gradienten)
- **CI-Fix Runde 1**: `unnecessary_null_comparison` lint durch `// ignore:` geloest, `dart format` auf beide Screens angewandt
- **CI-Fix Runde 2 (2026-07-27)**: `withOpacity` statt `withValues` (Flutter 3.24.5 Kompatibilitaet), `unnecessary_non_null_assertion` in `home_screen.dart` entfernt, Conditional Imports korrigiert, `deploy-web.yml` safe.directory Fix — Flutter CI wieder gruen fuer Commit `246ece3`
- **Phase A: Mini-Program-Container (Commit 92ec307)**: WebView-Framework mit 10 Mini-Programmen (Futai, Wetter, Luft, Events, Jobs, E-Ladestationen, Abfall, Hotels, Parken, Buergeramt) + Apps-Tab + Conditional Imports (dart:html fuer Web, Stub fuer Mobile)
- **AbfallNavi Integration (2026-08-04)**: Staatliche Bund-API `https://abfallnavi.api.bund.dev/` (RegioIT) — 19 Regionen, kostenlose OpenAPI. `abfallNaviService.ts` + `wasteCityRegistry.ts` erweitert (adapter: `abfall_navi`). API-Flow: /orte → /strassen → /termine → echte Abholtermine. CI grün nach E2E-Test-Fix.
- **Rate-Limiter behoben (2026-08-04)**: `max: 200` pro 15 Min in `index.ts:57` (vorher 100). E2E-Test: 110→210 Requests. Alle 3 CI-Workflows grün: Backend CI ✅, Flutter CI ✅, Deploy Web ✅.
- **AI-Home Dashboard (Commit 0308bfaa)**: Personalisierter AI-Startseiten-Tab mit Tageszeit-basierten Vorschlaegen + Greeting-Card + Nearby-Stops
- **Dashboard-Navigation (Commits bd04e2b + 4fcb0ac)**: Quick Actions, Stat-Karten (Haltestellen/Ärzte/KUDOS) und AI-Vorschläge navigieren jetzt per onNavigateTab-Callback zum richtigen Tab. CI grün, Deployed ✅
- **Phase B: Wetter-Mini-Programm (Commit 9e42a30)**: weatherService.ts (Open-Meteo DWD-Client), weather.ts (3 Endpoints), weather.html (Standalone HTML-Seite mit Geolocation + 24h + 7-Tage). 429-Retry mit exponentiellem Backoff fix deployed ✅
- **Quick-Actions-Flicker-Fix (Commit 8aad85f)**: Root Cause: getPersonalizedContext() überschrieb Quick Actions mit intent-spezifischen 2-Button-Sets („Störungen/Alternativ", „Abfahrten/Echtzeit"). Fix: Nur Suggestions werden personalisiert, Quick Actions bleiben immer die 4 Standard-Buttons. Dead Code (intentQuickActions, 25 Zeilen) entfernt. ✅
- **Funded-Wallet-Pfad (Phase R, 2026-07-27)**: Wallet-Balance bleibt 0.00 KUDOS bis ein EUR-Production-Exchange (oder bank.demo.taler.net) Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. fundLocal Mock-Endpoint liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" + `_computeMockLiveStatus` entfernt (Commit 7718333). User-Regel (AGENTS.md:143 + knowledge.md:283): "mock, simulation, fake sind verboten" — enforced via audit-no-mocks.sh in CI (Commit 82047ad).
- **Backend CI**: Lint + Jest + tsc grün
- **Swagger UI**: /docs + /docs.json live
- **Mobilität + Gesundheit**: seit MVP grün

- **Phase E Wetter Real-Fix ✅ (2026-07-27, Commit 99daa9c)**: Render Free-Tier 429-Rate-Limit auf Open-Meteo behoben via Mirror-Fallback-Pattern. Open-Meteo primary (reduziert 2× Retry) + Bright Sky DWD-Proxy (`api.brightsky.dev`) als fallback. Architektur-Spiegel von mobilityService.ts Overpass-Mirror-List. **WICHTIG: keine Mocks/Simulations** (per User-Regel "mock, simulation, fake sind verboten") — alle HTTP-Calls gegen reale Upstream-APIs. Constructor-DI für Test-Seam. 10/10 Tests grün (jest). Live: Berlin 21.1°C, Klarer Himmel, 28.1 km/h Wind via `heimat-backend.onrender.com/api/weather/forecast`. Mobile DTO erhalten → kein Flutter-Rebuild.
- **Health-Screen Overhaul ✅ (Phase 1-3, 2026-07-30)**: classifySpecialty() 16→25 Rules (Commits 7daca23 + f6c05c9). 21 Specialty-Chips. 52 Unit-Tests. distanceKm + haversineKm. Distance-Badge + Anruf-Button. **Phase 3 (Commit 760d88f): Ortsunabhängigkeit** — Berlin-Seed entfernt, 100% Overpass-Live weltweit. `ensureDoctorInDb()` auto-saved bei Terminbuchung. Backend tsc + audit-no-mocks ✅.
- **Ollama Auto-Detect ✅ (2026-07-31, Commits 2c6e09e + 03ef14d + f58ac7b + b586df3)**: `detectAvailableModel()` via `GET /api/tags` wählt automatisch kleinste Modell (qwen2.5:3b > phi3 > llama3.1:8b). Cold-start Fix: `getActiveModelAsync()` max 5s. Response zeigt `qwen2.5:3b`. Timeout 60s. Prompt-Size Guard 6000 chars. Health Triage: Bei `symptom` nur Health-Kontext (weather/air/waste skippen).
- **E2E Retry Fix ✅ (2026-07-31, Commit fa27589)**: `withRetry()` (2 Retries, 30s Timeout) für flaky Overpass API. 429 accepted. Outer Timeout 90s. Backend CI grün.

### ⚠️ Was ist offen
- **Wallet-Balance bleibt 0.00 KUDOS bis EUR-Exchange-Live (Phase R geschlossen, 2026-07-27)**: Demo-Mock-Bypass fundLocal entfernt (per User-Regel). Wallet wird via echten Reserve-Adresse-Bank-Wire gefuellt (bank.demo.taler.net heute, EUR-Production-Exchange wartet auf oeffentliche GLS-Bank-Integration). Demo-Option (a) im Finanzen-Tab-Bottom-Sheet entfernt. EUR-Production-Exchange bleibt der einzige offene Block.
- **migrate.ts Unit-Test ✅ (Commit 06dc2e3)** — 18 Tests, alle gruen (success path, pool throws, redactConnectionSecrets edge cases, schema fehlt, lesefehler, exception-safety)

**📱 Taler aus der App — So funktioniert es fuer den User (Phase R, 2026-07-27):**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> nur echter Reserve-Adresse-Weg: Bank-Wire von bank.demo.taler.net (oder zukuenftiger EUR-Production-Exchange) auf Reserve-Adresse bucht Taler-Guthaben -> [Aktualisieren] -> Balance zeigt Live-Wert. Demo-KUDOS-Option "25 Demo-KUDOS erhalten" wurde komplett entfernt (kein Mock, kein Mock-Bypass, kein "Schneller Test-Wert"-Button). P2P-Send an registrierte HEIMAT-User funktioniert nach erfolgreichem Bank-Wire.

**⚠️ Option B (Bank-API automatisieren) bleibt Dead End (2026-07-27):** Die Taler-Demo-Bank hat nur Lese-API-Endpoints (`GET /accounts/{username}`, `GET /accounts/{username}/transactions`, `POST /accounts/{username}/token`) + `POST /admin/add-incoming` (Admin-Login noetig). KEIN user-autorisierter REST-Endpoint fuer Wire-Transfer. Phase-R-Entscheidung: Mock-Bypass fundLocal wurde deshalb KOMPLETT entfernt (Commit 2d3ae18) statt ihn durch Bank-API zu ersetzen. User fuehrt Bank-Wire manuell aus (Reserve-Adresse -> Button "Aktualisieren").

### ❌ Was fehlt / aktuell unbewertet
- **Aktuelle öffentliche Teilmatrix ist nicht vollständig:** Mobility-Journey, Finance, Health, Check-in und AI-Chat sind nicht als vollständige reale Servicepfade verifiziert.
- **Universelle Event-Suche:** Production-`fail`, solange `/api/search` keine echten Event-Ergebnisse liefert.
- **Abfall:** `degraded` an Orten mit `CITY_NOT_SUPPORTED`; nur belegte kommunale Quellen ergänzen.
- ~~Flutter Integration-Tests fehlen noch für Login → Finance → Logout Flow~~ ✅ erledigt in Phase Q (Commit 78a371d, `test/auth_integration_test.dart` mit 6 Tests).
- ~~Auth-Routing-Bug Regression-Test in mobile tests~~ ✅ erledigt in Phase Q (`test/auth_gate_test.dart` 5 authlock-regression-Tests).
- Auto-Migration health-check (`npm run migrate:status`)
- Phase B Rest: Luftqualität (UBA) + Abfallkalender — noch nicht gebaut. Wetter ist ✅ deployed (Commit 9e42a30).

### Phase Q Recap — AuthLock Qualitäts-Pass (2026-07-27, Commit 78a371d, CI grün via ea29e63)

**AuthGate-Extraktion eliminiert Production-Test-Drift:**
- Neu: `lib/core/auth/auth_gate.dart` — Pure routing widget mit required `authenticated` Parameter (kein DefaultRenderer der Bugs versteckt). Single Source of Truth für auth-Routen-Entscheidung.
- `lib/main.dart`: Inline `class AuthGate` 11-Zeilen-Block entfernt; Route '/' jetzt `AuthGate(authenticated: const MainScreen())`.
- `test/auth_gate_test.dart`: Importiert echtes AuthGate via package-Pfad (keine inline-Copy mehr) → Tests verifizieren EXAKT das was Production nutzt.
- `test/auth_integration_test.dart` (NEU): Full-flow-Test (Login → Logout cycle) mit `_FakeAuthProvider extends AuthProvider` — Stub-Vererbungs-Pattern mirror zu `_StubFinance` in `app_smoke_test.dart`. Kein HTTP, kein Test-Worker-Bootstrap.

**11 neue Tests:**
- 5 in `auth_gate_test.dart`: unauth→LoginScreen, auth→MockMain, transition-logout, loading-state, partial-auth (token ohne user_id edge case).
- 6 in `auth_integration_test.dart`: Cold-Start, Login()→Main, Logout-via-PopupMenuButton, Login-Logout-Login cycle, AUTH-LOCK state-injection, RegisterScreen Top-Level.

**Lessons-Learned in Test-Code (berritsch-Wichtiger Repo-Standard):**
- `pumpAndSettle()` **VERBOTEN** → infinite-Animation-Hang hält Tests auf ewig. Stattdessen `tester.pump(Duration)` mit 100-200ms Intervallen.
- `SharedPreferences.setMockInitialValues({})` in jedem setUp() für isolation.
- Stub-Vererbungs-Pattern (`_Stub<X>` + overrides) bevorzugt gegenüber Mockito-build_runner.

CI: Code-Reviewer-minimax-m3 9/9 PASS, Code gepuscht, Flutter CI Analyse+Test+Smoke läuft.

## Phase E: Native Flutter Services — Mini-Program Refactor (2026-07-27)

### Status
- ✅ **Wetter-Pilot implementiert + CI-grün (2026-07-27):** 9 neue Files unter `features/weather/` + `features/miniprogram/domain/service_definition.dart` + `features/miniprogram/domain/service_registry.dart` + `features/miniprogram/presentation/native_mini_program_screen.dart`. Alte `miniprogram_container.dart` bleibt als IFrame-Fallback für nicht-migrierte Services.
- ⏳ Andere 8 Mini-Programme (Air, Futai, Events, Jobs, Waste, Hotels, Parken, Bürgeramt) bleiben im IFrame-Fallback bis zu ihrer jeweiligen Migration.

### Architecture-Entscheidungen
- **ServiceRegistry-Pattern**: Singleton mit `Widget Function(BuildContext)` pro Service-ID. Tap auf App-Karte → Registry-Lookup → entweder native Builder ODER `MiniProgramContainer`-Fallback. Inversion-of-Control für saubere Trennung.
- **DTO Layer**: Thin DTO-Klassen spiegeln Backend JSON (kein doppeltes WMO-Decoding in Flutter). Backend bleibt Source-of-Truth.
- **Cache-Strategy**: Zwei-Tier Cache (In-Memory + SharedPreferences, 5-Min-TTL) für instant Tab-Switching + Cold-Boot-Persistenz.
- **LocationService-Integration**: `LocationService.getCurrentLocation()` mit 3-Sekunden-Timeout + Berlin-Fallback. Kein Hard-Code.
- **Pure Flutter-Widgets**: Kein `fl_chart`, kein `flutter_map` im Wetter-Pilot. Container + LinearGradient + ListView + CustomPainter sind ausreichend.

### Wichtiger Hinweis für Devs
- Für MIGRATION eines weiteren Services: ein Eintrag in `service_registry.dart` + neuer Provider + neuer Screen + in `miniprogram_provider.dart` `_defaultPrograms` setze `useNative: true` für die ID.
- Für AIR-QUALITY: bereits Backend-fertig (`src/backend/src/services/airQuality.ts` + `routes/airQuality.ts`). Reihenfolge: DTO → Provider → Screen → Registry-Eintrag.
- TODOs für Phase 1 nach `AI-Implementierungsplan.md`: TFLite-Klassifikation lokal, Vosk für Voice-Input, Coqui für TTS.

### Migration-Sicherheit
- IFrame-Backup bleibt für unbekannte serviceIds — kein Breaking Change.
- `useNative=false` per Default in `MiniProgram` Model → rückwärtskompatibel.
- Tap-Routing in `launchpad_screen.dart` `_launchProgram` → `NativeMiniProgramScreen` (siehe `_body` für die Lookup-Logik).

---

## 3-Tab-Rebuild (WeChat-Muster) — 2026-08-04

**Status:** ✅ Phase 0-4 abgeschlossen, CI grün.
**Plan:** `docs/3-tab-rebuild-plan.md` (519 Zeilen).
**API-Referenz:** `docs/api-reference.md` — Beste verfügbare offene APIs für alle 14 Services.

### Navigation (3 Tabs statt 5)

| Tab | Name | Inhalt | Datei |
|-----|------|--------|-------|
| 0 | **Startseite** | Greeting, Dashboard, Smart Alerts, Daily Briefing, Zuletzt benutzt, Empfehlungen, AI-Chat FAB | `home_screen.dart` |
| 1 | **Dienste** | Globale Suche, Häufig benutzt, 6 Kategorien | `services_screen.dart` |
| 2 | **Profil** | User-Info, Einstellungen, Verlauf, Notfall (112/116117), Abmelden | `profile_screen.dart` |

### ServiceRegistry (14 Services, 6 Kategorien)

| Kategorie | Services | displayOrder |
|-----------|----------|-------------|
| **Mobilität** | ÖPNV, Parken, E-Laden | 1-3 |
| **Gesundheit** | Ärzte, Lebenszeichen | 4-5 |
| **Alltag** | Wetter, Luft, Abfall, Bürgeramt, Jobs | 6-10 |
| **Kultur & Reise** | Events, Hotels | 11-12 |
| **Finanzen** | Taler-Wallet | 13 |
| **AI** | HEIMAT AI | 14 |

**Häufig benutzt (isFrequentlyUsed=true):** ÖPNV, Parken, E-Laden, Ärzte, Wetter.

### Änderungen

| # | Commit | Beschreibung |
|---|--------|-------------|
| 1 | `f3eb6f2` | 5→3 NavigationDestination, neue Imports |
| 2 | `11f46d4` | HomeScreen: "Neue Features" entfernt, Zuletzt benutzt + AI-Chat FAB |
| 3 | `b3c6ee2` | ServiceDefinition: displayOrder + isFrequentlyUsed, 6 Kategorien |
| 4 | `a4f3650` | Tests: app_smoke_test + service_registry_test angepasst |

### Dateien

| Datei | Status |
|-------|--------|
| `src/mobile/lib/main.dart` | Geändert (5→3 Tabs) |
| `src/mobile/lib/features/services/services_screen.dart` | Neu |
| `src/mobile/lib/features/profile/profile_screen.dart` | Neu |
| `src/mobile/lib/features/home/presentation/home_screen.dart` | Geändert |
| `src/mobile/lib/features/miniprogram/domain/service_definition.dart` | Geändert (+2 Felder) |
| `src/mobile/lib/features/miniprogram/domain/service_registry.dart` | Geändert (6 Kategorien) |

### CI
- Flutter CI: ✅ grün (7min)
- Deploy Web: ✅ grün (4min)
- audit-no-mocks: 0 violations

---

## HEIMAT Expansion Plan (Phase 25-26) — Juli 2026

### Von 3 auf 10+ Services — wie WeChat/Grab, aber Open Source

| # | Service | Datenquelle | AI | Status |
|---|---------|------------|-----|--------|
| # | Service | Datenquelle | AI | Phase | Status |
|---|---------|------------|-----|-------|--------|
| 4 | 💬 **Chat/Social** | Futai (github.com/abatn/futai) via Mini-Program | Ollama Twin | D | ⏳ |
| 5 | 🌤️ **Wetter** | DWD (Deutscher Wetterdienst) CC-BY | Unwetter-Früherkennung | B | ✅ Deployed (Commit 9e42a30) |
| 6 | 🌬️ **Luftqualität** | Umweltbundesamt (UBA) Open Data | Gesundheitsempfehlung | B | ⏳ |
| 7 | 🗑️ **Abfallkalender** | Kommunale Open-Data-Portale | Sortier-Tipps + Erinnerung | B | ⏳ |
| 8 | 🔌 **E-Ladestationen** | OSM + GoingElectric | Routenplanung | C | ⏳ |
| 9 | 💼 **Job-Suche** | BA (inoffiziell/Community-API) + Adzuna | Job-Matching | D | ⏳ |
| 10 | 📰 **Veranstaltungen** | Wikidata + OSM + Stadtportale | Persönl. Empfehlung | D | ⏳ |
| 11 | 🏨 **Hotels** | OSM + Wikidata (nur Standort-Daten, keine Buchung) | Reise-Budget-Planung | E | ⏳ |
| 12 | 🅿️ **Parken** | OpenStreetMap | — | C | ⏳ |
| 13 | 🏛️ **Bürgeramt** | Kommunale APIs | AI-Terminfindung | E | ⏳ |

### Futai-Integration
Futai ist eine React Native Social-Media-App unter github.com/abatn/futai (KI-Chat, Emotionen, Gedächtnis, Feed).
Integration via **Mini-Program-Container (WebView)** — weil HEIMAT = Flutter ≠ React Native.

### Bau-Phasen
**A: Mini-Program-Container (2-3d) ✅ Live (Commit 92ec307, 2026-07-27)** — Fundament mit 10 Mini-Programmen und WebView-Framework.
B: Wetter (✅ deployed) + Luft/Abfall (3-5d rest) → C: Ladestationen/Parken (2-3d) → D: Futai/Jobs/Events (3-5d) → E: Hotels/Bürgeramt (5-7d) = ~15-20 Tage

## Health AI Agent — Research- & Architektur-Regeln (2026-07-29)

### Regel 1: Keine Pseudowissenschaft
Jede Health-AI-Funktion muss auf **publizierter Forschung** basieren. Keine erfundenen Behauptungen ("2 Wochen vorher erkennen"). Akzeptierte Quellen: Peer-Reviewed Journals, Open-Source-Benchmarks (

TriageBench

), Open-Source-GitHub-Projekte mit >100 Stars.

### Regel 2: Hybrid-Architektur (On-Device + Backend)
| Task | Wo | Begründung |
|------|----|-----------|
| Notfall-Keyword-Erkennung | On-Device (TFLite) | <10ms, 100% offline |
| Symptom-Klassifikation | On-Device (TFLite) | Privacy, keine Latenz |
| Adaptives Gespräch | Backend (Ollama) | Braucht Reasoning (4-8GB Modell) |
| Triage | Backend (Ollama) | Braucht Kontext-Verständnis |
| Arzt-Empfehlung | Backend (Ollama + Overpass) | Braucht API + Reasoning |

### Regel 3: Privacy-by-Design
- **KEINE** Gesundheitsdaten verlassen das Gerät ohne User-Willen
- **KEIN** GPS-Tracking, **KEINE** Kamera, **KEIN** Mikrofon im Hintergrund
- **KEINE** kommerziellen AI-APIs (OpenAI, Google, Ada Health)
- **ON-DEVICE** für sensible Daten, **BACKEND** nur anonymisiert

### Regel 4: Haftungsausschluss (immer einblenden)
> "Keine medizinische Diagnose. Dies ist eine KI-basierte Orientierungshilfe ohne Gewähr. Bei akuten Beschwerden wählen Sie 112 oder den ärztlichen Bereitschaftsdienst 116117."

### Regel 5: Lebenszeichen — Adaptive Check-in
- **KEINE Sensoren** (Accelerometer, GPS, Kamera, Mikrofon)
- **NUR Timer-basiert** (App-Check-in via Chat)
- Eskalationskette: Push → Notfallkontakt → 112
- User muss Check-in **bewusst aktivieren** (Opt-in)
- Bei Gesundheits-Kontext: adaptive Timer-Verkürzung

### Health Triage Integration — Live (2026-08-01)

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

#### Known Issues
- `lat: 0, lng: 0` Hack im Health Context — Triage braucht keine Koordinaten, könnte aber bei zukünftigen Erweiterungen Probleme machen
- Keyword-Drift: `detectHealthSymptom()` in `routes/ai.ts` und `triageRulesService.ts` haben separate Keyword-Listen — könnten auseinanderdriften
- Fehlende medizinische Fine-Tuning-Modelle (Med42-v2, BioMistral) — aktuell nur `qwen2.5:3b` (General Purpose)

### Aktuelle Health AI Endpoints
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/api/ai/chat` | Chat mit Auto-Detect (Symptome → Triage) |
| `GET` | `/api/ai/status` | Ollama-Verbindungsstatus |
| `GET` | `/api/ai/service-prompt` | Service-spezifische Prompts |
| `GET` | `/api/health/doctors` | Overpass-Arztsuche |

---

## HEIMAT Architecture Rules (Phase X, 2026-07-28, Commit b80b07d + 0d7ef3d)

### Mobile Architecture — ServiceRegistry + nativeBuilder (Phase X.1)

**Rule:** KEIN IFrame, KEIN WebView, KEIN `dart:html` im Mobile-Frontend. Externe Webseiten-Einbettung ist verboten (User-Regel: "Hardkodierung und externe Webseiten-Aufrufe sind verboten", project-prompt.md Phase H).

1. **ServiceRegistry-Pattern** — Singleton in `src/mobile/lib/features/miniprogram/domain/service_registry.dart` routet die registrierten Mini-Programme via `nativeBuilder`. Ein Registry-Eintrag beweist nur Routing; nach Version 12.0 erfordert „funktionfähig“ zusätzlich realen Datenpfad, Tests und Production-Check. Tap auf Mini-Program → `NativeMiniProgramScreen._body` lookup't in Registry → echtes Native-Widget oder ehrlicher Placeholder.
2. **NativeMiniProgramScreen** — Einziger Routing-Punkt in `src/mobile/lib/features/miniprogram/presentation/native_mini_program_screen.dart`. KEIN IFrame-Fallback mehr. Defensive "Service unbekannt"-Fallback existiert als letzte Verteidigung.
3. **ComingSoonScreen** — Ehrlicher Status-Placeholder fuer nicht-migrierte Services. Zeigt "Coming Soon"-Badge + User-Regel-Footer ("HEIMAT vermeidet externe Webseiten-Einbettung per User-Regel"). KEIN Mock, KEINE Simulation.
4. **Sentinel-URLs** in `miniProgramProvider.dart`: alle 10 URLs sind `native://registry/<id>` (kein HTTP-Request, nur Registry-Lookup).

### Backend Centralized Config (Phase X.2 — planned)

**Rule:** Hardcoded URLs in Backend-Services sind verboten (User-Regel "NUR BASIEREND AUF EXISTIERENDEN DATEIEN" + "KEINE Erfindung"). Ab Phase X.2 muessen alle externen Service-URLs via `src/backend/src/config/externalServices.ts` (typisierte Config-Singleton) aus env-vars geladen werden.

**Refactor-Liste (hardcoded URLs in Backend-Services):**
- `mobilityService.ts` (3 Overpass-Mirrors + Nominatim + OSRM)
- `weatherService.ts` (Open-Meteo + Bright Sky)
- `airQualityService.ts` (Open-Meteo CAMS)
- `wasteService.ts` (BSR/SRH/AWB iCal URLs)
- `dbVendoService.ts` (transitous.org)
- `talerExchangeClient.ts` (Taler Exchange + Bank)
- `evChargingService.ts` (3 Overpass-Mirrors)

**Pattern:** `private readonly xUrl = 'https://...'` wird zu `externalServices.overpass.xUrl` (oder vergleichbar). AGPL-defensiv: Defaults aus existierendem Code migriert, ueberschreibbar via env-var auf Render.

### Mobile Dynamic Config (Phase X.3 — planned)

**Rule:** Hardcoded BBox-Konstanten in Mobile-Providern sind verboten. Ab Phase X.3 muss `waste_provider.dart` BBox-Konstanten via `GET /api/config/location-defaults` Backend-Endpoint konsumieren (gecached in SharedPreferences). Bei Hinzufuegung einer neuen Stadt: nur Backend-Update, kein Mobile-Rebuild noetig.

### Mock-Policy (verstaerkt nach Phase R)

audit-no-mocks.sh enforced in Backend + Flutter CI (Commit 82047ad). Verboten: `_computeMockLiveStatus`, `fundLocal`, `mockStatus`, `sampleData`, `simulate`, `local://demo`, `StubNaiveBayes*`. Erlaubt: ehrliches Placeholder wie `ComingSoonScreen` (zeigt realen Status, kein Fake-Content).

---

## Health AI Agent — Implementiert (2026-08-03)

> **STATUS:** ✅ Phase 1+2 implementiert und getestet (137 Tests)
> **Skill-Datei:** `.claude/skills/heimat-health-ai.md`

### Architektur

```
Flutter HealthScreenWithTabs (6 Tabs)
  → Backend API (/api/health/*)
      → HealthMemoryService (Gedächtnis)
      → UserMedicationsService (Medikamente + Interaktionen)
      → MentalHealthService (PHQ-9 + Ollama)
      → PreventionService (Vorsorge-Empfehlungen)
      → FollowUpService (Nachsorge)
      → Health Triage (WHO ICD + Rules Engine + Ollama)
```

### Phase 1 Features (✅ Abgeschlossen)

| Feature | Backend | Flutter | Tests |
|---------|---------|---------|-------|
| **Gedächtnis** — Symptom-Verlauf speichern | `healthMemoryService.ts` + `healthMemory.ts` | `health_memory_dto.dart` + `health_memory_provider.dart` + `health_memory_screen.dart` | 14 Integration + 0 Unit |
| **Medikamente** — Verwaltung + Interaktionscheck | `userMedicationsService.ts` + `healthMedications.ts` | `health_medications_dto.dart` + `health_medications_provider.dart` + `medications_screen.dart` | 15 Integration + 0 Unit |

### Phase 2 Features (✅ Abgeschlossen)

| Feature | Backend | Flutter | Tests |
|---------|---------|---------|-------|
| **Mental Health** — PHQ-9 Screening | `mentalHealthService.ts` + `mentalHealth.ts` | `mental_health_dto.dart` + `mental_health_provider.dart` + `mental_health_screen.dart` | 12 Integration + 18 Unit |
| **Prävention** — Vorsorge-Empfehlungen | `preventionService.ts` + `prevention.ts` | `prevention_dto.dart` + `prevention_provider.dart` + `prevention_screen.dart` | 12 Integration + 12 Unit |
| **Nachsorge** — Post-Termin Follow-up | `followUpService.ts` + `followUp.ts` | `followup_dto.dart` + `followup_provider.dart` + `followup_screen.dart` | 10 Integration + 12 Unit |

### API-Endpunkte (15 neue)

#### Mental Health
```
POST   /api/health/mental/phq9           → PHQ-9 Screening (9 Fragen, Score 0-27)
GET    /api/health/mental/phq9/history   → Verlauf laden
GET    /api/health/mental/stats          → Statistiken (Trend, Risk Level)
GET    /api/health/mental/crisis         → Notfall-Kontakte (112, Telefonseelsorge)
GET    /api/health/mental/questions      → PHQ-9 Fragen (Referenz)
```

#### Prävention
```
GET    /api/health/prevention           → Aktive Empfehlungen
POST   /api/health/prevention/generate  → Ollama generiert Empfehlungen
PUT    /api/health/prevention/:id       → Als erledigt markieren
GET    /api/health/prevention/history   → Verlauf
GET    /api/health/prevention/stats     → Statistiken
```

#### Nachsorge
```
GET    /api/health/followups              → Offene Follow-ups
POST   /api/health/followups/:id/respond  → User antwortet
GET    /api/health/followups/history      → Verlauf
GET    /api/health/followups/stats        → Statistiken
POST   /api/health/followups/check        → Cron-Job (Admin)
```

### Datenbank (4 neue Tabellen)

```sql
health_memory          -- Symptom-Verlauf (Gedächtnis)
user_medications       -- Medikamente des Users
phq9_responses         -- PHQ-9 Screening-Ergebnisse
prevention_recommendations  -- Vorsorge-Empfehlungen
post_appointment_followups  -- Nachsorge Follow-ups
```

### Flutter Integration

- **HealthScreenWithTabs** — Ersetzt HealthScreen als Haupt-Screen mit 6 Tabs
- **isEmbedded-Parameter** — Alle Phase-2-Screens unterstützen eingebettete Darstellung
- **Provider-Registrierung** — 5 neue Provider in main.dart

### Offene Tasks

| Task | Priorität |
|------|-----------|
| Voice-Input (Spracheingabe) | 🟡 Phase 3 |
| Foto-Analyse (Hautausschlag) | 🟡 Phase 3 |
| Erweiterte Differentialdiagnose | 🟡 Phase 3 |

---

## Additional instruction files

- `.claude/CLAUDE.md` – detailed Claude-specific instructions (same rules, more verbose)
- `.claude/skills/heimat-health-ai.md` – Health AI Agent Architektur (Diskussionsphase)
- `.opencode/skills/heimat-dev/SKILL.md` – OpenCode skill (loaded automatically for HEIMAT tasks)
