# AGENTS.md

HEIMAT 2.0 – open-source "super app" (German docs/UI). Three services under `src/`:
- `src/mobile/` – Flutter app (map/ÖPNV, Taler payments, doctor appointments)
- `src/backend/` – Node 18+ / TypeScript Express API (port 3000)
- `src/ml-service/` – Python FastAPI (port 8000, Docker only)

`docker-compose up` wires all of it plus Postgres 15 and Redis 7.

## Critical: untracked junk in the working tree

- `src/mobile/flutter/` is a **full vendored Flutter SDK checkout** (3.24.5). It is untracked and NOT gitignored. Never edit, search, or `git add` anything under it.
- Also untracked and not ignored: `src/mobile/android/`, `src/mobile/ios/`, `src/mobile/mobile.iml`, `.mimocode/`. CI regenerates android/ios via `flutter create . --platforms ...`.
- Therefore: **never `git add -A` / `git add .` from the repo root.** Stage files explicitly.

## Toolchain quirks (local machine)

- `flutter`, `dart`, `node` are NOT on PATH. Use the vendored SDK:
  `src/mobile/flutter/bin/flutter` and `src/mobile/flutter/bin/dart`.
- Node/npm is not installed locally; backend commands only work after installing Node 18+.

## Commands

Backend (run in `src/backend/`):
- `npm run dev` / `npm run lint` / `npm test` (jest, coverage, `--forceExit`)
- Single test: `npx jest src/__tests__/mobility.test.ts`
- Typecheck (CI does this, no npm script): `npx tsc --noEmit`
- `npm run migrate` / `npm run seed` are broken – they reference `src/database/migrate.ts`/`seed.ts` which don't exist. `src/database/schema.sql` is the only schema source; CI loads it with `psql` into a `heimat_test` DB and passes `DB_*` env vars to jest.

Mobile (run in `src/mobile/`, using vendored SDK):
- `flutter pub get`, `flutter test`, `flutter analyze --no-fatal-infos`
- Single test: `flutter test test/widget_test.dart`

## CI gates (`.github/workflows/`)

- Flutter CI runs `dart format --set-exit-if-changed .` – unformatted Dart is the most common CI failure. Run `dart format lib/ test/` before every commit touching Dart.
- Backend CI order: lint → test (needs Postgres) → `tsc --noEmit`.
- Pushing `src/mobile/**` to `main` auto-deploys the web build to GitHub Pages (`flutter build web --base-href "/HEIMAT/"`).

## Conventions

- No `analysis_options.yaml` in `src/mobile` – analyzer runs with defaults; `flutter_lints` is declared but unused.
- Service URLs come from `--dart-define` `BACKEND_URL` / `ML_SERVICE_URL` (defaults `http://localhost:3000` / `:8000`), see `src/mobile/lib/core/config/app_config.dart`.
- GTFS-Feed-Import läuft lokal (src/backend/scripts/import-gtfs-local.ts), nicht über Render (Free-Tier Memory/Timeout).
- Conventional Commits, lowercase, German descriptions (see CONTRIBUTING.md), e.g. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`.
- Root `*.md` files (`AI-*.md`, `heimat-plan.md`, `.loop.md`, `blog/`, `funding/`, `marketing/`) are planning/marketing docs, not code documentation.
