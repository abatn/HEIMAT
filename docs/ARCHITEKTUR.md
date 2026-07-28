# HEIMAT 2.0 — Systemarchitektur

> **Stand:** 2026-07-27 | **Letzter Commit:** `5c69ea6`
> **Ziel:** Vollständige Dokumentation der Systemarchitektur, Datenflüsse und Komponenten.
> **Lizenz:** AGPL v3

---

## 1. Systemübersicht

### 1.1 Drei-Schichten-Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                  1. PRÄSENTATION (Flutter Web)               │
│                                                              │
│  GitHub Pages: https://abatn.github.io/HEIMAT/              │
│  -------------------------------------------------          │
│  [Dashboard🏠] [Mobilität🚇] [Finanzen💰] [Gesundheit🏥] [Apps📱] │
│       Provider-Pattern | ChangeNotifier | Http-Client        │
│       Location API | Cache | SharedPreferences               │
└──────────────────────────────────┬───────────────────────────┘
                                   │ HTTPS (CORS)
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                  2. API-SCHICHT (Node.js Express)            │
│                                                              │
│  Render.com: https://heimat-backend.onrender.com            │
│  -------------------------------------------------          │
│  Middleware: Helmet | CORS | Rate-Limit | JWT-Auth | Zod    │
│  Services: Weather | AI | Taler | Mobility | Health | Admin │
│  Startup: Auto-Migration | RAPTOR (opt-in) | DB-Connect     │
└──────────────────────────────────┬───────────────────────────┘
                                   │ TCP/IP
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                  3. DATEN-QUELLEN                            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Supabase │  │ Overpass │  │ Open-    │  │ transitous  │  │
│  │ Postgres │  │ API      │  │ Meteo    │  │ .org        │  │
│  │ (16 Tab) │  │ (OSM)    │  │ (DWD)    │  │ (MOTIS 2)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │
│       │              │                            │          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Taler    │  │ Nomina-  │  │ OSRM     │  │ GNU Taler   │  │
│  │ Exchange │  │ tim      │  │ Routing  │  │ Demo Bank   │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment-Infrastruktur

| Komponente | Technologie | Hosting | URL |
|------------|------------|---------|-----|
| **Frontend** | Flutter Web (3.24.5) | GitHub Pages | `https://abatn.github.io/HEIMAT/` |
| **Backend** | Node.js 20 + Express 5 | Render.com (Free) | `https://heimat-backend.onrender.com` |
| **Datenbank** | PostgreSQL 15 | Supabase (Free) | `aws-0-eu-west-1.pooler.supabase.com:5432` |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | Backend-intern | — |
| **CI/CD** | GitHub Actions | GitHub | — |

---

## 2. Flutter-App (Frontend)

### 2.1 Provider-Struktur

```
main.dart
  │
  ├── AuthProvider (ChangeNotifier)
  │     ├── init() → SharedPreferences lesen
  │     ├── login(email, password) → POST /api/auth/login
  │     ├── register(email, password, name) → POST /api/auth/register
  │     └── logout() → SharedPreferences löschen
  │
  ├── HomeProvider (ChangeNotifier)
  │     ├── loadDashboard() → GET /api/ai/home + Location + Nearby
  │     ├── recordAction(action) → POST /api/ai/home/personalized
  │     ├── _fetchContext() → Backend oder lokaler Fallback
  │     └── _fetchNearbySummary(lat, lng) → Stops + Doctors zählen
  │
  ├── MobilityProvider (ChangeNotifier)
  │     ├── loadNearbyStops(lat, lng) → Overpass
  │     ├── searchStops(query) → Nominatim
  │     ├── loadDepartures(stopId) → transitous/db-rest
  │     └── loadJourney(from, to) → transitous/RAPTOR
  │
  ├── FinanceProvider (ChangeNotifier)
  │     ├── initWallet() → POST /api/finance/taler/wallet
  │     ├── loadWallet() → GET /api/finance/wallet
  │     ├── loadTransactions() → GET /api/finance/transactions
  │     ├── sendMoney(to, amount) → POST /api/finance/send
  │     └── [REMOVED 2026-07-27 per Phase R] POST /api/finance/taler/fund-local → HTTP 410 Gone
  │     └── openReserve() → POST /api/finance/taler/reserve/open (echter Reserve-Adresse-Flow, Source-of-Truth fuer Wallet-Funding)
  │
  ├── HealthProvider (ChangeNotifier)
  │     ├── searchDoctors(specialty, location) → Overpass + DB
  │     ├── bookAppointment(doctorId, date, time) → POST
  │     └── getAppointments() → GET /api/health/appointments
  │
  └── MiniProgramProvider (ChangeNotifier)
        ├── 10 Standard-Mini-Programme (Registry)
        ├── filterByCategory(category)
        └── searchPrograms(query)
```

