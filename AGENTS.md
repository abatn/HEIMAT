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
- **CI-Fix**: `unnecessary_null_comparison` lint durch `// ignore:` geloest, `dart format` auf beide Screens angewandt — Flutter CI stabil gruen
- **Demo-KUDOS fund-local (2026-07-26)**: "25 Demo-KUDOS erhalten" Button ruft POST /api/finance/taler/fund-local auf — 25 KUDOS direkt in DB, kein Exchange noetig. P2P-Purse-System bereit.
- **Backend CI**: Lint + Jest + tsc grün
- **Swagger UI**: /docs + /docs.json live
- **Mobilität + Gesundheit**: seit MVP grün

### ⚠️ Was ist offen
- **Phase 24: Demo-KUDOS und P2P-Durchstich ✅ Live (2026-07-26)** — Finanzen-Tab: "Guthaben aufladen" Button zeigt zwei Optionen: (a) "25 Demo-KUDOS erhalten" (POST /api/finance/taler/fund-local, direkt in DB) und (b) "Reserve-Adresse erstellen" (alter Flow fuer echten Taler-Bank-Wire). P2P-Purse-System (createPurse/depositToPurse/mergePurse) arbeitet korrekt mit lokaler Demo-Balance. EUR-Exchange wartet auf oeffentliche GLS-Bank-Integration.
- **migrate.ts Unit-Test ✅ (Commit 06dc2e3)** — 18 Tests, alle gruen (success path, pool throws, redactConnectionSecrets edge cases, schema fehlt, lesefehler, exception-safety)

**📱 Taler aus der App — So funktioniert es fuer den User:**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> Zwei Optionen: (1) "25 Demo-KUDOS erhalten" -> Balance sofort 25.00 KUDOS -> Geld senden testen. (2) "Reserve-Adresse erstellen" -> reserve_pub wird erzeugt -> bank.demo.taler.net -> ueberweisen -> zurueck -> [Aktualisieren]. Demo-KUDOS sind HEIMAT-intern (kein Exchange), Reserve-Workflow ist echter Taler.

**⚠️ Option B (Bank-API automatisieren) ist ein Dead End (2026-07-26):** Die Taler-Demo-Bank hat nur Lese-API-Endpoints (`GET /accounts/{username}`, `GET /accounts/{username}/transactions`, `POST /accounts/{username}/token`). KEIN REST-Endpoint fuer Wire-Transfer. Automatisierung via `POST /admin/add-incoming` benoetigt Admin-Login. Demo-KUDOS via `/api/finance/taler/fund-local` bleibt der einzig praktikable Weg.

### ❌ Was fehlt
- **auth_gate_test.dart (Commit 6274675)** — neue Testdatei, 1 Test (AuthGate→LoginScreen bei unauth), CI-grün ✅. Schritt 1/5 des inkrementellen Wiederaufbaus.
- Flutter Integration-Tests fehlen noch für Login → Finance → Logout Flow
- Auth-Routing-Bug Regression-Test in mobile tests
- Auto-Migration health-check (`npm run migrate:status`)

## HEIMAT Expansion Plan (Phase 25-26) — Juli 2026

### Von 3 auf 10+ Services — wie WeChat/Grab, aber Open Source

| # | Service | Datenquelle | AI | Status |
|---|---------|------------|-----|--------|
| 4 | 💬 **Chat/Social** | Futai (github.com/abatn/futai) integrieren via Mini-Program | Ollama Twin | ⏳ Phase D |
| 5 | 🌤️ **Wetter** | DWD (Deutscher Wetterdienst) CC-BY | Unwetter-Früherkennung | ⏳ Phase B |
| 6 | 🌬️ **Luftqualität** | Umweltbundesamt (UBA) Open Data | Gesundheitsempfehlung | ⏳ Phase B |
| 7 | 🗑️ **Abfallkalender** | Kommunale Open-Data-Portale | Sortier-Tipps + Erinnerung | ⏳ Phase B |
| 8 | 🔌 **E-Ladestationen** | OSM + GoingElectric | Routenplanung | ⏳ Phase C |
| 9 | 💼 **Job-Suche** | BA (inoffiziell/Community-API) + Adzuna | Job-Matching | ⏳ Phase D |
| 10 | 📰 **Veranstaltungen** | Wikidata + OSM + Stadtportale | Persönl. Empfehlung | ⏳ Phase D |
| 11 | 🏨 **Hotels** | OSM + Wikidata (nur Standort-Daten, keine Buchung) | Reise-Budget-Planung | ⏳ Phase E |
| 12 | 🅿️ **Parken** | OpenStreetMap | — | ⏳ Phase C |
| 13 | 🏛️ **Bürgeramt** | Kommunale APIs | AI-Terminfindung | ⏳ Phase E |

### Futai-Integration
Futai ist eine React Native Social-Media-App unter github.com/abatn/futai (KI-Chat, Emotionen, Gedächtnis, Feed).
Integration via **Mini-Program-Container (WebView)** — weil HEIMAT = Flutter ≠ React Native.

### Bau-Phasen
A: Mini-Program-Container (2-3d) → B: Wetter/Luft/Abfall (3-5d) → C: E-Ladestationen/Parken (2-3d) → D: Futai/Jobs/Events (3-5d) → E: Hotels/Bürgeramt (5-7d) = ~15-20 Tage

## Additional instruction files

- `.claude/CLAUDE.md` – detailed Claude-specific instructions (same rules, more verbose)
- `.opencode/skills/heimat-dev/SKILL.md` – OpenCode skill (loaded automatically for HEIMAT tasks)
