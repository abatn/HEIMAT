# HEIMAT 2.0 — Architektur-Diagramme

> **Stand:** 2026-07-27 | **Letzter Commit:** `5c69ea6`
> Diese Datei wird von GitHub nativ als Mermaid-Diagramm gerendert.
> [Mermaid Documentation](https://mermaid.js.org/)

---

## 1. Systemübersicht (C4 Level 1)

```mermaid
flowchart TB
    subgraph Frontend["🎨 Präsentation (GitHub Pages)"]
        F1["Flutter Web 3.24.5"]
        F2["abatn.github.io/HEIMAT/"]
        F3["5 Tabs: Dashboard 🏠 | Mobilität 🚇 | Finanzen 💰 | Gesundheit 🏥 | Apps 📱"]
        F4["Provider-Pattern | ChangeNotifier | HTTP-Client"]
    end

    subgraph Backend["⚙️ API-Schicht (Render.com Free)"]
        B0["Express 5 · Node.js 20"]
        B1["Middleware: Helmet · CORS · Rate-Limit · JWT · Zod"]
        B2["Services: Auth · Mobility · Finance · Health · Weather · AirQuality · AI · Admin"]
        B3["Startup: Auto-Migration · DB-Connect · RAPTOR (opt-in)"]
    end

    subgraph Data["🗄️ Datenquellen"]
        D1["Supabase PostgreSQL<br/>16 Tabellen · 24 Indizes"]
        D2["OpenStreetMap<br/>Overpass · Nominatim · OSRM"]
        D3["Open-Meteo<br/>DWD Wetter · CAMS Luftqualität"]
        D4["Transitous.org<br/>MOTIS 2 Routing"]
        D5["GNU Taler<br/>Exchange · Demo-Bank"]
    end

    Frontend -->|HTTPS · CORS · JSON| Backend
    Backend -->|TCP/IP · SQL| D1
    Backend -->|HTTP · ODbL| D2
    Backend -->|HTTP · CC-BY| D3
    Backend -->|HTTP · AGPL| D4
    Backend -->|HTTP · GPL| D5
```

---

## 2. Provider-Struktur (Klassendiagramm)

```mermaid
classDiagram
    class AuthProvider {
        +bool isAuthenticated
        +String? token
        +User? user
        +init()
        +login(email, password)
        +register(email, password, name)
        +logout()
    }

    class HomeProvider {
        +DashboardContext? context
        +Location? location
        +int nearbyStops
        +int nearbyDoctors
        +loadDashboard()
        +recordAction(action)
        +_fetchContext()
        +_fetchNearbySummary(lat, lng)
    }

    class MobilityProvider {
        +List~Stop~ stops
        +List~Departure~ departures
        +Journey? journey
        +loadNearbyStops(lat, lng)
        +searchStops(query)
        +loadDepartures(stopId)
        +loadJourney(from, to)
    }

    class FinanceProvider {
        +Wallet? wallet
        +List~Transaction~ transactions
        +double balance
        +initWallet()
        +loadWallet()
        +sendMoney(to, amount)
        +requestFundLocal(amount)
    }

    class HealthProvider {
        +List~Doctor~ doctors
        +List~Appointment~ appointments
        +searchDoctors(specialty, location)
        +bookAppointment(doctorId, date, time)
        +getAppointments()
    }

    class MiniProgramProvider {
        +List~MiniProgram~ programs
        +launchProgram(program)
        +filterByCategory(category)
        +searchPrograms(query)
    }

    AuthProvider --> HomeProvider : recordAction()
    AuthProvider --> FinanceProvider : token for JWT
    HomeProvider --> MobilityProvider : onNavigateTab()
    HomeProvider --> FinanceProvider : onNavigateTab()
    HomeProvider --> HealthProvider : onNavigateTab()
```

---

## 3. Datenfluss: Dashboard (Sequenzdiagramm)

```mermaid
sequenceDiagram
    actor User as 👤 User
    participant DS as Dashboard Screen
    participant HP as HomeProvider
    participant LS as Location Service
    participant API as Backend API
    participant DB as Supabase DB

    User->>DS: App öffnen
    DS->>HP: loadDashboard()
    HP->>LS: getCurrentLocation()
    LS-->>HP: {lat, lng}

    par Schritt 2: Dashboard Context
        HP->>API: GET /api/ai/home
        API-->>HP: {greeting, suggestions, quickActions}
    and Schritt 3: Nearby Counts
        HP->>API: GET /api/mobility/stops?lat=&lng=1000
        API->>DB: Overpass Query
        DB-->>API: {count, nearest}
        API-->>HP: stops count
        HP->>API: GET /api/health/doctors/nearby
        API-->>HP: doctors count
    end

    HP-->>DS: DashboardContext {stats, actions, suggestions}
    DS-->>User: UI rendern

    User->>DS: Klickt Quick Action
    DS->>HP: recordAction('mobility')
    HP->>API: POST /api/ai/home/personalized
    API->>API: BayesClassifier klassifiziert
    API-->>HP: personalisierte Suggestions
    DS->>DS: onNavigateTab(tabIndex)
```

---

## 4. Datenfluss: Wetter + Luftqualität (Mini-Program)

```mermaid
sequenceDiagram
    actor User as 👤 User
    participant Apps as Apps-Tab
    participant IFrame as MiniProgramContainer
    participant HTML as weather.html / air.html
    participant API as Backend API
    participant OM as Open-Meteo
    participant Nomi as Nominatim

    User->>Apps: Klickt 🌤️ Wetter / 🌬️ Luft
    Apps->>IFrame: src = /mini/weather.html
    IFrame->>HTML: Lädt im IFrame

    HTML->>HTML: navigator.geolocation.getCurrentPosition()
    alt Erfolg
        HTML-->>HTML: lat, lng
    else Fehler / Timeout
        HTML-->>HTML: Fallback Berlin (52.52, 13.405)
    end

    HTML->>API: fetch(/api/weather/forecast?lat=X&lng=Y)
    API->>API: Cache prüfen (5 Min)
    alt Cache Hit
        API-->>API: Cached-Daten verwenden
    else Cache Miss
        API->>OM: GET /v1/forecast?latitude=X&longitude=Y
        OM-->>API: JSON (current + hourly + daily)
        API->>Nomi: reverse?lat=X&lon=Y
        Nomi-->>API: Ortsname (z.B. "Berlin")
    end
    
    API-->>HTML: {status, location, current, hourly, daily}
    HTML->>HTML: UI rendern (Temperatur/AQI)
    HTML-->>User: Sieht Wetterkarte / AQI-Ring

    Note over HTML,User: Gleiches Pattern für Luftqualität<br/>/api/air-quality/forecast → CAMS Copernicus
```

---

## 5. CI/CD Pipeline

```mermaid
flowchart LR
    GIT["📦 Git Push → main"] --> CHECK{"Welche Dateien geändert?"}
    
    CHECK -->|src/backend/**| BC["Backend CI"]
    CHECK -->|src/mobile/**| FC["Flutter CI"]
    CHECK -->|Nur *.md| SKIP["⏭️ Kein CI-Trigger (nur Doku)"]
    
    subgraph BC_PIPELINE["Backend CI"]
        direction TB
        B1["1. lint (ESLint)"]
        B2["2. test (Jest)\nPostgres 15 Docker"]
        B3["3. tsc --noEmit"]
        B1 --> B2 --> B3
    end
    
    BC --> BC_PIPELINE
    BC_PIPELINE -->|grün| RD["Render Auto-Deploy"]
    
    subgraph FC_PIPELINE["Flutter CI"]
        direction TB
        F1["1. dart format --set-exit-if-changed"]
        F2["2. flutter analyze --no-fatal-infos"]
        F3["3. flutter test"]
        F1 --> F2 --> F3
    end
    
    FC --> FC_PIPELINE
    
    subgraph DEPLOY["Deploy Web"]
        direction TB
        D1["flutter build web --release\n--base-href /HEIMAT/"]
        D2["→ GitHub Pages"]
        D1 --> D2
    end
    
    FC_PIPELINE -->|grün| DEPLOY
    
    subgraph RENDER["Render Auto-Deploy"]
        direction TB
        R1["1. npm install --include=dev"]
        R2["2. npm run build (tsc)"]
        R3["3. node dist/scripts/migrate.js\n(Auto-Migration)"]
        R4["4. node dist/index.js\n(Server-Start)"]
        R1 --> R2 --> R3 --> R4
    end
    
    RD --> RENDER
    RENDER -->|LIVE ✅| URL["heimat-backend.onrender.com"]
    DEPLOY -->|LIVE ✅| GH["abatn.github.io/HEIMAT/"]
```

---

## 5b. Datenfluss: Health AI Agent (Symptom-Assessment + Triage)

```mermaid
sequenceDiagram
    actor User as 👤 User
    participant Phone as 📱 On-Device (TFLite)
    participant API as Backend API
    participant Ollama as 🦙 Ollama Server
    participant Overpass as 🌍 Overpass API

    User->>Phone: "Ich habe Rückenschmerzen"

    Note over Phone: Schritt 1: On-Device (<10ms)
    Phone->>Phone: Notfall-Keyword-Detection
    Phone->>Phone: KEIN Notfall → Symptom-Kategorie: Orthopädie

    Note over Phone: Kein Notfall → Backend-Anfrage
    Phone->>API: POST /api/ai/chat
    API->>Ollama: promptService + Symptom-Kontext

    Note over Ollama: Schritt 2: Adaptives Gespräch
    Ollama-->>User: "Seit wann haben Sie Rückenschmerzen?"
    User->>Ollama: "Seit 3 Tagen, Schmerz 4/10"
    Ollama-->>User: "Strahlung in die Beine?"
    User->>Ollama: "Nein, nur im unteren Rücken"

    Note over Ollama: Schritt 3: Triage
    Ollama->>Ollama: Routine (kein Notfall, kein Bereitschaft)

    Note over Ollama: Schritt 4: Arzt-Empfehlung
    Ollama->>API: fetchHealthData(lat, lng)
    API->>Overpass: Orthopäden in der Nähe?
    Overpass-->>API: 3 Orthopäden gefunden
    API-->>Ollama: Ärzte-Daten (JSON, kein Fertigtext)

    Note over Ollama: Schritt 5: Antwort generieren
    Ollama-->>User: "Bei Rückenschmerzen ist ein Orthopäde die richtige Wahl. Ich habe 3 Orthopäden in Ihrer Nähe gefunden: Dr. Müller (1.2km)... Soll ich die Adresse zeigen?"

    Note over User: Haftungsausschluss eingeblendet
    Note right of User: "Keine medizinische Diagnose.
    Note right of User: Bei Unsicherheit 112 wählen."
```

---

## 6. Backend-Middleware-Stack

```mermaid
flowchart TB
    REQ["🌐 HTTP Request"] --> H["1. helmet<br/>Sicherheits-Header"]
    H --> CORS["2. cors<br/>origin = CORS_ORIGIN || *"]
    CORS --> RL["3. rateLimit<br/>100 req / 15 Min"]
    RL --> J["4. express.json<br/>Limit: 10 MB"]
    J --> COMP["5. compression<br/>GZip-Kompression"]
    COMP --> MOR["6. morgan<br/>Request-Logging"]
    
    MOR --> ROUTE{"7. Router"}

    ROUTE -->|"/api/auth/*"| AUTH["Auth Service<br/>JWT · bcryptjs"]
    ROUTE -->|"/api/mobility/*"| MOB["Mobility Service<br/>Overpass · Transitous"]
    ROUTE -->|"/api/finance/*"| FIN["Finance Service<br/>Taler Exchange · DB"]
    ROUTE -->|"/api/health/*"| HLT["Health Service<br/>Overpass · DB-Termine"]
    ROUTE -->|"/api/weather/*"| WTH["Weather Service<br/>Open-Meteo DWD"]
    ROUTE -->|"/api/air-quality/*"| AIR["AirQuality Service<br/>Open-Meteo CAMS"]
    ROUTE -->|"/api/ai/*"| AI["AI Service<br/>Dashboard · BayesClassifier"]
    ROUTE -->|"/api/admin/*"| ADM["Admin Service<br/>ADMIN_KEY geschützt"]
    ROUTE -->|"/mini/*"| STAT["Static Files<br/>Mini-Programme (HTML)"]
    ROUTE -->|"/docs"| SWA["Swagger UI<br/>API-Dokumentation"]
    ROUTE -->|"/health"| HTH["Health Check<br/>DB-Ping"]
    
    AUTH --> RESP["📨 JSON Response"]
    MOB --> RESP
    FIN --> RESP
    HLT --> RESP
    WTH --> RESP
    AIR --> RESP
    AI --> RESP
    ADM --> RESP
    STAT --> RESP
    SWA --> RESP
    HTH --> RESP
    
    RESP --> NF["8. notFoundHandler (404)"]
    NF --> ERR["9. errorHandler (500)"]
    ERR --> OUT["🌐 HTTP Response"]
```

---

## 7. Mini-Programm-Launcher

```mermaid
flowchart TB
    subgraph LAUNCHER["📱 MiniProgramLauncherScreen"]
        SEARCH["🔍 Suche"] --> FILTER["📂 Kategorie-Filter<br/>Alle · Alltag · Mobilität · Kultur · Services"]
        FILTER --> GRID["2-Spalten Grid<br/>10 Mini-Programm-Karten"]
    end

    subgraph REGISTRY["📋 Registry (10 Programme)"]
        direction TB
        P1["1. 💬 Futai Chat<br/>⏳ Phase D"]
        P2["2. 🌤️ Wetter ✅ Live<br/>→ /mini/weather.html"]
        P3["3. 🌬️ Luftqualität ✅ Live<br/>→ /mini/air.html"]
        P4["4. 📰 Events ⏳"]
        P5["5. 💼 Job-Suche ⏳"]
        P6["6. 🔌 E-Ladestationen ⏳"]
        P7["7. 🗑️ Abfallkalender ⏳"]
        P8["8. 🏨 Hotels ⏳"]
        P9["9. 🅿️ Parken ⏳"]
        P10["10. 🏛️ Bürgeramt ⏳"]
    end

    subgraph VIEWER["🖼️ MiniProgramContainer"]
        direction TB
        CROSS["Cross-Plattform"]
        WEB["🌐 Web: IFrameElement<br/>→ HtmlElementView"]
        MOB["📱 Mobile: Stub<br/>(webview_flutter später)"]
        URL["URL-Leiste + Bottom Sheet"]
    end

    GRID -->|"Klick auf Programm"| VIEWER
    VIEWER -->|"src = program.url"| HTML["Standalone HTML<br/>z.B. weather.html"]
    HTML -->|"fetch(/api/...)"| BACKEND["Backend API"]
    BACKEND -->|"JSON"| RENDER["HTML rendert Daten"]

    REGISTRY -.->|"data source"| GRID
```

---

## 8. Tabellen-Struktur (ER-Diagramm)

```mermaid
erDiagram
    users ||--o{ wallets : "hat"
    users ||--o{ appointments : "macht"
    wallets ||--o{ transactions : "sendet/empfängt"
    wallets ||--o{ reserves : "eröffnet"
    reserves ||--o{ reserve_history : "wird geändert"
    doctors ||--o{ doctor_slots : "hat"
    doctor_slots ||--o{ appointments : "wird gebucht"
    stops ||--o{ gtfs_stop_match : "matched"
    gtfs_stops ||--o{ gtfs_stop_match : "matched"
    gtfs_routes ||--o{ gtfs_trips : "hat"
    gtfs_trips ||--o{ gtfs_stop_times : "hat"
    gtfs_stops ||--o{ gtfs_stop_times : "referenziert"
    gtfs_stops ||--o{ gtfs_transfers : "von/nach"

    users {
        int id PK
        string email UK
        string password_hash
        string display_name
        datetime created_at
    }

    wallets {
        int id PK
        int user_id FK
        string wallet_priv UK
        string exchange_base_url
        datetime created_at
    }

    transactions {
        int id PK
        int from_wallet FK
        int to_wallet FK
        decimal amount
        string currency
        datetime created_at
    }

    doctors {
        int id PK
        string name
        string specialty
        string address
        float lat
        float lng
        string phone
    }

    gtfs_stops {
        string stop_id PK
        string name
        float lat
        float lng
        string zone_id
    }

    gtfs_stop_times {
        string trip_id FK
        string stop_id FK
        time arrival
        time departure
        int sequence
    }
```

---

## 9. Deployment-Topologie

```mermaid
graph TB
    DEV["👨‍💻 Git Push main"] --> GH["🐙 GitHub.com/abatn/HEIMAT"]

    subgraph CI_CD["🔁 CI/CD Pipeline (GitHub Actions)"]
        BC["Backend CI<br/>Lint + Test + Typecheck"]
        FC["Flutter CI<br/>Format + Analyze + Test"]
        DW["Deploy Web<br/>flutter build → gh-pages"]
    end

    GH --> BC
    GH --> FC
    FC --> DW
    
    DW --> GHPAGES["📡 GitHub Pages<br/>abatn.github.io/HEIMAT/"]
    
    BC --> RD["🚀 Render Auto-Deploy"]

    subgraph RENDER_HOST["☁️ Render.com Free Tier"]
        direction TB
        BUILD["Build:<br/>npm install → tsc → migrate"]
        RUN["Runtime:<br/>node dist/index.js<br/>Port 10000"]
        STARTUP["Startup:<br/>DB-Connect + Auto-Migration<br/>RAPTOR (opt-in)"]
        BUILD --> RUN
        RUN --> STARTUP
    end

    RD --> RENDER_HOST

    subgraph EXTERNAL["🌍 Externe Dienste"]
        SUPABASE["Supabase PostgreSQL<br/>aws-0-eu-west-1.pooler.supabase.com:5432"]
        OSM["OpenStreetMap<br/>Overpass · Nominatim"]
        OPENMETEO["Open-Meteo<br/>Wetter + Luftqualität"]
        TRANSITOUS["Transitous.org<br/>MOTIS 2 ÖPNV-Routing"]
        TALER["GNU Taler<br/>Exchange + Demo-Bank"]
    end

    GHPAGES -->|Browser → HTTPS| RENDER_HOST
    RENDER_HOST -->|Supavisor Pooler| SUPABASE
    RENDER_HOST -->|HTTP| OSM
    RENDER_HOST -->|HTTP| OPENMETEO
    RENDER_HOST -->|HTTP| TRANSITOUS
    RENDER_HOST -->|HTTP| TALER
```