### 2.2 Navigation (Tab-Struktur)

```
MainScreen (BottomNavigationBar)
  │
  ├── Index 0: Dashboard 🏠 (HomeScreen)
  │     ├── Greeting-Card (Tageszeit-basiert)
  │     ├── Stat-Karten (Haltestellen/Ärzte/KUDOS → klickbar)
  │     ├── Quick Actions (Route/Arzt/KUDOS/Nähe → Tab-Wechsel)
  │     └── AI-Vorschläge (kontextualisiert → Tab-Wechsel)
  │
  ├── Index 1: Mobilität 🚇 (MobilityScreen)
  │     ├── Karte mit Haltestellen (MapLibre)
  │     ├── Routenplanung (Start→Ziel)
  │     ├── Abfahrtszeiten (Echtzeit)
  │     └── Haltestellen-Suche
  │
  ├── Index 2: Finanzen 💰 (FinanceScreen)
  │     ├── Wallet-Balance (Gradient-Karte)
  │     ├── Geld senden (P2P)
  │     ├── Guthaben aufladen (25 Demo-KUDOS oder Reserve)
  │     └── Transaktionshistorie
  │
  ├── Index 3: Gesundheit 🏥 (HealthScreen)
  │     ├── Fachrichtungs-Filter (Chip-UI)
  │     ├── Arzt-Karten (Name, Fachrichtung, Adresse)
  │     └── Terminbuchung (Bottom Sheet)
  │
  └── Index 4: Apps 📱 (MiniProgramLauncherScreen)
        ├── Suche + Kategorie-Filter (Pillen)
        ├── 2-Spalten-Grid mit 10 Mini-Programmen
        └── Viewer (IFrame mit URL-Leiste + Bottom Sheet)
              └── Wetter 🌤️ → weather.html (DWD)
```

### 2.3 Dashboard-Datenfluss (Detail)

```
HomeScreen.initState()
  │
  └── HomeProvider.loadDashboard()
        │
        ├── Schritt 1: LocationService.getCurrentLocation()
        │     → navigator.geolocation (Browser-API)
        │     → Speichert _currentLocation
        │
        ├── Schritt 2: _fetchContext() ODER _fetchPersonalizedContext()
        │     │
        │     ├── Wenn _recentActions leer:
        │     │   GET /api/ai/home (nicht personalisiert)
        │     │   → aiHomeService.getDashboardContext()
        │     │
        │     └── Wenn Aktionen vorhanden:
        │         POST /api/ai/home/personalized
        │         Body: { recentActions: [...] }
        │         → aiHomeService.getPersonalizedContext(actions)
        │           → BayesClassifier klassifiziert jede Aktion
        │           → Dominant-Intent ermitteln
        │           → Zeit-basierte + Intent-Vorschläge mischen
        │           → Quick Actions bleiben IMMER Standard-4
        │
        └── Schritt 3: _fetchNearbySummary(lat, lng)
              │
              ├── GET /api/mobility/stops?lat=&lng=&radius=1000
              │     → stops count + nearest stop name
              │
              └── GET /api/health/doctors/nearby?lat=&lng=&radius=5000
                    → doctors count

Fehlerfall (Backend offline):
  → _generateLocalContext() (100% clientseitig)
  → 4 Standard-Quick Actions + Tageszeit-Vorschläge
```

---

## 3. Backend (Express API)

