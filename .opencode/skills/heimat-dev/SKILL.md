---
name: heimat-dev
description: "Development helper for the HEIMAT 2.0 project. Use when working on HEIMAT code — running tests, formatting, debugging known bugs, or making changes to src/mobile/, src/backend/, or src/ml-service/. Covers Flutter (vendored SDK at src/mobile/flutter/bin/), Node.js backend (src/backend/), Docker compose, CI gates, and the project's specific conventions (German commits, no git add -A, Conventional Commits). Trigger on mentions of HEIMAT, oepnv, mobility, db-rest, taler, flutter test, backend test, or any src/mobile or src/backend file edit."
---

# HEIMAT Development Skill

Working knowledge for the HEIMAT 2.0 open-source super app (Flutter + Node.js + Python ML, German UI).

## Critical Rules (never violate)

1. **Never `git add -A` or `git add .` from repo root.** Stage files explicitly — `src/mobile/flutter/`, `src/mobile/android/`, `src/mobile/ios/`, `.mimocode/` are untracked junk.
2. **Use vendored Flutter SDK** — `src/mobile/flutter/bin/flutter` and `src/mobile/flutter/bin/dart`. `flutter`/`dart`/`node` are NOT on PATH.
3. **Conventional Commits, lowercase, German** — e.g. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`
4. **No `analysis_options.yaml`** in `src/mobile` — analyzer runs with defaults.

## Commands Quick Reference

### Flutter (run in `src/mobile/`)

```bash
# Format (MUST run before every commit touching Dart — CI enforces this)
src/mobile/flutter/bin/dart format lib/ test/

# Analyze
src/mobile/flutter/bin/flutter analyze --no-fatal-infos

# Tests
src/mobile/flutter/bin/flutter test

# Single test
src/mobile/flutter/bin/flutter test test/widget_test.dart

# Pub get
src/mobile/flutter/bin/flutter pub get
```

### Backend (run in `src/backend/`)

```bash
# Lint
npm run lint

# Tests (needs Postgres — CI uses heimat_test DB)
npm test

# Single test
npx jest src/__tests__/mobility.test.ts

