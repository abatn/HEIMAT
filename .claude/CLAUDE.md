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
  → /api/finance/*  — Taler-Exchange-Client (echter exchange.demo.taler.net, KUDOS – echte GNU-Taler-Testnet-Currency, Ed25519-Wallet)
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
| CORS | ✅ eingeschränkt | Default: `https://abatn.github.io` (nicht `*`) |
| User-Auth | ✅ implementiert | JWT + bcryptjs, Register/Login/Profile/Password |
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
  test/               # Widget-Tests (21 Tests)
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
    __tests__/        # mobility.test, health.test, finance.test (55 Tests)
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
- (erledigt Phase 18) Taler-Service ist seit Phase 18 ein echter GNU-Taler-Exchange-Client (exchange.demo.taler.net + bank.demo.taler.net)

## Offene Tasks (priorisiert)

1. ~~User-Auth (JWT + bcryptjs)~~ ✅ erledigt
2. ~~Zod-Validierung~~ ✅ erledigt
3. API-Dokumentation (Swagger/OpenAPI)
4. Echte Taler-Exchange Anbindung
5. E2E-Tests (Flutter Integration)