### 3.1 Vollständige Routen-Tabelle

| Methode | Pfad | Middleware | Service | Externe API |
|---------|------|-----------|---------|-------------|
| `GET` | `/` | — | — | — |
| `GET` | `/health` | — | DB-Ping | Supabase |
| `GET` | `/health/ready` | — | DB + Redis | Supabase |
| `POST` | `/api/auth/register` | Zod | AuthService | Supabase users |
| `POST` | `/api/auth/login` | Zod | AuthService | Supabase users |
| `GET` | `/api/auth/me` | `requireAuth` | AuthService | Supabase users |
| `PUT` | `/api/auth/profile` | `requireAuth` + Zod | AuthService | Supabase users |
| `PUT` | `/api/auth/password` | `requireAuth` + Zod | AuthService | bcryptjs |
| `GET` | `/api/mobility/stops` | — | MobilityService | Overpass API |
| `GET` | `/api/mobility/stops/:id` | — | MobilityService | Overpass API |
| `GET` | `/api/mobility/stops/search` | — | MobilityService | Nominatim |
| `GET` | `/api/mobility/departures` | — | MobilityService | transitous.org |
| `GET` | `/api/mobility/journey` | — | RAPTOR/Mobility | transitous.org |
| `GET` | `/api/finance/wallet` | `requireAuth` | FinanceService | Supabase |
| `POST` | `/api/finance/taler/wallet` | `requireAuth` | TalerService | exchange.demo.taler.net |
| `POST` | `/api/finance/send` | `requireAuth` + Zod | FinanceService | Supabase |
| `GET` | `/api/finance/transactions` | `requireAuth` | FinanceService | Supabase |
| `POST` | `/api/finance/taler/reserve/open` | `requireAuth` | TalerService | exchange.demo.taler.net |
| `POST` | `/api/finance/taler/fund-local` | `requireAuth` | FinanceService (REMOVED Phase R 2026-07-27) | HTTP 410 Gone (Code-Gone für Mock-Removal per User-Regel) |
| `GET` | `/api/finance/taler/status` | `requireAuth` | TalerService | exchange.demo.taler.net |
| `GET` | `/api/health/doctors` | Zod | HealthService | Overpass + Supabase |
| `GET` | `/api/health/doctors/nearby` | Zod | HealthService | Overpass |
| `GET` | `/api/health/doctors/:id` | — | HealthService | Supabase |
| `POST` | `/api/health/doctors` | Zod | HealthService | Supabase |
| `GET` | `/api/health/doctors/:id/slots` | Zod | HealthService | Supabase |
| `POST` | `/api/health/appointments` | Zod | HealthService | Supabase |
| `GET` | `/api/health/appointments/:name` | — | HealthService | Supabase |
| `PUT` | `/api/health/appointments/:id/cancel` | — | HealthService | Supabase |
| `PUT` | `/api/health/appointments/:id/confirm` | — | HealthService | Supabase |
| `POST` | `/api/admin/migrate` | `ADMIN_KEY` | migrate.ts | Supabase |
| `GET` | `/api/admin/gtfs-status` | `ADMIN_KEY` | GtfsService | Supabase |
| `GET` | `/api/ai/home` | — | AiHomeService | — |
| `POST` | `/api/ai/home/personalized` | — | AiHomeService | BayesClassifier |
| `GET` | `/api/weather/current` | — | WeatherService | api.open-meteo.com |
| `GET` | `/api/weather/forecast` | — | WeatherService | api.open-meteo.com |
| `GET` | `/api/weather/status` | — | — | — |
| `GET` | `/api/air-quality/current` | — | AirQualityService | api.open-meteo.com (CAMS) |
| `GET` | `/api/air-quality/forecast` | — | AirQualityService | api.open-meteo.com (CAMS) |
| `GET` | `/api/air-quality/status` | — | — | — |
| `GET` | `/api/waste/calendar` | Zod (lat, lng, weeks, street, houseNr) | WasteService | BSR/AWB/SRH iCal, Mil-München mirror |
| `GET` | `/api/waste/status` | — | — | — |
| `GET` | `/mini/*` | CSP-Header | Static Files | — |
| `GET` | `/docs` | — | Swagger UI | — |
| `GET` | `/docs.json` | — | Swagger Spec | — |

