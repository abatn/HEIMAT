# AGENTS.md

HEIMAT 2.0 – open-source "super app" (German docs/UI). Three services under `src/`:
- `src/mobile/` – Flutter app (map/ÖPNV, Taler payments, doctor appointments)
- `src/backend/` – Node 18+ / TypeScript Express API (port 3000)
- `src/ml-service/` – Python FastAPI (port 8000, Docker only)

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
- **Supabase + Render must be operational** – they are the only testing/deployment environment.
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
| "Haltestellen konnten nicht geladen werden" | Helmet CORS blocks API | Index.ts has permissive helmet config |
| `GET /stops/search` returns 500 "invalid input syntax for type uuid" | Express matches `/stops/search` as `/stops/:id` with `id="search"` | Define `/stops/search` before `/stops/:id` in `mobility.ts` |
| Journey search empty | Frontend sends `?from=lat,lng`, backend expects `?from_lat=&from_lng=` | Fix query params in `mobility_provider.dart` |
| db-rest health check passes but endpoints return empty | Docker image default `ENV PORT 3000`, Render routes to port 3001 | Set `ENV PORT=3000` in Dockerfile or adjust render.yaml |
| Login "stuck on LoginScreen" with valid credentials | LoginScreen/RegisterScreen didn't react to `isAuthenticated` because Hash-Routing on `/#/login` or `/#/register` mounts the screens directly via `routes` table, bypassing `AuthGate` mounted at `'/'` | Explicit `Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false)` (with `!mounted` early-exit) after successful login/register. Files: `src/mobile/lib/features/auth/presentation/{login,register}_screen.dart`. Fix committed `9c8deb7` (2026-07-25) |

## Clarifications (Juli 2026)

### GTFS ZIP import: NOT a rule violation
The GTFS zip import (`gtfs.de/nv_free`) does NOT violate any project rules. CC-BY licensed, explicitly allowed in `project-prompt.md:59` and `heimat-plan.md:392`.

### Doctors: REAL Overpass results
The 5 doctors shown on the health page are real Overpass API results for Berlin, NOT hardcoded data. `schema.sql:370`: "Keine Seed-Daten".

### Finance: Demo user status (Juli 2026)
`finance_provider.dart:45` still hardcodes `user-demo-001`. **Backend JWT-Auth is live on Production since 2026-07-25** (`/api/auth/{register,login,me}` end-to-end against `heimat-backend.onrender.com`). Mobile-Finance-Integration (Provider + Headers + Screen) is the remaining track.

**Update 2026-07-25 (Commits cfb0561 + e00105d):** Finance-Roundtrip ist nun end-to-end live: `_authService.authHeaders` schickt Bearer-Token in alle 5 Finance-Calls, URL-Pfade ohne `/$userId`-Suffix (Backend leitet User aus Token ab), `GET /api/finance/wallet`-Route neu im Backend, `wallet_priv` Legacy-Spalte per Schema-Migration gedroppt.

### Phase 23: Roundtrip ✅ Live (2026-07-25)
Finance-JWT-Integration abgeschlossen. ADMIN_KEY auf Render gesetzt. preDeployCommand (auto) + `/api/admin/migrate` (manual) beide grün am 2026-07-25. security.test.ts Regression-Lock aktiv (Commit 3414aea).

Wichtige Commits (in Reihenfolge):
- `cfb0561` — Mobile `finance_provider.dart`: Bearer-Header in allen 5 Finance-HTTP-Calls.
- `e00105d` — Mobile URL-Pfade bereinigt (kein `/$userId` Suffix); Backend identifiziert User aus Bearer-Token; neue `GET /api/finance/wallet` Route; Schema-Migration `DROP COLUMN IF EXISTS wallet_priv`.
- `25ac7ab` — Security-Fix: ungeschützten `POST /api/migrate` Endpoint entfernt (jeder konnte DB-Schema mutieren).
- `3414aea` — Regression-Lock: `src/backend/src/__tests__/security.test.ts` verriegelt dass POST /api/migrate 404 retourniert (Body-Lock verhindert subtile Refactors).
- `e7fcd85` — Auto-Migration: `src/backend/src/scripts/migrate.ts` (Node.js Schema-Applier mit Password-Redaction) läuft im `render.yaml` `preDeployCommand`. Atomar (fail → Render aborted Deploy).

