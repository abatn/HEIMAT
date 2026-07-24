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

**Known CI failure:** `health.test.ts` has a pre-existing failure (1/7 suites) – likely DB cleanup ordering.

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
- **Taler** is a real GNU Taler exchange client (`exchange.demo.taler.net`, KUDOS currency, Ed25519 wallets).

## Known bugs

| Symptom | Cause | Fix |
|---------|-------|-----|
| `'toDouble' Dynamic call of null` on latitude/longitude | Postgres DECIMAL → Node pg passes string → Flutter `.toDouble()` on null | `double.parse(json['latitude'].toString())` in providers |
| "Haltestellen konnten nicht geladen werden" | Helmet CORS blocks API | Index.ts has permissive helmet config |
| `GET /stops/search` returns 500 "invalid input syntax for type uuid" | Express matches `/stops/search` as `/stops/:id` with `id="search"` | Define `/stops/search` before `/stops/:id` in `mobility.ts` |
| Journey search empty | Frontend sends `?from=lat,lng`, backend expects `?from_lat=&from_lng=` | Fix query params in `mobility_provider.dart` |
| db-rest health check passes but endpoints return empty | Docker image default `ENV PORT 3000`, Render routes to port 3001 | Set `ENV PORT=3000` in Dockerfile or adjust render.yaml |

## Clarifications (Juli 2026)

### GTFS ZIP import: NOT a rule violation
The GTFS zip import (`gtfs.de/nv_free`) does NOT violate any project rules. CC-BY licensed, explicitly allowed in `project-prompt.md:59` and `heimat-plan.md:392`.

### Doctors: REAL Overpass results
The 5 doctors shown on the health page are real Overpass API results for Berlin, NOT hardcoded data. `schema.sql:370`: "Keine Seed-Daten".

### Finance: Demo user IS a real problem
`finance_provider.dart:45` has `user-demo-001` hardcoded. Backend JWT auth is complete (14 tests), but mobile code doesn't use it. **Highest priority task.**

## Additional instruction files

- `.claude/CLAUDE.md` – detailed Claude-specific instructions (same rules, more verbose)
- `.opencode/skills/heimat-dev/SKILL.md` – OpenCode skill (loaded automatically for HEIMAT tasks)