### 3.2 Middleware-Stapel (Reihenfolge)

```
1. helmet
2. cors({ origin: CORS_ORIGIN || '*' })
3. rateLimit(100 req/15min)
4. express.json(10mb)
5. compression
6. morgan (Request-Logging)
7. ROUTEN
8. notFoundHandler (404)
9. errorHandler (500)
```

### 3.3 Services-Übersicht

| Service | Datei | Aufgaben |
|---------|-------|----------|
| **WeatherService** | `services/weatherService.ts` | Open-Meteo DWD-Client, 5-Min-Cache, 429-Retry, Nominatim Reverse-Geocode |
| **AiHomeService** | `services/aiHomeService.ts` | Dashboard-Context (Tageszeit/Vorschläge/Quick Actions), Personalisierung via BayesClassifier |
| **AiService** | `services/aiService.ts` | BayesClassifier mit deutschem Stemmer, Intent-Erkennung (journey/departure/disruption/nearby/info) |
| **TalerService** | `services/talerService.ts` | GNU Taler Exchange Client, Reserve-Erstellung, Wallet-Bindung, dynamische Currency |
| **FinanceService** | `services/financeService.ts` | Wallet-CRUD, Transaktionen, Purse-System, fund-local |
| **MobilityService** | `services/mobilityService.ts` | Overpass-Stops, Nominatim-Geocoding, OSRM-Routing, transitous-Departures |
| **HealthService** | `services/healthService.ts` | Overpass-Ärzte, DB-Arzt-Registrierung, Terminbuchung, Slots |
| **AuthService** | `services/authService.ts` | JWT-Generierung/Verifikation, bcryptjs-Passwort-Hashing, User-CRUD |
| **GtfsService** | `services/gtfsService.ts` | GTFS-Daten-Status, Stop-Suche, Routen-Query |
| **RaptorService** | `services/raptorService.ts` | RAPTOR-Routing-Engine (In-Memory, opt-in via ENABLE_RAPTOR) |
| **AirQualityService** | `services/airQualityService.ts` | Open-Meteo CAMS-Client, 5-Min-Cache, 429-Retry, EAQI-Level mit Farben, Nominatim Reverse-Geocode |
| **DisruptionAgent** | `services/disruptionAgent.ts` | Störungsmeldungen analysieren |
| **PersonalRoutingAgent** | `services/personalRoutingAgent.ts` | Personalisierte Routenvorschläge |

---

## 4. Mini-Programm-Architektur

### 4.1 IFrame-basiertes WebView-Framework

```
MiniProgramLauncherScreen
  │
  ├── MiniProgramProvider (Registry mit 10 Programmen)
  │     ├── Kategorien: Alltag, Mobilität, Social, Services
  │     ├── Suche (nach Name/Kategorie)
  │     └── Filter (Pill-UI)
  │
  └── MiniProgramContainer (Cross-Plattform)
        │
        ├── WEB (dart:html):
        │     IFrameElement → HtmlElementView
        │     src = MiniProgram.url (Backend /mini/*)
        │
        └── MOBILE (Stub):
              Leeres Container-Widget
              (Mobile-Unterstützung später via webview_flutter)
```

### 4.2 Registrierte Mini-Programme

| # | Name | Icon | Kategorie | URL (Backend) | Phase | Status |
|---|------|------|-----------|---------------|-------|--------|
| 1 | 💬 Futai | `chat` | Social | extern | D | ⏳ |
| 2 | 🌤️ **Wetter** | `weather` | **Alltag** | **`/mini/weather.html`** | **B** | **✅ Live** |
| 3 | 🌬️ **Luftqualität** | `air` | **Alltag** | **`/mini/air.html`** | **B** | **✅ Live** |
| 4 | 📰 Events | `events` | Alltag | — | D | ⏳ |
| 5 | 💼 Jobs | `work` | Alltag | — | D | ⏳ |
| 6 | 🔌 E-Ladestationen | `ev_charging` | Mobilität | — | C | ⏳ |
| 7 | 🗑️ Abfall | `trash` | Alltag | — | B | ⏳ |
| 8 | 🏨 Hotels | `hotel` | Services | — | E | ⏳ |
| 9 | 🅿️ Parken | `parking` | Mobilität | — | C | ⏳ |
| 10 | 🏛️ Bürgeramt | `city_hall` | Services | — | E | ⏳ |

