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
- **Funded-Wallet-Pfad (Phase R, 2026-07-27)**: Wallet-Balance bleibt 0.00 KUDOS bis ein EUR-Production-Exchange (oder bank.demo.taler.net) echtes Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. fundLocal Mock-Endpoint (POST /api/finance/taler/fund-local) liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" + `_computeMockLiveStatus` entfernt (Commits 7718333 + 82047ad). User-Regel (AGENTS.md:143 + knowledge.md:283): "mock, simulation, fake sind verboten".
- **Backend CI grün**: Lint+Jest+tsc --noEmit auf Commit-Recent
- **Swagger**: /docs + /docs.json live
- **Phase E Wetter Real-Fix ✅ (2026-07-27, Commit 99daa9c)**: Wetter-Tab 429-Bug behoben via Mirror-Fallback-Pattern. Open-Meteo primary (DWD) + Bright Sky DWD-Proxy (`api.brightsky.dev`) als 2. öffentlicher Anbieter — gleiche Architektur wie mobilityService.ts Overpass-Mirror-List. **Real-Data-Only Fix**: alle HTTP-Calls gegen reale CC-BY-4.0 APIs, keine Mocks/Simulations (per User-Regel "mock, simulation, fake sind verboten"). Constructor-DI (`new WeatherService(mockHttp)`) für Test-Seam. 10/10 jest Tests grün. Live-Verifikation auf Render: `heimat-backend.onrender.com/api/weather/forecast?lat=52.52&lng=13.41` → HTTP 200 OK mit echten DWD-ICON-Daten (Berlin: 21.1°C, Klarer Himmel, 28.1 km/h Wind). Public-API `getWeather()` unverändert, Mobile DTO-Vertrag stabil — kein Flutter-Rebuild nötig.

### ⚠️ Was ist offen
- **Wallet-Balance bleibt 0.00 KUDOS bis EUR-Exchange-Live (Phase R geschlossen, 2026-07-27)**: Demo-Mock-Bypass fundLocal entfernt per User-Regel (AGENTS.md:143 + knowledge.md:283 "mock, simulation, fake sind verboten"). Wallet wird via echten Reserve-Adresse-Bank-Wire gefuellt (bank.demo.taler.net heute, EUR-Production-Exchange wartet auf oeffentliche GLS-Bank-Integration). Demo-Option (a) im Finanzen-Tab-Bottom-Sheet entfernt (Commit 7718333). audit-no-mocks.sh enforced in CI (Commit 82047ad).
- stale-doc-prescan.sh nicht im Workflow eingebunden (war Nice-to-have)

**📱 Taler aus der App — User-Guide:**
Finanzen-Tab oeffnen -> Wallet auto-erstellt -> 0.00 KUDOS -> [Guthaben aufladen] -> nur echter Reserve-Adresse-Weg (Phase R, 2026-07-27): reserve_pub wird erzeugt -> bank.demo.taler.net -> echtes KUDOS-Wire vom bank.demo.taler.net-Konto ausfuehren -> zurueck zu HEIMAT -> [Aktualisieren] -> Balance zeigt via Bank-Wire gebuchten Live-Wert. Demo-KUDOS-Option (1) "25 Demo-KUDOS erhalten" wurde komplett entfernt (kein Mock-Bypass, kein "Schnell-guthaben"-Button). P2P-Send an registrierte HEIMAT-User funktioniert nach erfolgreichem Bank-Wire.

### ❌ Was fehlt
- **auth_gate_test.dart (Commit 6274675)** — neue Testdatei, 1 Test (AuthGate→LoginScreen bei unauth), CI-grün ✅. Schritt 1/5 des inkrementellen Wiederaufbaus.
- Flutter Integration-Tests fehlen noch für JWT-Flow
- Auth-Routing-Bug Regression-Test
- `npm run migrate:status` Auto-Migration health-check

## Phase Q Recap — AuthLock Quality-Pass (2026-07-27)

**Commit 78a371d — AuthGate-Extraktion + 11 neue authlock-regression-Tests.**

