# AGENTS.md

HEIMAT 2.0 – open-source "super app" (German docs/UI). Three services under `src/`:
- `src/mobile/` – Flutter app (map/ÖPNV, Taler payments, doctor appointments)
- `src/backend/` – Node 18+ / TypeScript Express API (port 3000)
- `src/ml-service/` – Python FastAPI (port 8000, Docker only)

`docker-compose up` wires all of it plus Postgres 15, Redis 7, and `derhuerst/db-rest:6` (Deutsche Bahn API proxy).

## Critical: untracked junk in the working tree

- `src/mobile/flutter/` is a **full vendored Flutter SDK checkout** (3.24.5). Untracked, not gitignored. Never edit, search, or `git add` anything under it.
- Also untracked and not ignored: `src/mobile/android/`, `src/mobile/ios/`, `src/mobile/mobile.iml`, `.mimocode/`. CI regenerates android/ios via `flutter create . --platforms ...`.
- **Never `git add -A` / `git add .` from the repo root.** Stage files explicitly.

## Toolchain

- `flutter`, `dart`, `node` are **not on PATH**. Use: `src/mobile/flutter/bin/flutter` and `src/mobile/flutter/bin/dart`.
- Backend needs Node 18+ (install separately).

## Commands

### Backend (run in `src/backend/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (ts-node-dev, auto-restart) |
| `npm run lint` | ESLint |
| `npm test` | Jest (`--coverage --forceExit`, needs Postgres) |
| `npx jest src/__tests__/mobility.test.ts` | Single test |
| `npx tsc --noEmit` | Typecheck (CI only, no npm script) |
| `npm run import:gtfs` | Local GTFS import |

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

### Docker

```bash
docker-compose up   # Full stack (5 services)
```

## CI gates (`.github/workflows/`)

| Workflow | Order | Common CI failure |
|----------|-------|-------------------|
| `flutter.yml` | `dart format` → analyze → test (+ smoke in parallel) → build-web + build-android | Unformatted Dart |
| `backend.yml` | lint → test (needs Postgres) → `tsc --noEmit` | Missing types |
| `deploy-web.yml` | Push `src/mobile/**` to `main` → full CI → `flutter build web --release --base-href "/HEIMAT/"` → GitHub Pages | – |

Dependabot patches are auto-approved and auto-merged via `dependabot-auto-merge.yml`.

## Conventions

- **Conventional Commits, lowercase, German descriptions** – e.g. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`
- **Service URLs** from `--dart-define BACKEND_URL` / `--dart-define ML_SERVICE_URL`. Defaults: `BACKEND_URL=https://heimat-backend.onrender.com`, `ML_SERVICE_URL=http://localhost:8000`. See `src/mobile/lib/core/config/app_config.dart`.
- **GTFS import** runs locally (`src/backend/scripts/import-gtfs-local.ts`), not on Render (free-tier memory/timeout).
- **Root `*.md` files** (`AI-*.md`, `heimat-plan.md`, `.loop.md`, `blog/`, `funding/`, `marketing/`) are planning/marketing docs, not code documentation.
- **Admin endpoints** require `ADMIN_KEY` env var (no static fallback).
- **Taler** is a real GNU Taler exchange client (`exchange.demo.taler.net`, KUDOS currency, Ed25519 wallets).

## Known bugs

| Symptom | Cause | Fix |
|---------|-------|-----|
| `'toDouble' Dynamic call of null` on latitude/longitude | Postgres DECIMAL → Node pg passes string → Flutter `.toDouble()` on null | `double.parse(json['latitude'].toString())` in providers |
| "Haltestellen konnten nicht geladen werden" | Helmet CORS blocks API | Index.ts has permissive helmet config |
| `GET /stops/search` returns 500 "invalid input syntax for type uuid" | Express matches `/stops/search` as `/stops/:id` with `id="search"` | Define `/stops/search` before `/stops/:id` in `mobility.ts` |
| Journey search empty | Frontend sends `?from=lat,lng`, backend expects `?from_lat=&from_lng=` | Fix query params in `mobility_provider.dart` |

## Additional instruction files

- `.claude/CLAUDE.md` – detailed Claude-specific instructions (same rules, more verbose)
- `.opencode/skills/heimat-dev/SKILL.md` – OpenCode skill (loaded automatically for HEIMAT tasks)