### 4.3 Wetter-Mini-Programm (Datenfluss)

```
User klickt auf 🌤️ Wetter im Apps-Tab
  │
  ├── MiniProgramContainer öffnet IFrame
  │     └── src = https://heimat-backend.onrender.com/mini/weather.html
  │
  └── weather.html (Client-seitig)
        │
        ├── 1. navigator.geolocation.getCurrentPosition()
        │     → Erfolg: lat, lng
        │     → Fehler: Fallback Berlin (52.52, 13.405)
        │
        ├── 2. fetch(/api/weather/forecast?lat=X&lng=Y)
        │     │
        │     └── Backend (weather.ts → WeatherService)
        │           │
        │           ├── Cache-Prüfung (5 Min TTL)
        │           │
        │           ├── fetchAll(lat, lng) → api.open-meteo.com
        │           │     ├── current: Temperatur, Feuchte, Wind, UV
        │           │     ├── hourly: 24h (Temperatur, Niederschlag)
        │           │     └── daily: 7 Tage (Max/Min, Regen, Wind)
        │           │
        │           ├── reverseGeocode(lat, lng) → Nominatim
        │           │     → Ortsname (z.B. "Berlin")
        │           │
        │           └── JSON-Antwort: {status, location, current, hourly, daily}
        │
        └── 3. HTML rendert
              ├── Aktuelle Temperatur + Wetter-Icon 🏠
              ├── Details: Wind, Feuchte, Niederschlag
              ├── 24h-Stunden-Scroll (horizontal)
              └── 7-Tage-Vorhersage (vertikale Liste)
```

### 4.4 Luftqualität-Mini-Programm (Datenfluss)

```
User klickt auf 🌬️ Luftqualität im Apps-Tab
  │
  ├── MiniProgramContainer öffnet IFrame
  │     └── src = https://heimat-backend.onrender.com/mini/air.html
  │
  └── air.html (Client-seitig)
        │
        ├── 1. navigator.geolocation.getCurrentPosition()
        │     → Erfolg: lat, lng
        │     → Fehler: Fallback Berlin (52.52, 13.405)
        │
        ├── 2. fetch(/api/air-quality/forecast?lat=X&lng=Y)
        │     │
        │     └── Backend (airQuality.ts → AirQualityService)
        │           │
        │           ├── Cache-Prüfung (5 Min TTL)
        │           │
        │           ├── fetchAll(lat, lng) → air-quality-api.open-meteo.com
        │           │     ├── current: EAQI, PM10, PM2.5, NO₂, O₃, CO, SO₂
        │           │     └── hourly: 24h (EAQI, PM10, PM2.5, NO₂, O₃)
        │           │
        │           ├── reverseGeocode(lat, lng) → Nominatim
        │           │     → Ortsname (z.B. "Berlin")
        │           │
        │           └── JSON-Antwort: {status, location, current, hourly}
        │
        └── 3. HTML rendert
              ├── AQI-Ring (SVG-Gauge mit Farbe)
              ├── EAQI-Wert + Level-Text (Sehr gut → Gefährlich)
              ├── Schadstoff-Grid (PM10, PM2.5, NO₂, O₃)
              ├── Gesundheitshinweis (kontextabhängig)
              └── 24h-AQI-Verlauf (horizontal scrollend)
```

---

## 5. Datenbank (Supabase PostgreSQL)

### 5.1 Tabellen (16 Stück, 24 Indizes)