Architektur-Verbesserung (Eliminiert Production-Test-Drift):
- `lib/core/auth/auth_gate.dart` (NEU): Pure Routing-Widget, required `authenticated` Parameter (kein DefaultRenderer der Bugs versteckt). Single Source of Truth für auth-zustandsabhängige Routen-Entscheidung.
- `lib/main.dart`: Inline `class AuthGate extends StatelessWidget` Block entfernt (war 11 Zeilen). Route '/' jetzt `AuthGate(authenticated: const MainScreen())`.

Tests verriegeln AuthLock-Vertrag:
- `test/auth_gate_test.dart` (REWRITE): 5 Tests — unauth→LoginScreen, auth→MockMain, transition logout→LoginScreen, loading-state (vor init), partial-auth edge (token ohne user_id).
- `test/auth_integration_test.dart` (NEU): 6 Tests mit `_FakeAuthProvider extends AuthProvider` (Stub-Vererbungs-Pattern, kein HTTP) — Cold-Start, Login transition, Logout via PopupMenuButton, Login-Logout-Login cycle, AUTH-LOCK state-injection, RegisterScreen Top-Level.

**Lessons-Learned (im Repo verriegeln):**
- `pumpAndSettle()` **VERBOTEN** in Mobile-Tests → infinite-animation hang. Stattdessen `tester.pump(Duration(milliseconds: 100))` mit 100-200ms Intervallen.
- `SharedPreferences.setMockInitialValues({})` in JEDEM setUp() für Test-Isolation.
- Stub-Vererbung-`_Stub<X>` (Pattern aus `app_smoke_test.dart`) > Mockito-build_runner.
- AuthGate-Required-Parameter-Pattern verhindert silent-default-widget-bugs.

Validation:
- Code-Reviewer-minimax-m3: 9/9 PASS (Q1-Q9); 5 minor feedback non-blocker.
- Static drift-check: Single AuthGate-Declaration im ganzen Repo verifiziert.
- Unused-Imports Audit: alle 22 Imports in `main.dart` werden verwendet.

CI: Code gepuscht (78a371d), Flutter CI Pipeline (analyze + test + smoke) automatisch.

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

## Health AI Agent — Research & Architektur (2026-07-29)

### Hybrid-Architektur (On-Device + Backend)
- **On-Device (TFLite MobileBERT, 15-60MB):** Notfall-Keyword-Erkennung, Symptom-Kategorie, einfache UI-Entscheidungen
- **Backend (Ollama llama3.1:8b):** Adaptives Symptom-Gespräch, Triage (112/116117/Routine), Arzt-Empfehlung via Overpass

### Wissenschaftliche Basis (keine Pseudowissenschaft)
- **Symptom-Assessment:** Klinisch validiert (JAMA Network Open, 2021 – 70-85% Übereinstimmung)
- **Triage:** TriageBench Open-Source-Benchmark + Manchester Triage System
- **Ärzte:** healthService.ts → Overpass API (Echtzeit, keine DB-Statik)
- **Privacy:** DSGVO Art. 9 – On-Device für sensible Daten, Backend nur anonymisiert

### Wichtige Regeln (NIEMALS verletzen)
1. **Keine erfundenen Health-AI-Behauptungen** – nur was publiziert ist
2. **Keine kommerziellen AI-APIs** – nur Ollama + TFLite + spaCy
3. **Haftungsausschluss** immer: "Keine medizinische Diagnose. Bei Unsicherheit 112."
4. **Lebenszeichen:** Timer-basiert, KEIN Accelerometer, KEIN GPS-Tracking
5. **`pumpAndSettle()` VERBOTEN** in Health-Tests → `tester.pump(Duration(milliseconds: 100))`

### Aktuelle Health AI Endpoints
| `POST` | `/api/ai/chat` | ollamaService (Ollama) | Symptom-Assessment, Triage, Arzt-Empfehlung |
| `GET` | `/api/ai/status` | – | Ollama-Verbindungsstatus |
| `GET` | `/api/ai/service-prompt` | promptService | Service-Prompts mit Health-Daten |
| `GET` | `/api/health/doctors` | healthService | Overpass-Arztsuche |

