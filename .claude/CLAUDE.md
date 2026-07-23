# CLAUDE.md — HEIMAT 2.0

## Projektübersicht

HEIMAT 2.0 ist eine datenschutzkonforme, kostenfreie Open-Source Super App für den deutschen Alltag. Drei Kernbereiche: Mobilität (ÖPNV/Routing), Finanzen (GNU Taler P2P), Gesundheit (Arzt-Suche/Termine).

## Tech-Stack

- **Frontend:** Flutter (vendored SDK in `src/mobile/flutter/bin/`)
- **Backend:** Node.js 20+ / TypeScript / Express (`src/backend/`)
- **ML-Service:** Python FastAPI (`src/ml-service/`, Docker only)
- **DB:** PostgreSQL 15 (Supabase) + Redis 7 (Render)
- **Deploy:** Render.com (Backend) + GitHub Pages (Web)
- **Lizenz:** AGPL v3

## Architektur

```
Frontend (Flutter Web)
  → GitHub Pages: https://abatn.github.io/HEIMAT/
  → Provider-Pattern (MobilityProvider, FinanceProvider, HealthProvider)

Backend (Node.js Express, Render)
  → https://heimat-backend.onrender.com
  → /api/mobility/* — Overpass, Nominatim, OSRM, transitous.org, RAPTOR
  → /api/health/*   — Overpass-Ärzte, Registrierung, Slots, Termine
   → /api/finance/*  — Taler-Exchange-Client-Code (exchange.demo.taler.net, KUDOS, Ed25519) — Client-Code existiert, echter HTTP-Client, aber Bank-Wire-Funding-Schritt ist manuell (bank.demo.taler.net/webui), kein vollständig automatisierter End-to-End-Flow
  → /api/admin/*    — Nur mit ADMIN_KEY (env var)
  → /health/*       — Health-Checks mit DB/Redis Ping

ML-Service (Python FastAPI, Docker)
  → /predict/delay       — LightGBM (oder statistical fallback)
  → /predict/budget-category — Naive Bayes (oder keyword fallback)
  → /train/delay         — Training mit delay_logs Daten
  → /train/budget        — Training mit Beschreibungen

Datenquellen (alle öffentlich, kein Token):
  → Overpass API — Haltestellen, Ärzte (OSM)
  → Nominatim — Geocoding
  → OSRM — Routing (Fuß/Auto)
  → transitous.org — ÖPNV-Abfahrten, Verbindungen (MOTIS 2)
  → gtfs.de — GTFS-Feed (lokal importiert)
```

## Kritische Regeln (NIEMALS verletzen)

1. **NIE `git add -A` oder `git add .` vom Repo-Root.** Dateien explizit stage-n — `src/mobile/flutter/`, `src/mobile/android/`, `src/mobile/ios/`, `.mimocode/` sind untracked Junk.
2. **Vendored Flutter SDK verwenden:** `src/mobile/flutter/bin/flutter` und `src/mobile/flutter/bin/dart`. `flutter`/`dart`/`node` sind NICHT auf PATH.
3. **Conventional Commits, lowercase, deutsch:** z.B. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`
4. **Kein `analysis_options.yaml`** in `src/mobile` — Analyzer läuft mit Defaults.
5. **Keine Erfindungen, keine Halluzinationen.** Nur basierend auf existierenden Dateien arbeiten. Wenn etwas fehlt → fragen.
6. **Admin-Endpoints geschützt** — `ADMIN_KEY` muss als env var gesetzt sein. Kein statisch eingebauter Default-Fallback.
7. **KEINE lokale Sandbox.** Es gibt keinen lokalen Postgres, kein Docker-Stack, keine Entwicklungs-DB. Sämtliche Arbeit direkt gegen Production (Supabase + Render). Code-Änderungen werden committed und via CI/CD deployed.
8. **Supabase + Render MÜSSEN funktionieren.** Sie sind die einzige Test- und Deployment-Umgebung. Fallen sie aus, kann weder getestet noch deployed werden.

## Befehle

### Flutter (in `src/mobile/` ausführen)

```bash
# Format (MUSS vor jedem Commit laufen — CI prüft das!)
src/mobile/flutter/bin/dart format lib/ test/

# Analyze
src/mobile/flutter/bin/flutter analyze --no-fatal-infos

# Tests
src/mobile/flutter/bin/flutter test

# Einzeltest
src/mobile/flutter/bin/flutter test test/widget_test.dart

# Pub get
src/mobile/flutter/bin/flutter pub get
```

### Backend (in `src/backend/` ausführen)

```bash
# Dev-Server
npm run dev

# Lint
npm run lint

# Tests (braucht Postgres — CI nutzt heimat_test DB)
npm test

# Einzeltest
npx jest src/__tests__/mobility.test.ts