# Typecheck
npx tsc --noEmit
```

## CI Gates

| Service | Order | Common Failure |
|---------|-------|----------------|
| Flutter | `dart format` → analyze → test | Unformatted Dart (most common!) |
| Backend | lint → test → `tsc --noEmit` | Missing types |
| Deploy | Push `src/mobile/**` to `main` → GitHub Pages web build | — |

## Known Bugs & Fixes

### DECIMAL-to-double crash (PostgreSQL → Flutter)

**Symptom:** `NoSuchMethodError: 'toDouble' Dynamic call of null. Receiver: "52.52190000"`

**Cause:** PostgreSQL returns DECIMAL as strings → Node.js pg passes strings → Flutter calls `.toDouble()` on null.

**Fix in Flutter providers:**
```dart
double.parse(json['latitude'].toString())
```

Files: `mobility_provider.dart`, `finance_provider.dart`, `health_provider.dart`

### CORS/helmet blocking API responses

**Symptom:** "Haltestellen konnten nicht geladen werden"

**Fix in `src/backend/src/index.ts`:**
```typescript
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
```

### Route conflict: `/stops/search` vs `/stops/:id`

**Symptom:** `GET /stops/search` returns 500 "invalid input syntax for type uuid"

**Cause:** Express matches `/stops/search` as `/stops/:id` with `id="search"`.

**Fix in `mobility.ts`:** Define `/stops/search` BEFORE `/stops/:id`.

### Journey parameter mismatch

**Symptom:** Journey search always returns empty.

**Cause:** Frontend sends `?from=lat,lng&to=lat,lng`, backend expects `?from_lat=&from_lng=&to_lat=&to_lng=`.

**Fix in `mobility_provider.dart`:** Change query params to match backend.

### db-rest port mismatch (Render deployment)

**Symptom:** db-rest health check passes but all endpoints return empty/404.

**Cause:** Docker image default `ENV PORT 3000`, Render routes to port 3001.

**Fix:** Set `ENV PORT=3000` in Dockerfile or adjust render.yaml.

## Klärungen (Juli 2026)

### GTFS ZIP-Import: KEIN Regelverstoß
Der GTFS-Zip-Import (`gtfs.de/nv_free`) verstößt gegen KEINE Projektdaten. CC-BY lizenziert, explizit erlaubt in `project-prompt.md:59`.

### Ärzte: ECHTE Overpass-Ergebnisse
Die 5 Ärzte auf der Gesundheitsseite sind echte Overpass-API-Ergebnisse für Berlin, keine hardcodierten Daten.

### Finanzen: JWT-Roundtrip + Demo-KUDOS + P2P (Phase 23-24)
**Phase 23 (2026-07-25):** `finance_provider.dart` schickt Bearer-Token via `_authService.authHeaders` in allen 5 Finance-HTTP-Calls. URL-Pfade ohne `/$userId`-Suffix. Roundtrip end-to-end live.

**Phase 24 Demo-KUDOS (2026-07-26):** "25 Demo-KUDOS erhalten" Button via `POST /api/finance/taler/fund-local` — schreibt 25 KUDOS direkt in die DB, kein Exchange-Kontakt. `exchange_reserve_pub` wird auf NULL gesetzt, damit `getBalance()` die lokale Demo-Balance korrekt erkennt. Commits: `02dae6e`, `471079c`, `968aac2`.

**P2P-Purse:** `createPurse()` / `depositToPurse()` / `mergePurse()` — HEIMAT-interner P2P-Transfer, kein Taler-Exchange. Wird vom `/pay`-Endpoint orchestriert.

**P2P-Bugfix (Commit 54f1019):** POST /api/finance/pay: `to`-Parameter kann jetzt Email ODER userId. Vorher wurde die Email nicht aufgeloest — `createPurse()` suchte Wallet mit `user_id = email` statt `user_id = resolved_from_email`, Geld landete in Phantom-Wallet. Fix: `SELECT id FROM users WHERE email = $1` vor `createPurse()`.

### Security-Härtung (Phase 23)
- `POST /api/migrate` wurde entfernt (war ungeschützt)
- `security.test.ts` Regression-Lock: POST /api/migrate → 404
- `AUTO_MIGRATE=true` startup-hook wendet `schema.sql` bei jedem Deploy an
- `ADMIN_KEY` auf Render-Dashboard gesetzt für `/api/admin/migrate`
- `src/backend/src/__tests__/migrate.test.ts`: 18 Unit-Tests (gemockter pg pool) — alle gruen ✅ (Commit 06dc2e3)
- `src/backend/src/__tests__/health.test.ts`: 16 Tests, HAS_DB-Guards + breitere catch-Patterns für CI-Resilienz (Commit 6b7c7f5)

## Conventions

- Service URLs from `--dart-define`: `BACKEND_URL=https://heimat-backend.onrender.com`
- See `src/mobile/lib/core/config/app_config.dart`
- GTFS import via `src/backend/scripts/import-gtfs-local.ts` (not on Render)
- Root `*.md` files are planning/marketing docs, not code documentation
- Schema source: `src/database/schema.sql` (CI loads via `psql`)

## File Map

```
src/mobile/           # Flutter app
  lib/                # Dart source
  test/               # Widget + Integration tests
    auth_finance_logout_test.dart  # Integration-Test: Login -> Finance -> Logout (Commit a0dbfc5)
  flutter/bin/        # Vendored Flutter SDK (DO NOT EDIT)
src/backend/          # Node.js Express API
  src/__tests__/      # Jest tests
    migrate.test.ts   # 18 Unit-Tests (gemockter pg pool)
    health.test.ts    # 16 Tests, CI-resilient
src/ml-service/       # Python FastAPI (Docker only)
scripts/              # GTFS import, utilities
```