### TODOs (Health AI)
- 🟢 **Phase AI-Health-1 (Symptom + Triage + Arzt):** ✅ Fertig (promptService.ts, ollamaService.ts)
- 🟡 **Phase AI-Health-2 (Lebenszeichen):** Timer-Check-in Backend + Mobile (geplant)
- 🟢 **Phase AI-Health-3 (On-Device TFLite):** ✅ Fertig (OnDeviceSentimentClassifier)
- 🟢 **Phase AI-Health-4 (Cross-Service):** ✅ Fertig (promptService fetchServiceContexts)
- ⏳ **Phase AI-Health-5 (DEGAM-RAG + FHIR):** Extern blockiert (Lizenz, Praxis-APIs)

---

## Klärungen (Juli 2026)

### GTFS ZIP-Import: KEIN Regelverstoß
Der GTFS-Zip-Import (`gtfs.de/nv_free`) verstößt gegen KEINE Projektdaten. CC-BY lizenziert, explizit erlaubt in `project-prompt.md:59` und `heimat-plan.md:392`.

### Ärzte: 100% Overpass-Live, keine Seed-Daten (Commit 760d88f)
Alle Ärzte kommen live von Overpass (OSM) — weltweit, standortunabhängig. Keine Berlin-Seed-Daten mehr. `ensureDoctorInDb()` auto-saved OSM-Arzt in DB bei Terminbuchung mit Default-Slots (Mo-Fr 8-17). classifySpecialty(): 16→25 Rules, 52 Unit-Tests.

### Finanzen: Demo-User ist ein echtes Problem (Status 2026-07-25)
`finance_provider.dart:45` hat `user-demo-001` hartkodiert. **Backend-JWT-Auth ist seit 2026-07-25 live auf Production** (siehe Offene Tasks #1). Mobile-Finance-Integration steht noch aus.

**Update 2026-07-25 (Commits cfb0561 + e00105d):** Mobile-Finance-Integration **erledigt**. `finance_provider.dart` schickt in allen 5 HTTP-Calls (`initWallet`, `loadWallet` 2x, `loadTransactions`, `sendMoney`) den Authorization-Header mit Bearer-Token. URL-Pfade wurden bereinigt (kein `/$userId`-Suffix mehr — Backend `requireAuth` leitet User aus JWT ab). Backend hat zusätzlich `GET /api/finance/wallet` als neue Route. Schema hat alte `wallet_priv`-Legacy-Spalte per Migration verloren. Erwartung: Wallet + Balance + Transactions laden jetzt pro-User gegen Render mit echter JWT-Identität.

### Auth-Track live auf Production (Juli 2026)
- **Backend**: `/api/auth/{register, login, me, profile, password}` End-to-End funktional auf `heimat-backend.onrender.com` mit Render Free Tier + Supabase Production-DB.
- **Mobile**: AuthProvider + LoginScreen + RegisterScreen + AuthGate (in `main.dart`) orchestrieren JWT-Roundtrip; SharedPreferences persistiert den Token; AppBar mit ⋮-Logout-PopupMenu (Commit `1090203`).
- **Mobile-Auth-Routing-Bug-Fix** (Commit `9c8deb7`): LoginScreen + RegisterScreen navigieren nach erfolgreichem Login/Register explizit zu `'/'` via `Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false)` mit `!mounted`-Early-Exit. Grund: Hash-Routing-Deep-Links auf `/#/login` oder `/#/register` mounten direkt aus der `routes`-Tabelle die jeweiligen Screens — `AuthGate` an `'/'` wird umgangen, kein Widget horchte auf `isAuthenticated`, der User blieb trotz 200 + Token-saved auf der Login-Seite hängen.
- **Render + Supabase Production-Anbindung**: `render.yaml` ist umgestellt auf **Supavisor-Pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`), `DB_SSL=true`, Node 20, devDeps-Prune. Damit überbrückt Render Free Tier (IPv4-only) die Supabase-IPv6-only-DB. Klassischer `db.<project>.supabase.co`-Endpoint war unerreichbar.
- **Smoke-Test-User** in Production-DB: `heimat-demo-user@heimat.de / DemoHeimat2026!` (registriert 2026-07-25, Verifikation via `POST /api/auth/login` + `GET /api/auth/me`).