| Tabelle | Zweck | Spalten |
|---------|-------|---------|
| `users` | Auth | id, email, password_hash, display_name, created_at |
| `wallets` | Taler-Wallets | id, user_id, wallet_priv, exchange_base_url, created_at |
| `transactions` | Transaktionslog | id, from_wallet, to_wallet, amount, currency, created_at |
| `reserves` | Taler-Reserven | id, user_id, reserve_pub, balance, status, created_at |
| `reserve_history` | Reserve-Änderungen | id, reserve_id, balance_delta, reason, created_at |
| `doctors` | Ärzte | id, name, specialty, address, lat, lng, phone, email |
| `doctor_slots` | Termin-Slots | id, doctor_id, date, time, is_booked |
| `appointments` | Termine | id, slot_id, patient_name, patient_email, status |
| `stops` | Haltestellen (Cache) | id, name, lat, lng, type |
| `gtfs_stops` | GTFS-Haltestellen | stop_id, name, lat, lng, zone_id |
| `gtfs_routes` | GTFS-Linien | route_id, short_name, long_name, type, color |
| `gtfs_trips` | GTFS-Fahrten | trip_id, route_id, headsign, direction_id |
| `gtfs_stop_times` | GTFS-Zeiten | trip_id, stop_id, arrival, departure, sequence |
| `gtfs_calendar` | GTFS-Kalender | service_id, days, start_date, end_date |
| `gtfs_transfers` | GTFS-Transfers | from_stop_id, to_stop_id, transfer_type |
| `gtfs_stop_match` | OSM↔GTFS-Mapping | overpass_osm_id, gtfs_stop_id, match_score |

### 5.2 Verbindungskonfiguration

```yaml
DB_HOST: aws-0-eu-west-1.pooler.supabase.com   # Supavisor Pooler
DB_PORT: 5432
DB_NAME: postgres
DB_USER: postgres.sqbiqzwkcryhcyvftumb
DB_SSL: true
# Supavisor bridged Render Free Tier (IPv4) → Supabase (IPv6-only)
# family:4 (IPv4-Force) im pg-Pool konfiguriert
```

---

## 6. CI/CD Pipeline

### 6.1 Workflow-Trigger

```
Git Push → main
  │
  ├── src/backend/** geändert?
  │     → Backend CI
  │       ├── lint (ESLint 10)
  │       ├── test (Jest, Postgres 15 Docker)
  │       └── tsc --noEmit (Typecheck)
  │
  ├── src/mobile/** geändert?
  │     → Flutter CI
  │     │ ├── dart format --set-exit-if-changed .
  │     │ ├── flutter analyze --no-fatal-infos
  │     │ ├── flutter test
  │     │ └── flutter build web (optional, für Deploy)
  │     │
  │     └── Deploy Web
  │           └── flutter build web --release --base-href "/HEIMAT/"
  │               → GitHub Pages
  │
  └── Immer (Backend-Code geändert)
        → Render Auto-Deploy
          ├── npm install --include=dev
          ├── npm run build (tsc)
          ├── preDeploy: node dist/scripts/migrate.js (Auto-Migration)
          └── node dist/index.js (Server-Start)
```

### 6.2 CI-Häufige Fehler

| Fehler | Ursache | Fix |
|--------|---------|-----|
| `dart format` Exit 1 | Unformatierter Dart | `dart format lib/ test/` vor Commit |
| `flutter analyze` Error | `withValues()` statt `withOpacity()` | Flutter 3.24.5: `withOpacity()` verwenden |
| `tsc --noEmit` Error | `aioRouter` statt `aiRouter` | Variablenname korrigieren |
| Render 502 | Supabase IPv6 + Render IPv4 | Supavisor Pooler + `family:4` |
| Render Heap OOM | RAPTOR-Init >500MB | `ENABLE_RAPTOR=true` nur auf Standard Tier |

---

### 6.3 Abfallkalender URL-Discovery (Phase B-2.3)

