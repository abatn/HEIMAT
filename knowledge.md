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
- **Demo-KUDOS fund-local (2026-07-26)**: "25 Demo-KUDOS erhalten" Button im Finanzen-Tab via POST /api/finance/taler/fund-local — 25 KUDOS direkt in DB, kein Exchange noetig. P2P-Purse-System bereit (createPurse/depositToPurse/mergePurse).
- Backend CI: Lint + Jest (113+ Tests) + tsc --noEmit — alle grün auf `main`
- Mobile CI: dart format + flutter analyze + flutter test — alle grün
- Swagger/OpenAPI: /docs + /docs.json live
- Mobilität (Überpass/Nominatim/OSRM/transitous) und Gesundheit (Ärzte+Termine) seit MVP grün

### ⚠️ Was ist offen
- **Phase 24: Demo-KUDOS und P2P-Durchstich ✅ Live (2026-07-26)** — Finanzen-Tab: "Guthaben aufladen" Button zeigt jetzt zwei Optionen: (a) "25 Demo-KUDOS erhalten" (POST /api/finance/taler/fund-local, direkt in DB, kein Exchange nötig) und (b) "Reserve-Adresse erstellen" (alter Flow fuer echten Taler-Bank-Wire). P2P-Purse-System (createPurse/depositToPurse/mergePurse) arbeitet korrekt mit lokaler Demo-Balance. EUR-Exchange wartet auf oeffentliche GLS-Bank-Integration.
- **migrate.ts Unit-Test ✅ (Commit 06dc2e3)** — 18 Tests, alle gruen (success path, pool throws, redactConnectionSecrets edge cases, schema fehlt, lesefehler, exception-safety)
- `scripts/stale-doc-prescan.sh` ist seit Phase 23-Fix nicht mehr im preDeploy-Workflow eingebunden (war Nice-to-have, jetzt deaktiviert)

**📱 Taler aus der App — User-Guide:**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> Zwei Optionen: (1) "25 Demo-KUDOS erhalten" -> Balance sofort auf 25.00 KUDOS -> Geld senden testen. (2) "Reserve-Adresse erstellen" -> reserve_pub wird erzeugt -> bank.demo.taler.net -> ueberweisen -> zurueck -> [Aktualisieren]. Demo-KUDOS sind HEIMAT-intern (kein Exchange), Reserve-Workflow ist echter Taler.

### ❌ Was fehlt
- Flutter Integration-Tests (kein Code vorhanden — Login → Finance → Logout Flow nicht durch UI getestet)
- Auth-Routing-Bug Regression-Test in `auth_screens_test.dart` (Hash-Routing-Pattern mit `Navigator.pushNamedAndRemoveUntil('/', …)`) — kein Pre-Commit-Test
- Auto-Migration health-check Tool — kein `npm run migrate:status` für CI-Inspektion „ist DB-Schema aktuell?"



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