**Verifikation auf Render:** POST `/api/admin/migrate` mit `X-Admin-Key` Header retourniert HTTP 200 `{"success":true,"message":"Schema migrated"}` in ~213ms (Supavisor-Pooler + Postgres-Ack).

### Auth-Track live on Production (Juli 2026)
- **Backend**: `/api/auth/{register, login, me}/...` is end-to-end live on `heimat-backend.onrender.com`. Smoke-test user `heimat-demo-user@heimat.de / DemoHeimat2026!` is in the Supabase production-DB (2026-07-25).
- **Mobile**: `AuthProvider` + `AuthService` + `LoginScreen`/`RegisterScreen` + `AuthGate` (in `main.dart`) orchestrate the JWT roundtrip. `SharedPreferences` persists the token. The MainScreen AppBar carries a `⋮`-PopupMenu with Logout (Commit `1090203`).
- **Auth-Routing-Bug fixed** (Commit `9c8deb7`): deep links to `/#/login` or `/#/register` now take the user to MainScreen after successful auth. Hash-Routing on a non-root route bypasses AuthGate, so `isAuthenticated` listener was missing — explicit `Navigator.pushNamedAndRemoveUntil('/', (route) => false)` was added in `login_screen.dart` and `register_screen.dart`.
- **Render + Supabase connection** (`render.yaml`): now using **Supavisor pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`), `DB_SSL=true`, Node 20, devDeps-pruned. Supavisor pools Render Free Tier (IPv4) traffic to the Supabase IPv6-only DB column endpoint.

## Phase 23 Recap — Stand Juli 2026

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
- **AI-Home Dashboard (Commit 0308bfaa)**: Personalisierter AI-Startseiten-Tab mit Tageszeit-basierten Vorschlaegen + Greeting-Card + Nearby-Stops
- **Dashboard-Navigation (Commits bd04e2b + 4fcb0ac)**: Quick Actions, Stat-Karten (Haltestellen/Ärzte/KUDOS) und AI-Vorschläge navigieren jetzt per onNavigateTab-Callback zum richtigen Tab. CI grün, Deployed ✅
- **Phase B: Wetter-Mini-Programm (Commit 9e42a30)**: weatherService.ts (Open-Meteo DWD-Client), weather.ts (3 Endpoints), weather.html (Standalone HTML-Seite mit Geolocation + 24h + 7-Tage). 429-Retry mit exponentiellem Backoff fix deployed ✅
- **Quick-Actions-Flicker-Fix (Commit 8aad85f)**: Root Cause: getPersonalizedContext() überschrieb Quick Actions mit intent-spezifischen 2-Button-Sets („Störungen/Alternativ", „Abfahrten/Echtzeit"). Fix: Nur Suggestions werden personalisiert, Quick Actions bleiben immer die 4 Standard-Buttons. Dead Code (intentQuickActions, 25 Zeilen) entfernt. ✅
- **Funded-Wallet-Pfad (Phase R, 2026-07-27)**: Wallet-Balance bleibt 0.00 KUDOS bis ein EUR-Production-Exchange (oder bank.demo.taler.net) Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. fundLocal Mock-Endpoint liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" + `_computeMockLiveStatus` entfernt (Commit 7718333). User-Regel (AGENTS.md:143 + knowledge.md:283): "mock, simulation, fake sind verboten" — enforced via audit-no-mocks.sh in CI (Commit 82047ad).
- **Backend CI**: Lint + Jest + tsc grün
- **Swagger UI**: /docs + /docs.json live
- **Mobilität + Gesundheit**: seit MVP grün

- **Phase E Wetter Real-Fix ✅ (2026-07-27, Commit 99daa9c)**: Render Free-Tier 429-Rate-Limit auf Open-Meteo behoben via Mirror-Fallback-Pattern. Open-Meteo primary (reduziert 2× Retry) + Bright Sky DWD-Proxy (`api.brightsky.dev`) als fallback. Architektur-Spiegel von mobilityService.ts Overpass-Mirror-List. **WICHTIG: keine Mocks/Simulations** (per User-Regel "mock, simulation, fake sind verboten") — alle HTTP-Calls gegen reale Upstream-APIs. Constructor-DI für Test-Seam. 10/10 Tests grün (jest). Live: Berlin 21.1°C, Klarer Himmel, 28.1 km/h Wind via `heimat-backend.onrender.com/api/weather/forecast`. Mobile DTO erhalten → kein Flutter-Rebuild.

### ⚠️ Was ist offen
- **Wallet-Balance bleibt 0.00 KUDOS bis EUR-Exchange-Live (Phase R geschlossen, 2026-07-27)**: Demo-Mock-Bypass fundLocal entfernt (per User-Regel). Wallet wird via echten Reserve-Adresse-Bank-Wire gefuellt (bank.demo.taler.net heute, EUR-Production-Exchange wartet auf oeffentliche GLS-Bank-Integration). Demo-Option (a) im Finanzen-Tab-Bottom-Sheet entfernt. EUR-Production-Exchange bleibt der einzige offene Block.
- **migrate.ts Unit-Test ✅ (Commit 06dc2e3)** — 18 Tests, alle gruen (success path, pool throws, redactConnectionSecrets edge cases, schema fehlt, lesefehler, exception-safety)

**📱 Taler aus der App — So funktioniert es fuer den User (Phase R, 2026-07-27):**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> nur echter Reserve-Adresse-Weg: Bank-Wire von bank.demo.taler.net (oder zukuenftiger EUR-Production-Exchange) auf Reserve-Adresse bucht Taler-Guthaben -> [Aktualisieren] -> Balance zeigt Live-Wert. Demo-KUDOS-Option "25 Demo-KUDOS erhalten" wurde komplett entfernt (kein Mock, kein Mock-Bypass, kein "Schneller Test-Wert"-Button). P2P-Send an registrierte HEIMAT-User funktioniert nach erfolgreichem Bank-Wire.

**⚠️ Option B (Bank-API automatisieren) bleibt Dead End (2026-07-27):** Die Taler-Demo-Bank hat nur Lese-API-Endpoints (`GET /accounts/{username}`, `GET /accounts/{username}/transactions`, `POST /accounts/{username}/token`) + `POST /admin/add-incoming` (Admin-Login noetig). KEIN user-autorisierter REST-Endpoint fuer Wire-Transfer. Phase-R-Entscheidung: Mock-Bypass fundLocal wurde deshalb KOMPLETT entfernt (Commit 2d3ae18) statt ihn durch Bank-API zu ersetzen. User fuehrt Bank-Wire manuell aus (Reserve-Adresse -> Button "Aktualisieren").

### ❌ Was fehlt
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

## HEIMAT Architecture Rules (Phase X, 2026-07-28, Commit b80b07d + 0d7ef3d)

### Mobile Architecture — ServiceRegistry + nativeBuilder (Phase X.1)

**Rule:** KEIN IFrame, KEIN WebView, KEIN `dart:html` im Mobile-Frontend. Externe Webseiten-Einbettung ist verboten (User-Regel: "Hardkodierung und externe Webseiten-Aufrufe sind verboten", project-prompt.md Phase H).

1. **ServiceRegistry-Pattern** — Singleton in `src/mobile/lib/features/miniprogram/domain/service_registry.dart` routet alle 10 Mini-Programme (weather, air, waste, mobility, finance, health, events, jobs, hotels, buergeramt) via `nativeBuilder`. Tap auf Mini-Program → `NativeMiniProgramScreen._body` lookup't in Registry → entweder echtes Native-Widget (z.B. `WeatherScreen`) oder `ComingSoonScreen` als ehrlicher Placeholder.
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

## Additional instruction files

- `.claude/CLAUDE.md` – detailed Claude-specific instructions (same rules, more verbose)
- `.opencode/skills/heimat-dev/SKILL.md` – OpenCode skill (loaded automatically for HEIMAT tasks)