> **⚠️ WICHTIG: Berlin (BSR) iCal Deprecation**
> Die BSR hat ihren öffentlichen statischen `.ics`-Placeholder abgeschaltet (HTTP 404) und durch eine REST JSON-API (`https://umnewforms.bsr.de/p/de.bsr.adressen.app/abfuhrEvents?addrKey=<schedule-id>&dateFrom=<iso>&dateTo=<iso>`) ersetzt. Diese API erfordert einen proprietären `AddrKey` (Adress-Hash), der nicht trivial aus Geodaten ableitbar ist.
> *Status:* Berlin ist derzeit ungelöst. Ein dezidierter BSR-JSON-Client + AddrKey-Resolver wird in **Phase B-2.4** benötigt (Standard-iCal-Parser greift nicht).

**Gültige URL-Konfigurationen (Produktion):**

| Stadt | Primary | Fallback | Status |
|-------|---------|----------|--------|
| **München (AWB)** | `https://raw.githubusercontent.com/mil-muenchen/muenchen-abfallkalender/main/muenchen.ics` (Community-Spiegel) | nur via `ABFALL_AWB_FALLBACK_URL` env-var | ✅ GitHub-MIT; CC-BY 4.0 (AWB Daten-Aggregat) |
| **Hamburg (SRH)** | `ABFALL_SRH_PRIMARY_URL` (env-var-only) | `ABFALL_SRH_FALLBACK_URL` (env-var-only) | ⚠️ Keine öffentliche URL bekannt — Operator-Pflicht |
| **Berlin (BSR)** | `ABFALL_BSR_PRIMARY_URL` (env-var-only) | `ABFALL_BSR_FALLBACK_URL` (env-var-only) | ❌ Static-iCal 404 — JSON-REST-Adapter in B-2.4 |

**Deployment-Owner-Action (Phase B-2.3):**
- München: Default-URL in `wasteService.ts` ist bereits Community-Mirror — kein Render-env-var nötig für Live-Gang.
- Hamburg: operator-discovered URL per `ABFALL_SRH_PRIMARY_URL` setzen, sonst 422 'address_required' als Best-Effort.
- Berlin: BSR-JSON-Adapter (AddrKey reverse-geocode → JSON-Parse → iCal-Converter) implementieren in Phase B-2.4.

---

## 7. Externe APIs & Lizenzen

| API | Zweck | Lizenz | Auth |
|-----|-------|--------|------|
| `overpass-api.de` | OSM-Daten (Stops, Doctors) — Primär | ODbL | Kein Token |
| `overpass.kumi.systems` | Overpass-Mirror 1 (Fallback) | ODbL | Kein Token |
| `maps.mail.ru/osm/tools/overpass` | Overpass-Mirror 2 (Fallback) | ODbL | Kein Token |
| `nominatim.openstreetmap.org` | Geocoding | CC-BY | User-Agent |
| `router.project-osrm.org` | Routing (Fuß/Auto) | BSD | Kein Token |
| `transitous.org` | ÖPNV-Routing (MOTIS 2) | AGPL | Kein Token |
| `api.open-meteo.com` | DWD-Wetterdaten | CC-BY 4.0 | Kein Token |
| `exchange.demo.taler.net` | GNU Taler Exchange | GPL | Ed25519 |
| `bank.demo.taler.net` | Taler Demo-Bank | GPL | Login |
| `api.open-meteo.com` (Air Quality) | CAMS-Copernicus-Luftqualität | CC-BY 4.0 | Kein Token |

---

## 8. Sicherheitskonzept

| Bereich | Maßnahme | Status |
|---------|----------|--------|
| **Passwörter** | bcryptjs | ✅ Live |
| **Auth** | JWT (jsonwebtoken, 7d Ablauf) | ✅ Live |
| **Admin** | `ADMIN_KEY` env var (kein Default) | ✅ Live |
| **Rate-Limit** | 100 req/15min global | ✅ Live |
| **CORS** | `CORS_ORIGIN || '*'` (konfigurierbar) | ✅ Live |
| **Helmet** | CSP, X-Frame, Cross-Origin | ✅ Live |
| **Schema** | `AUTO_MIGRATE` startup-hook, POST /api/migrate → 404 | ✅ Live |
| **API-Docs** | Swagger: nur Lese-Zugriff, kein Auth | ✅ Live |

---

## 9. Aktueller Feature-Status (27.07.2026)

