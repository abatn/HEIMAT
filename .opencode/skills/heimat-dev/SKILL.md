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
# Dev server
npm run dev

# Lint
npm run lint

# Tests (needs Postgres — CI uses heimat_test DB)
npm test

# Single test
npx jest src/__tests__/mobility.test.ts

# Typecheck (no npm script — CI runs this)
npx tsc --noEmit
```

### Docker

```bash
# Full stack (Postgres 15, Redis 7, backend, ml-service)
docker-compose up
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

## Conventions

- Service URLs from `--dart-define`: `BACKEND_URL` / `ML_SERVICE_URL` (defaults `http://localhost:3000` / `:8000`)
- See `src/mobile/lib/core/config/app_config.dart`
- GTFS import runs locally (`scripts/import-gtfs-local.ts`), not on Render
- Root `*.md` files are planning/marketing docs, not code documentation
- Schema source: `src/database/schema.sql` (CI loads via `psql`)

## File Map

```
src/mobile/           # Flutter app
  lib/                # Dart source
  test/               # Widget tests
  flutter/bin/        # Vendored Flutter SDK (DO NOT EDIT)
src/backend/          # Node.js Express API
  src/__tests__/      # Jest tests
src/ml-service/       # Python FastAPI (Docker only)
scripts/              # GTFS import, utilities
```
