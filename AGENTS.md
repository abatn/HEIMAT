# AGENTS.md

HEIMAT 2.0 — Open-source super app (German docs/UI). Three services:
- `src/mobile/` — Flutter (ÖPNV, Taler payments, doctor appointments)
- `src/backend/` — Node 18+ / TypeScript Express API (port 3000)
- `src/ml-service/` — Python FastAPI (port 8000, Docker only)

## Critical warnings

1. **Never `git add -A` or `git add .` from repo root.** `src/mobile/flutter/` is a vendored Flutter SDK (3.24.5), `src/mobile/android/`, `src/mobile/ios/`, `.mimocode/` are untracked. Stage explicitly.
2. **`flutter`, `dart`, `node` are NOT on PATH.** Use `src/mobile/flutter/bin/flutter` and `src/mobile/flutter/bin/dart`.
3. **No sandbox.** All work targets production (Supabase + Render). CI runs tests against Postgres. Locally there is no database — `ECONNREFUSED` is expected, not a bug.
4. **Mock/simulation/fake is forbidden.** `scripts/audit-no-mocks.sh` enforces this in CI. Use honest placeholders (`ComingSoonScreen`) instead.
5. **Conventional Commits, lowercase, German** — e.g. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`

## Commands

### Backend (run in `src/backend/`)

```bash
npm run lint              # ESLint
npm test                  # Jest (--coverage --forceExit), needs Postgres
npx jest src/__tests__/mobility.test.ts  # Single test
npx tsc --noEmit          # Typecheck
npm run test:db           # Start local Postgres test DB (Docker)
npm run migrate:status    # Check migration state
```

Schema: `src/backend/src/database/schema.sql` (812 lines, 16+ tables). CI loads it via `psql -f`. Auto-migration runs on startup (`AUTO_MIGRATE=true`). There is no `npm run seed`.

### Mobile (run in `src/mobile/`, using vendored SDK)

```bash
src/mobile/flutter/bin/dart format lib/ test/       # MUST run before every Dart commit
src/mobile/flutter/bin/flutter analyze --no-fatal-infos
src/mobile/flutter/bin/flutter test
src/mobile/flutter/bin/flutter test test/app_smoke_test.dart  # UI smoke test
```

No `analysis_options.yaml` — analyzer runs with defaults.

### Test prerequisites

- **Flutter tests:** Use `tester.pump(Duration)` with 100-200ms intervals. **`pumpAndSettle()` is forbidden** (infinite animations hang).
- **Flutter tests:** Call `SharedPreferences.setMockInitialValues({})` in every `setUp()`.
- **Flutter tests:** Use stub-override pattern (`_Stub<X> extends X`) not Mockito.
- **Backend tests:** Need Postgres. CI uses `postgres:15-alpine` with DB `heimat_test`. Env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`.

## CI gates (`.github/workflows/`)

| Workflow | Job order | Common failure |
|----------|-----------|----------------|
| `flutter.yml` | analyze (format → lint → analyze) → test + smoke (parallel) → build-web + build-android + build-ios | Unformatted Dart |
| `backend.yml` | lint (+ mock audit) → test (needs Postgres) → build (`tsc --noEmit`) | Missing types |
| `deploy-web.yml` | Push `src/mobile/**` to `main` → full CI → `flutter build web --release --base-href "/HEIMAT/"` → GitHub Pages | — |

Dependabot patches auto-approved/merged via `dependabot-auto-merge.yml`.

## Architecture

### Flutter: 3-Tab layout (WeChat pattern)

| Tab | Name | Screen |
|-----|------|--------|
| 0 | Startseite | `home_screen.dart` — Dashboard, AI-Chat FAB |
| 1 | Dienste | `services_screen.dart` — 14 services, 6 categories |
| 2 | Profil | `profile_screen.dart` — Settings, logout |

### Mobile: No IFrame / WebView in native Flutter

ServiceRegistry in `src/mobile/lib/features/miniprogram/domain/service_registry.dart` routes to native widgets. Non-migrated services show `ComingSoonScreen`. All sentinel URLs are `native://registry/<id>` — no HTTP requests.

### Backend: Hardcoded external URLs are forbidden

All external service URLs must come from env vars. If you add a new external API call, create a config entry (Phase X.2 pattern).

### Health AI: Privacy rules

- No health data leaves device without user consent
- No background GPS/camera/microphone
- No commercial AI APIs (OpenAI, Google, Ada)
- On-device for sensitive data (TFLite), backend for reasoning (Ollama)
- Always display medical disclaimer: "Keine medizinische Diagnose..."

## Conventions

- **Service URLs** from `--dart-define BACKEND_URL`. Default: `https://heimat-backend.onrender.com`. See `src/mobile/lib/core/config/app_config.dart`.
- **Admin endpoints** require `ADMIN_KEY` env var (no static fallback).
- **GTFS import** via `src/backend/scripts/import-gtfs-local.ts` (not on Render — free-tier memory/timeout).
- **Taler** is a real GNU Taler wallet client (`exchange.demo.taler.net`). HEIMAT is the wallet client, not the exchange operator. Currency reads dynamically from exchange `/keys`.
- **DB connection:** Supavisor pooler (`aws-0-eu-west-1.pooler.supabase.com:5432`), `DB_SSL=true`, Node 20. IPv4-only Render Free Tier needs `family: 4` in pg config.
- Root `*.md` files (`AI-*.md`, `heimat-plan.md`, `.loop.md`, `blog/`, `funding/`, `marketing/`) are planning docs, not code documentation.

## Known bugs

| Symptom | Cause | Fix |
|---------|-------|-----|
| `toDouble` on null for lat/lng | Postgres DECIMAL → Node pg string → Flutter `.toDouble()` on null | `double.parse(json['latitude'].toString())` in providers |
| Jest: `received value must be a number or bigint` | Postgres COUNT/DECIMAL returns strings; Jest `toBeGreaterThanOrEqual` expects number | `Number(result?.count ?? 0)` in services |
| `/stops/search` returns 500 "invalid input syntax for type uuid" | Express matches `/stops/search` as `/stops/:id` | Define `/stops/search` before `/stops/:id` in mobility routes |
| Login stuck on LoginScreen with valid credentials | Hash-Routing `/#/login` bypasses `AuthGate` at `'/'` | `Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false)` after login/register (fix: `9c8deb7`) |

## Other instruction files

- `.claude/CLAUDE.md` — Claude-specific (same rules, more verbose)
- `.claude/skills/heimat-health-ai.md` — Health AI architecture
- `.opencode/skills/heimat-dev/SKILL.md` — OpenCode skill (auto-loaded)
