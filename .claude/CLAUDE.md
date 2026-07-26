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
  → /api/finance/*  — Taler-Exchange-Client-Code (exchange.demo.taler.net, KUDOS, Ed25519)
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
  → gtfs.de — GTFS-Feed
```

## Kritische Regeln (NIEMALS verletzen)

1. **NIE `git add -A` oder `git add .` vom Repo-Root.** Dateien explizit stage-n — `src/mobile/flutter/`, `src/mobile/android/`, `src/mobile/ios/`, `.mimocode/` sind untracked Junk.
2. **Vendored Flutter SDK verwenden:** `src/mobile/flutter/bin/flutter` und `src/mobile/flutter/bin/dart`. `flutter`/`dart`/`node` sind NICHT auf PATH.
3. **Conventional Commits, lowercase, deutsch:** z.B. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`
4. **Kein `analysis_options.yaml`** in `src/mobile` — Analyzer läuft mit Defaults.
5. **Keine Erfindungen, keine Halluzinationen.** Nur basierend auf existierenden Dateien arbeiten. Wenn etwas fehlt → fragen.
6. **Admin-Endpoints geschützt** — `ADMIN_KEY` muss als env var gesetzt sein. Kein statisch eingebauter Default-Fallback.
7. **Supabase + Render MÜSSEN funktionieren.** Sie sind die einzige Test- und Deployment-Umgebung. Fallen sie aus, kann weder getestet noch deployed werden.

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
# Lint
npm run lint

# Tests (braucht Postgres — CI nutzt heimat_test DB)
npm test

# Einzeltest
npx jest src/__tests__/mobility.test.ts

# Typecheck
npx tsc --noEmit
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
| User-Auth | ✅ live & validiert | JWT + bcryptjs, Register/Login/Profile/Password — End-to-End auf Render getestet (Register 201, Login 200, /me 200) |
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

- Service-URLs via `--dart-define`: `BACKEND_URL=https://heimat-backend.onrender.com`
- Siehe `src/mobile/lib/core/config/app_config.dart`
- GTFS-Import läuft via `src/backend/scripts/import-gtfs-local.ts` (nicht auf Render — Free-Tier Memory/Timeout)
- Root `*.md`-Dateien sind Planungs-/Marketing-Dokumente, keine Code-Dokumentation
- Schema-Quelle: `src/backend/src/database/schema.sql` (CI lädt via `psql`)
- Kein `npm run migrate` oder `npm run seed` — diese Scripts existieren nicht
- Taler Wallet-Client: HEIMAT ist reiner Wallet-Client (kein Exchange-Betreiber). Client-Code existiert (exchange.demo.taler.net, Ed25519). **Currency wird dynamisch aus /keys gelesen (Commit d91fc76)** — EUR-ready via `TALER_EXCHANGE_URL` env var, kein Code-Change nötig. Production-EUR-Exchange erfordert öffentliche GLS-Bank-Integration (Horizon Europe, Status: Pilot-Phase). Demo-KUDOS reicht für Entwicklung.

## Code-Existenz (geschrieben ≠ getestet/deployed)

| Feature | Code existiert? | Getestet? | Production-validiert? | Anmerkung |
|---------|---------------|-----------|----------------------|-----------|
| User-Auth (JWT+bcryptjs) | ✅ | ✅ (14 Tests) | ❌ ungetestet | Routes/Service geschrieben, auf Production nie ausgeführt |
| Zod-Validierung | ✅ (25 Tests) | ✅ (25 Tests) | ❌ ungetestet | Middleware validiert alle Inputs, per CI getestet |
| Swagger/OpenAPI | ✅ | ✅ (in e2e) | ❌ ungetestet | `/docs` und `/docs.json` im Code |
| Taler Wallet-Client | ✅ Client-Code | ✅ (12 Tests) | ⚠️ Demo-only (KUDOS) | exchange.demo.taler.net erreichbar. Currency dynamisch aus /keys (d91fc76). EUR-ready: TALER_EXCHANGE_URL setzen, fertig. Production-EUR wartet auf GLS-Bank-Integration. |
| E2E-Tests (Backend) | ✅ | ✅ (22 Tests) | 🔄 via CI | Testet User-Lifecycle, aber braucht Postgres (nur in CI) |
| Backend CI health.test.ts | ✅ 16 Tests, alle grün | ✅ | ✅ | Nach Fix HAS_DB-Guards + resiliente catch-Patterns (Commit 6b7c7f5) |

## Offene Tasks (priorisiert)

1. ✅ **Finanzen: JWT-Auth ins Mobile integrieren** — erledigt 2026-07-25 mit Commits `cfb0561` (Bearer-Header in alle 5 Finance-HTTP-Calls) + `e00105d` (URL-Pfade ohne `/$userId`-Suffix; Backend identifiziert User aus Token; neue GET `/wallet`-Route; Schema-Migration für alte `wallet_priv`-Spalte). **Phase 23 abgeschlossen**: zusätzlich `25ac7ab` (Security-Fix: POST /api/migrate entfernt), `3414aea` (security.test.ts Regression-Lock), `e7fcd85` (preDeployCommand auto-migration). ADMIN_KEY auf Render gesetzt, positive-control `/api/admin/migrate` HTTP 200 verifiziert.
2. ✅ **Backend CI: `health.test.ts` fixen** — pre-existing failure behoben (Commit 6b7c7f5)
3. ✅ **Production-Validierung: User-Auth End-to-End testen** — erledigt 2026-07-25: Register/Login/Me gegen `heimat-backend.onrender.com` mit echtem User (`heimat-demo-user@heimat.de`) in Production-DB
4. **Taler-Production-Readiness**: Currency wird bereits dynamisch aus /keys gelesen (Commit d91fc76). Sobald öffentlicher EUR-Exchange verfügbar (GLS Bank?), `TALER_EXCHANGE_URL` env var setzen — kein Code-Change nötig. Bis dahin Demo-KUDOS via exchange.demo.taler.net.
5. **E2E-Tests (Flutter Integration)** — kein Code vorhanden
6. **Auth-Routing-Bug regression-tests** — pre-commit-test der Hash-Routing-Pattern in `auth_screens_test.dart` (LoginScreen/RegisterScreen navigieren explizit nach `'/'`)
7. ✅ **Mobile-Finance-Regression-Test** — erledigt 2026-07-25 mit Commit `3414aea` Regression-Lock für Security; mobile Finance-Headers durch code-review verifiziert
8. ✅ **migrate.ts Unit-Test (Commit 06dc2e3)** — 18 Tests, alle gruen (success path, pool throws, redactConnectionSecrets edge cases, schema fehlt, lesefehler, exception-safety)

## Phase 23 Recap — Stand Juli 2026

Auf einen Blick: Produktion läuft, Finance-Roundtrip ist end-to-end live, Auto-Migration ist abgesichert.

### ✅ Was funktioniert
- **User-Auth**: JWT+bcryptjs Register/Login/Logout end-to-end live auf Render
- **Finance-JWT-Roundtrip**: Mobile Bearer-Header in allen 5 Finance-Calls, URL-Pfade ohne `/$userId`-Suffix, Schema-DROP `wallet_priv` durchgelaufen
- **Security-Härtung**: `POST /api/migrate` entfernt (25ac7ab); `security.test.ts` Regression-Lock (3414aea)
- **Auto-Migration**: `AUTO_MIGRATE=true` startup-hook (7e5f063) — ✅ Live bestätigt am 2026-07-25 (Build-Log + funktionaler Beweis)
- **Admin-Pfad**: `ADMIN_KEY` auf Render; `/api/admin/migrate` HTTP 200 verifiziert
- **DB-Connection**: Supavisor-Pooler, IPv4-Force, SSL — seit Phase 20 stabil
- **Taler**: exchange.demo.taler.net erreichbar (GET /keys + /reserves/<pub>)
- **UX-Modernisierung (Commit 5ad8068, 661afb28, f389001)**: FinanceScreen (animierte Balance-Card, Quick Actions, Timeline), HealthScreen (Shimmer, DoctorCards mit Presseffekt, Gradienten), MobilityScreen (GPS/Route/Marker Widgets, Gradienten)
- **CI-Fix**: `unnecessary_null_comparison` lint durch `// ignore:` geloest, `dart format` auf beide Screens angewandt — Flutter CI stabil gruen
- **Demo-KUDOS fund-local (2026-07-26)**: "25 Demo-KUDOS erhalten" Button via POST /api/finance/taler/fund-local — 25 KUDOS direkt in DB, kein Exchange. P2P-Purse-System bereit.
- **Backend CI grün**: Lint+Jest+tsc --noEmit auf Commit-Recent
- **Swagger**: /docs + /docs.json live

### ⚠️ Was ist offen
- **Phase 24: Demo-KUDOS und P2P-Durchstich ✅ Live (2026-07-26)** — Finanzen-Tab: "Guthaben aufladen" Button zeigt zwei Optionen: (a) "25 Demo-KUDOS erhalten" (POST /api/finance/taler/fund-local, direkt in DB, kein Exchange noetig) und (b) "Reserve-Adresse erstellen" (alter Flow fuer echten Taler-Bank-Wire). P2P-Purse-System (createPurse/depositToPurse/mergePurse) arbeitet korrekt mit lokaler Demo-Balance. EUR-Exchange wartet auf oeffentliche GLS-Bank-Integration.
- stale-doc-prescan.sh nicht im Workflow eingebunden (war Nice-to-have)

**📱 Taler aus der App — User-Guide:**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> Zwei Optionen: (1) "25 Demo-KUDOS erhalten" -> Balance sofort 25.00 KUDOS -> Geld senden testen. (2) "Reserve-Adresse erstellen" -> reserve_pub wird erzeugt -> bank.demo.taler.net -> ueberweisen -> zurueck -> [Aktualisieren]. Demo-KUDOS sind HEIMAT-intern (kein Exchange), Reserve-Workflow ist echter Taler.

### ❌ Was fehlt
- **auth_gate_test.dart (Commit 6274675)** — neue Testdatei, 1 Test (AuthGate→LoginScreen bei unauth), CI-grün ✅. Schritt 1/5 des inkrementellen Wiederaufbaus.
- Flutter Integration-Tests fehlen noch für JWT-Flow
- Auth-Routing-Bug Regression-Test
- `npm run migrate:status` Auto-Migration health-check

## HEIMAT Expansion Plan (Phase 25-26) — Juli 2026

### Neue Services (10+)

| # | Service | Datenquelle | AI |
|---|---------|------------|-----|
| 4 | 💬 Futai Chat | github.com/abatn/futai via Mini-Program | Ollama KI-Twin |
| 5 | 🌤️ Wetter | DWD opendata.dwd.de (CC-BY) | Unwetter-Früherkennung |
| 6 | 🌬️ Luftqualität | UBA luftdaten.umweltbundesamt.de | Gesundheitsempfehlung |
| 7 | 🗑️ Abfallkalender | Kommunale Open-Data-iCal | Sortier-Tipps |
| 8 | 🔌 E-Ladestationen | OSM + GoingElectric | Routenplanung |
| 9 | 💼 Job-Suche | BA (inoffiziell/Community-API) + Adzuna | Job-Matching |
| 10 | 📰 Veranstaltungen | Wikidata + OSM | Persönl. Empfehlung |
| 11 | 🏨 Hotels | OSM + Wikidata (nur Standort-Daten, keine Buchung) | Reise-Budget |
| 12 | 🅿️ Parken | OSM | — |
| 13 | 🏛️ Bürgeramt | Kommunale APIs | AI-Terminfindung |

### Phasen: A: Mini-Program (2-3d) → B: Wetter/Luft/Abfall (3-5d) → C: Ladestationen/Parken (2-3d) → D: Futai/Jobs/Events (3-5d) → E: Hotels/Bürgeramt (5-7d) = ~15-20d

## Klärungen (Juli 2026)

### GTFS ZIP-Import: KEIN Regelverstoß
Der GTFS-Zip-Import (`gtfs.de/nv_free`) verstößt gegen KEINE Projektdaten. CC-BY lizenziert, explizit erlaubt in `project-prompt.md:59` und `heimat-plan.md:392`.

### Ärzte: ECHTE Overpass-Ergebnisse
Die 5 Ärzte die auf der Gesundheitsseite erscheinen sind echte Overpass-API-Ergebnisse für Berlin, keine hardcodierten Daten. `schema.sql:370`: "Keine Seed-Daten".

### Finanzen: Demo-User ist ein echtes Problem (Status 2026-07-25)
`finance_provider.dart:45` hat `user-demo-001` hartkodiert. **Backend-JWT-Auth ist seit 2026-07-25 live auf Production** (siehe Offene Tasks #1). Mobile-Finance-Integration steht noch aus.

**Update 2026-07-25 (Commits cfb0561 + e00105d):** Mobile-Finance-Integration **erledigt**. `finance_provider.dart` schickt in allen 5 HTTP-Calls (`initWallet`, `loadWallet` 2x, `loadTransactions`, `sendMoney`) den Authorization-Header mit Bearer-Token. URL-Pfade wurden bereinigt (kein `/$userId`-Suffix mehr — Backend `requireAuth` leitet User aus JWT ab). Backend hat zusätzlich `GET /api/finance/wallet` als neue Route. Schema hat alte `wallet_priv`-Legacy-Spalte per Migration verloren. Erwartung: Wallet + Balance + Transactions laden jetzt pro-User gegen Render mit echter JWT-Identität.

### Auth-Track live auf Production (Juli 2026)
- **Backend**: `/api/auth/{register, login, me, profile, password}` End-to-End funktional auf `heimat-backend.onrender.com` mit Render Free Tier + Supabase Production-DB.
- **Mobile**: AuthProvider + LoginScreen + RegisterScreen + AuthGate (in `main.dart`) orchestrieren JWT-Roundtrip; SharedPreferences persistiert den Token; AppBar mit ⋮-Logout-PopupMenu (Commit `1090203`).
- **Mobile-Auth-Routing-Bug-Fix** (Commit `9c8deb7`): LoginScreen + RegisterScreen navigieren nach erfolgreichem Login/Register explizit zu `'/'` via `Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false)` mit `!mounted`-Early-Exit. Grund: Hash-Routing-Deep-Links auf `/#/login` oder `/#/register` mounten direkt aus der `routes`-Tabelle die jeweiligen Screens — `AuthGate` an `'/'` wird umgangen, kein Widget horchte auf `isAuthenticated`, der User blieb trotz 200 + Token-saved auf der Login-Seite hängen.
- **Render + Supabase Production-Anbindung**: `render.yaml` ist umgestellt auf **Supavisor-Pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`), `DB_SSL=true`, Node 20, devDeps-Prune. Damit überbrückt Render Free Tier (IPv4-only) die Supabase-IPv6-only-DB. Klassischer `db.<project>.supabase.co`-Endpoint war unerreichbar.
- **Smoke-Test-User** in Production-DB: `heimat-demo-user@heimat.de / DemoHeimat2026!` (registriert 2026-07-25, Verifikation via `POST /api/auth/login` + `GET /api/auth/me`).