# Typecheck (kein npm-Script — CI macht das)
npx tsc --noEmit
```

### Docker

```bash
# Full Stack (Postgres 15, Redis 7, Backend, ML-Service, Frontend)
docker-compose up
```

## CI Gates

| Service | Reihenfolge | Häufigster Fehler |
|---------|-------------|-------------------|
| Flutter | `dart format` → analyze → test | Unformatierter Dart |
| Backend | lint → test → `tsc --noEmit` | Fehlende Typen |
| Deploy | Push `src/mobile/**` → `main` → GitHub Pages Web-Build | — |

## Sicherheit

| Thema | Status | Details |
|-------|--------|---------|
| Admin-Endpoints | ✅ geschützt | `ADMIN_KEY` env var required, kein statisch eingebauter Fallback |
| /api/migrate | ✅ geschützt | Nur mit `X-Admin-Key` Header |
| CORS | ⚠️ offen | `process.env.CORS_ORIGIN || '*'` — default allow-all, per env var einschränkbar |
| User-Auth | ✅ Code existiert | JWT + bcryptjs, Register/Login/Profile/Password — Code geschrieben, ungetestet auf Production |
| Rate-Limiter | ⚠️ global | 100 req/15min, kann bei API-Calls pro Screen limitieren |

## Bekannte Bugs & Fixes

### DECIMAL-to-double Crash (PostgreSQL → Flutter)

**Symptom:** `NoSuchMethodError: 'toDouble' Dynamic call of null. Receiver: "52.52190000"`

**Fix in Flutter-Providern:**
```dart
double.parse(json['latitude'].toString())
```

Betroffene Dateien: `mobility_provider.dart`, `finance_provider.dart`, `health_provider.dart`

### CORS/helmet blockiert API-Responses

**Fix in `src/backend/src/index.ts`:**
```typescript
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
```

### Route-Konflikt: `/stops/search` vs `/stops/:id`

**Ursache:** Express matcht `/stops/search` als `/stops/:id` mit `id="search"`.

**Fix in `mobility.ts`:** `/stops/search` VOR `/stops/:id` definieren.

### Journey Parameter-Mismatch

**Ursache:** Frontend sendet `?from=lat,lng&to=lat,lng`, Backend erwartet `?from_lat=&from_lng=&to_lat=&to_lng=`.

**Fix in `mobility_provider.dart`:** Query-Params an Backend anpassen.

## Datei-Map

```
src/mobile/           # Flutter App
  lib/
    core/
      config/         # AppConfig (Service-URLs)
      theme/          # AppTheme, AppColors
      widgets/        # HeimatBottomSheet, SkeletonLoader, EmptyState
      api/            # ApiClient
      ai/             # AiService (ML-Vorhersagen)
      services/       # LocationService
    features/
      mobility/       # MobilityScreen, MobilityProvider, DepartureBoard, JourneyPlanner
      finance/        # FinanceScreen, FinanceProvider
      health/         # HealthScreen, HealthProvider
  test/               # Widget-Tests
  flutter/bin/        # Vendored Flutter SDK (NICHT BEARBEITEN)

src/backend/          # Node.js Express API
  src/
    routes/           # mobility.ts, finance.ts, health.ts, healthService.ts, admin.ts
    services/         # mobilityService, financeService, healthService, talerService,
                      # raptorService, dbVendoService, aiService, disruptionAgent,
                      # personalRoutingAgent
    database/         # schema.sql (16 Tabellen, 24 Indizes)
    config/           # database.ts (PostgreSQL Pool)
    middleware/        # errorHandler, notFoundHandler
    utils/            # logger.ts
    __tests__/        # 113 Tests: auth(14), validation(25), e2e(22), mobility(18), health(16), finance(12), bank-wire-live(6/manual)
  scripts/            # import-gtfs-local.ts (GTFS-Import)

src/ml-service/       # Python FastAPI (nur Docker)
  api/ml_service.py   # Delay Predictor + Budget Classifier

.claude/              # Agent-Setup
  CLAUDE.md           # Diese Datei
  hooks/              # pre-commit-dart-format.sh, check-git-add.sh
  skills/             # heimat-flutter.md, heimat-backend.md, heimat-deploy.md
```

## Konventionen

- Service-URLs via `--dart-define`: `BACKEND_URL` / `ML_SERVICE_URL` (Defaults `http://localhost:3000` / `:8000`)
- Siehe `src/mobile/lib/core/config/app_config.dart`
- GTFS-Import läuft lokal (`src/backend/scripts/import-gtfs-local.ts`), nicht auf Render
- Root `*.md`-Dateien sind Planungs-/Marketing-Dokumente, keine Code-Dokumentation
- Schema-Quelle: `src/backend/src/database/schema.sql` (CI lädt via `psql`)
- Kein `npm run migrate` oder `npm run seed` — diese Scripts existieren nicht
- Taler: Client-Code existiert (exchange.demo.taler.net, Ed25519, KUDOS), aber kein vollständiger End-to-End-Flow — Bank-Wire-Funding erfordert manuellen Schritt auf bank.demo.taler.net/webui

## Code-Existenz (geschrieben ≠ getestet/deployed)

| Feature | Code existiert? | Getestet? | Production-validiert? | Anmerkung |
|---------|---------------|-----------|----------------------|-----------|
| User-Auth (JWT+bcryptjs) | ✅ | ✅ (14 Tests) | ❌ ungetestet | Routes/Service geschrieben, auf Production nie ausgeführt |
| Zod-Validierung | ✅ (25 Tests) | ✅ (25 Tests) | ❌ ungetestet | Middleware validiert alle Inputs, per CI getestet |
| Swagger/OpenAPI | ✅ | ✅ (in e2e) | ❌ ungetestet | `/docs` und `/docs.json` im Code |
| Taler-Exchange-Client | ⚠️ Client-Code | ✅ (12 Tests) | ❌ kein vollst. Flow | exchange.demo.taler.net erreichbar, aber Bank-Wire-Funding manuell |
| E2E-Tests (Backend) | ✅ | ✅ (22 Tests) | 🔄 via CI | Testet User-Lifecycle, aber braucht Postgres (nur in CI) |
| Backend CI health.test.ts | 🔴 1/7 Suites failed | ❌ | ❌ | pre-existing, vermutlich DB-Cleanup-Reihenfolge |

## Offene Tasks (priorisiert)

1. 🔴 **Backend CI: `health.test.ts` fixen** — pre-existing failure (1/7 Suites)
2. **Production-Validierung: User-Auth End-to-End testen** — auf Render deployt und curl-Test
3. **Taler-End-to-End automatisieren** — Bank-Wire-Schritt dokumentieren oder API-Workaround finden
4. **E2E-Tests (Flutter Integration)** — kein Code vorhanden