### 9.1 Produktion ✅ Live

| Feature | Tab | Seit | Letzter Fix |
|---------|-----|------|-------------|
| Auth (Register/Login/Logout) | — | 2026-07-25 | `9c8deb7` Routing-Bug |
| Mobilität (Karte/Routen/Stops) | 1 | MVP | `e00105d` |
| Finanzen (Wallet/Senden/Aufladen) | 2 | 2026-07-25 | `cfb0561` JWT-Header |
| Gesundheit (Ärzte/Termine) | 3 | MVP | `f389001` UX |
| Dashboard (Greeting/Stats/Actions) | 0 | 2026-07-27 | `8aad85f` Quick-Actions-Fix |
| Mini-Program-Container | 4 | 2026-07-27 | `92ec307` |
| Wetter (DWD/Open-Meteo) | 4→Apps | 2026-07-27 | `0d75f1f` 429-Retry |
| Luftqualität (CAMS Copernicus) | 4→Apps | 2026-07-27 | `5c69ea6` Phase B |
| Abfallkalender (BSR/AWB/SRH) | 4→Apps (ab B-3 native) | 2026-07-27 | `e0a4f61` Phase B-3 (Mobile-UI) |
| Demo-KUDOS (fund-local) | 2 | 2026-07-26 | — |
| CI/CD (3 Workflows) | — | 2026-07-27 | `246ece3` withOpacity-Fix |

### 9.2 Noch nicht gebaut

| Feature | Phase | Grund |
|---------|-------|-------|
| E-Ladestationen | C | Nicht priorisiert |
| Parken | C | Nicht priorisiert |
| Futai Chat | D | Wartet auf React Native Web-Build |
| Job-Suche | D | Nicht priorisiert |
| Veranstaltungen | D | Nicht priorisiert |
| Hotels | E | Nicht priorisiert |
| Bürgeramt | E | Nicht priorisiert |
| EUR-Taler (GLS Bank) | — | Extern blockiert (kein öffentlicher Exchange) |
| RAPTOR GTFS-Routing | — | Opt-in, Feed-Import nur lokal |
| Flutter Integration-Tests | — | In Arbeit (auth_gate_test.dart Schritt 1/5) |

---

## 10. Letzte Commits (in Reihenfolge)

| Commit | Datum | Änderung |
|--------|-------|----------|
| `d6a7f3f` | 2026-07-27 | Doku: HANDOFF + bauplan (Quick-Actions-Fix, Dashboard-Navi, Phase B) |
| `88f8937` | 2026-07-27 | Doku: heimat-plan (Quick-Actions-Fix) |
| `04acf6f` | 2026-07-27 | Doku: AGENTS, knowledge, README (Quick-Actions-Fix + Wetter-Status) |
| `8aad85f` | 2026-07-27 | **Fix: Quick-Actions-Flicker** (intentQuickActions entfernt) |
| `d7cdb0c` | 2026-07-27 | Doku: Pipeline-Logik + Dashboard-Navi + Phase B |
| `4fcb0ac` | 2026-07-27 | Fix: dart format indentation |
| `bd04e2b` | 2026-07-27 | **Fix: Dashboard-Navigation** (onNavigateTab-Callback) |
| `5c69ea6` | 2026-07-27 | **Phase B: Luftqualität** (airQualityService + air.html + airQualityRoute) |
| `4b91019` | 2026-07-27 | **Phase B-2: Abfallkalender Backend** (wasteService + routes + city-resolver + iCal-Parser + 24h-Cache) |
| `e0a4f61` | 2026-07-27 | **Phase B-3: Abfallkalender Mobile-UI** (WasteProvider + WasteScreen + ServiceRegistry) |
| `528bf63` | 2026-07-27 | **Fix: Waste Express-5 req.query Coerce** (parseFloat/parseInt in handler) |
| `9e42a30` | 2026-07-27 | **Phase B: Wetter-Mini-Programm** (weatherService + weather.html) |
| `92ec307` | 2026-07-27 | **Phase A: Mini-Program-Container** (10 Programme + Apps-Tab) |
