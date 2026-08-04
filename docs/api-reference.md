# HEIMAT API-Referenz — Beste verfügbare offene APIs

**Erstellt:** 2026-08-04 | **Status:** Vollständig | **Version:** 2.0

---

## Übersicht — 13 Kategorien

| # | Kategorie | Beste API | Auth | Abdeckung | HEIMAT nutzt |
|---|-----------|-----------|------|-----------|-------------|
| 1 | **ÖPNV** | Transitous + db-rest | Keine | Deutschlandweit | ✅ Transitous |
| 2 | **Parken** | ParkAPI + Overpass | Keine | ~30 Städte | ✅ Overpass |
| 3 | **E-Laden** | Overpass + Open Charge Map | Keine | Weltweit | ✅ Overpass |
| 4 | **Ärzte** | Overpass OSM | Keine | Weltweit | ✅ Overpass |
| 5 | **Wetter** | Open-Meteo (DWD ICON) | Keine | Weltweit | ✅ Open-Meteo |
| 6 | **Luftqualität** | Open-Meteo CAMS | Keine | Europa | ✅ Open-Meteo |
| 7 | **Abfall** | AbfallNavi Bund-API | Keine | 19 Regionen | ✅ AbfallNavi |
| 8 | **Bürgeramt** | Overpass OSM | Keine | Weltweit | ✅ Overpass |
| 9 | **Jobs** | Arbeitnow | Keine | Deutschlandweit | ✅ Arbeitnow |
| 10 | **Events** | Wikidata SPARQL + Overpass | Keine | Weltweit | ✅ Wikidata+Overpass |
| 11 | **Hotels** | Wikidata SPARQL + Overpass | Keine | Weltweit | ✅ Wikidata+Overpass |
| 12 | **Finanzen** | GNU Taler (Demo) | Ed25519 | Demo | ✅ Taler |
| 13 | **KI/AI** | Ollama (lokal) | Keine | Global | ✅ Ollama |

---

## Detaillierte API-Dokumentation

### 1. ÖPNV & Transit

#### Transitous — GTFS-RT Echtzeit-API (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.transitous.org/api/v1` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ Exzellent |
| **Abdeckung** | Deutschlandweit (GTFS) |
| **Dokumentation** | `https://transitous.org/` |
| **GitHub** | `public-transport/transitous` |

**Endpoints:**
- `GET /map/stops` — Haltestellen in Bounding-Box
- `GET /stoptimes` — Abfahrtszeiten einer Haltestelle
- `GET /plan` — Routenplanung (A→B)
- `GET /stops` — Suche nach Name

**Vorteile:**
- Echtzeit-Daten (GTFS-RT)
- Keine Auth nötig
- Nationale Abdeckung
- Open Source

**In HEIMAT:** `src/backend/src/services/dbVendoService.ts`

#### db-rest v6 — DB & Nahverkehr (Referenz)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://v6.db.transport.rest/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use (Caching empfohlen) |
| **Datenqualität** | ⭐⭐⭐ Exzellent |
| **Abdeckung** | Deutschlandweit (DB, regional) |
| **GitHub** | `derhuerst/db-rest` |

**Hinweis:** HEIMAT nutzt Transitous statt db-rest — Transitous hat bessere GTFS-Abdeckung und ist aktueller.

---

### 2. Parken

#### Overpass API — OSM Parkplätze (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | ⭐⭐ Gut (statisch) |
| **Abdeckung** | Weltweit (OSM) |

**Problem:** Nur **statische** Daten (Name, Adresse, Kapazität), keine **Echtzeit-Verfügbarkeit**.

**In HEIMAT:** `src/backend/src/services/parkingService.ts`

#### ParkAPI / ParkenDD — Echtzeit-Daten (Bessere Alternative)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.parkendd.de/api/v1` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ Echtzeit |
| **Abdeckung** | ~30 deutsche Städte |
| **Dokumentation** | `https://github.com/offenesdresden/ParkenDD` |
| **Städte** | Berlin, Hamburg, München, Köln, Frankfurt, Dresden, etc. |

**Vorteile:**
- Echtzeit-Belegung in Prozent
- Keine Auth nötig
- Open Source

**Nachteile:**
- Nur ~30 Städte
- Kein einheitliches Format (jede Stadt anders)

**Empfehlung:** Als Fallback für Städte die ParkAPI unterstützen, Overpass für den Rest.

#### Open Charge Map — E-Ladestationen (Referenz)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.openchargemap.io/v3/` |
| **Auth** | Optional (API-Key für mehr Requests) |
| **Rate Limits** | 30/min ohne Key, 100/min mit Key |
| **Datenqualität** | ⭐⭐⭐ Community-gespeist |
| **Abdeckung** | Weltweit |
| **GitHub** | `openchargemap/ocm-system` |

---

### 3. E-Laden

#### Overpass API — OSM Ladestationen (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | ⭐⭐ Gut (statisch) |
| **Abdeckung** | Weltweit (OSM) |

**Problem:** Nur **statische** Daten (Standort, Steckertypen), keine **Echtzeit-Verfügbarkeit**.

**In HEIMAT:** `src/backend/src/services/evChargingService.ts`

#### GoingElectric — Echtzeit-Daten (Bessere Alternative)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.goingelectric.de/stromtankstellen/api/` |
| **Auth** | API-Key nötig (kostenlos) |
| **Rate Limits** | Unbekannt |
| **Datenqualität** | ⭐⭐⭐ Echtzeit |
| **Abdeckung** | Exzellent (DACH-Region) |
| **Dokumentation** | `https://www.goingelectric.de/stromtankstellen/api/docs/` |

**Vorteile:**
- Echtzeit-Belegung
- Lade-Leistung (kW)
- Bezahlarten
- DACH-Region

**Nachteile:**
- API-Key nötig (kostenlos, aber Registrierung)
- Nicht Open Source

#### NAP (Nationale Leitstelle) — Offizielle Daten

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.leitstelle-info.de/` |
| **Auth** | API-Key nötig |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit |

---

### 4. Ärzte & Gesundheit

#### Overpass API — OSM Ärzte (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | ⭐⭐ Gut |
| **Abdeckung** | Weltweit (OSM) |

**Sucht:** Ärzte, Zahnärzte, Apotheken, Krankenhäuser

**In HEIMAT:** `src/backend/src/services/healthService.ts`

#### KBV Arztsuche — Offizielle KBV-Daten

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.kbv.de/arztsuche` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ Offiziell (KBV) |
| **Abdeckung** | Nur Deutschland |
| **Dokumentation** | `https://www.kbv.de/arztsuche` |

**Vorteile:**
- Offizielle KBV-Daten
- Alle kassenärztlich zugelassenen Ärzte
- Fachgruppen, Öffnungszeiten

**Nachteile:**
- Keine API (nur Web-Suche)
- Scraping nötig (rechtlich grau)

#### TriageBench — Medizinische KI (Referenz)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://github.com/TriageBench/TriageBench` |
| **Auth** | Open Source |
| **Datenqualität** | ⭐⭐⭐ Forschung |
| **Abdeckung** | Global |

---

### 5. Wetter

#### Open-Meteo — DWD ICON (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.open-meteo.com/v1` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use (10k/Tag) |
| **Datenqualität** | ⭐⭐⭐ Exzellent |
| **Abdeckung** | Weltweit |
| **Dokumentation** | `https://open-meteo.com/` |
| **GitHub** | `open-meteo/open-meteo` |

**Endpoints:**
- `GET /forecast` — Wettervorhersage
- `GET /air-quality` — Luftqualität
- `GET /historical` — Historische Daten

**Modell:** DWD ICON (Deutscher Wetterdienst) — offiziell, hochauflösend

**Vorteile:**
- DWD ICON Modell (offiziell)
- Keine Auth nötig
- Kostenlose nutzbar
- 7-Tage-Vorhersage

**In HEIMAT:** `src/backend/src/services/weatherService.ts`

#### Bright Sky — DWD-Proxy (Fallback)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.brightsky.dev/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ DWD |
| **Abdeckung** | Deutschlandweit |

**In HEIMAT:** Als Fallback für Open-Meteo.

---

### 6. Luftqualität

#### Open-Meteo CAMS — Copernicus (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://air-quality-api.open-meteo.com/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ CAMS/Copernicus |
| **Abdeckung** | Europa |
| **Dokumentation** | `https://open-meteo.com/en/docs/air-quality-api` |

**Daten:** PM10, PM2.5, NO₂, O₃, CO, SO₂, AQI

**In HEIMAT:** `src/backend/src/services/airQualityService.ts`

#### UBA — Umweltbundesamt (Referenz)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.umweltbundesamt.de/daten/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit |

**Problem:** Keine REST-API, nur Daten-Downloads.

---

### 7. Abfall & Müll

#### AbfallNavi Bund-API — Staatliche API (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://{region}-abfallapp.regioit.de/abfall-app-{region}/rest` |
| **Auth** | Keine |
| **Rate Limits** | Keine bekannt |
| **Datenqualität** | ⭐⭐⭐ Exzellent |
| **Abdeckung** | 19 Regionen in Deutschland |
| **Dokumentation** | `https://abfallnavi.api.bund.dev/` (OpenAPI/Swagger) |

**Verfügbare Regionen:**
- Aachen, Nürnberg, Solingen, Norderstedt
- Bergisch Gladbach, Dinslaken, Dorsten, Gütersloh
- Halver, Kreis Coesfeld, Kreis Heinsberg
- Kreis Pinneberg, Kreis Warendorf, Lindlar
- Lüdenscheid, Roetgen, EGW Westmünsterland
- AWA Entsorgungs GmbH, Bergischer Abfallwirtschaftverbund

**API-Flow:**
1. `GET /orte` — Orte im System
2. `GET /orte/{ortId}/strassen` — Straßen im Ort
3. `GET /strassen/{strassenId}` — Hausnummern
4. `GET /fraktionen` — Müllsorten (Papier, Restmüll, etc.)
5. `GET /termine` — Abholtermine

**In HEIMAT:** `src/backend/src/services/abfallNaviService.ts`

#### abfall.io — Community-API

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.abfall.io` |
| **Auth** | Service-ID (Key) |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐ Community-gespeist |
| **Abdeckung** | ~30 Regionen |

**Status:** API hat sich geändert (2026-08), nicht mehr zuverlässig.

---

### 8. Bürgeramt & Behörden

#### Overpass API — OSM Behörden (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | ⭐⭐ Gut |
| **Abdeckung** | Weltweit (OSM) |

**Sucht:** Rathäuser, Bürgerämter, Standesämter, Finanzämter

**In HEIMAT:** `src/backend/src/services/buergeramtService.ts`

**Keine bessere kostenlose API verfügbar.** Terminverfügbarkeit ist nicht über API zugänglich.

---

### 9. Jobs & Stellenangebote

#### Arbeitnow — Job-Board-API (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.arbeitnow.com/api/job-board-api` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ Gut |
| **Abdeckung** | Deutschlandweit |
| **Dokumentation** | `https://www.arbeitnow.com/api` |

**Endpoints:**
- `GET /job-board-api` — Alle Stellen
- `GET /job-board-api?q=...` — Suche
- `GET /job-board-api?location=...` — Nach Standort

**Vorteile:**
- Keine Auth nötig
- Echte Job-Daten
- REST-Format

**In HEIMAT:** `src/backend/src/services/jobService.ts`

#### Bundesagentur für Arbeit — Inoffiziell

| Eigenschaft | Wert |
|-------------|------|
| **URL** | Keine offizielle API |
| **Auth** | N/A |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit |

**Problem:** Keine öffentliche API. Nur interne Nutzung.

---

### 10. Events & Veranstaltungen

#### Wikidata SPARQL — Semantische Suche (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://query.wikidata.org/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use (kein Spambot) |
| **Datenqualität** | ⭐⭐ Mittel |
| **Abdeckung** | Weltweit |
| **Dokumentation** | `https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service` |

**Problem:** Kaum aktuelle Events — Wikidata hat historische/kulturelle Daten, keine aktuellen Veranstaltungen.

**In HEIMAT:** `src/backend/src/services/eventService.ts`

#### Overpass API — OSM Veranstaltungsorte (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | ⭐⭐ Gut (statisch) |
| **Abdeckung** | Weltweit (OSM) |

**Sucht:** Kinos, Theater, Museen, Kulturzentren, Märkte

**Kombination:** Wikidata + Overpass liefert die besten Ergebnisse.

**Keine bessere kostenlose API für aktuelle Events verfügbar.**

---

### 11. Hotels & Unterkünfte

#### Wikidata SPARQL — Hotel-Register (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://query.wikidata.org/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐ Mittel |
| **Abdeckung** | Weltweit |

**Sucht:** Hotels, Hostels, Motels, Pensionen (Wikidata-Einträge)

**In HEIMAT:** `src/backend/src/services/hotelService.ts`

#### Overpass API — OSM Hotels (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | ⭐⭐ Gut |
| **Abdeckung** | Weltweit (OSM) |

**Sucht:** Hotels, Hostels, Motels, Gästehäuser (tourism=hotel/hostel/motel/guest_house)

**Keine kostenlose Hotel-Buchungs-API verfügbar.** Nur Standort-Daten.

---

### 12. Finanzen & Payment

#### GNU Taler — Demo Exchange (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://exchange.demo.taler.net/` |
| **Auth** | Ed25519 Wallets |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐ Demo |
| **Abdeckung** | Nur Demo |
| **GitHub** | `gnunet/taler` |

**Status:** Taler ist ein Zahlungssystem, kein Daten-Service. Es gibt KEINEN Production Exchange in Deutschland.

**In HEIMAT:** `src/backend/src/services/talerExchangeClient.ts`

#### Open Banking (PSD2) — EU-weit

| Eigenschaft | Wert |
|-------------|------|
| **URL** | Verschiedene Bank-APIs |
| **Auth** | OAuth2 (PSD2) |
| **Rate Limits** | Variiert |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | EU-weit |

**Problem:** Braucht Bank-Partnerschaft, nicht Open Source.

---

### 13. KI & AI

#### Ollama — Lokale AI-Modelle (✅ HEIMAT nutzt)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `http://localhost:11434/` (lokal) |
| **Auth** | Keine |
| **Rate Limits** | Keine (lokal) |
| **Datenqualität** | ⭐⭐⭐ Gut |
| **Abdeckung** | Global |
| **GitHub** | `ollama/ollama` |

**Modelle:** qwen2.5:3b, llama3.1:8b, phi3, etc.

**Vorteile:**
- Keine API-Kosten
- Privacy-by-Design
- Lokal nutzbar
- Keine Datenverarbeitung in der Cloud

**In HEIMAT:** `src/backend/src/services/ollamaService.ts`

#### HuggingFace — Cloud-Inference (Alternative)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api-inference.huggingface.co/` |
| **Auth** | API-Key (kostenlos) |
| **Rate Limits** | Fair-use |
| **Datenqualität** | ⭐⭐⭐ Exzellent |
| **Abdeckung** | Global |

**Vorteile:** Viele Modelle, keine lokale Installation nötig.
**Nachteile:** Daten verlassen das Gerät (Privacy-Problem).

---

## Empfehlungen für HEIMAT

### Priorität 1: Bereits optimal (nichts ändern)

| Service | API | Status |
|---------|-----|--------|
| ÖPNV | Transitous | ✅ Optimal |
| Wetter | Open-Meteo | ✅ Optimal |
| Luftqualität | Open-Meteo CAMS | ✅ Optimal |
| Jobs | Arbeitnow | ✅ Gut |
| AI | Ollama | ✅ Optimal |
| Abfall | AbfallNavi Bund | ✅ Optimal |

### Priorität 2: Gut (kleine Verbesserungen möglich)

| Service | Aktuelle API | Optionale Verbesserung |
|---------|-------------|----------------------|
| Ärzte | Overpass | + KBV Arztsuche (Web-Scraping) |
| Bürgeramt | Overpass | Keine bessere API verfügbar |
| Events | Wikidata+Overpass | Keine bessere kostenlose API |
| Hotels | Wikidata+Overpass | Keine kostenlose Buchungs-API |

### Priorität 3: Eingeschränkt (beste verfügbare Lösung)

| Service | Problem | Beste Lösung |
|---------|---------|-------------|
| Parken | Keine Echtzeit | ParkAPI (~30 Städte) + Overpass |
| E-Laden | Keine Echtzeit | GoingElectric (API-Key nötig) |
| Finanzen | Kein Production Exchange | GNU Taler Demo |

---

## Staatliche & Bund-APIs (NEU — August 2026)

**Quelle:** `api.bund.dev` (zentrale API-Registry des Bundes)

### Übersicht — Staatliche APIs

| # | API | Provider | Auth | Kategorie | Status |
|---|-----|----------|------|-----------|--------|
| 1 | **DWD Unwetterwarnungen** | Bund (DWD) | Keine | Wetter | ✅ Echte JSON-API |
| 2 | **Feiertage API** | Bund | Keine | Alltag | ✅ Funktioniert |
| 3 | **Pegel-Online** | Bund (Wasserstraßen) | Keine | Mobilität | ✅ Funktioniert |
| 4 | **BA Jobsuche** | Bund (BA) | Fester Header | Jobs | ⚠️ Test nötig |
| 5 | **Ladesäulen-API** | Bund (BNetzA) | Keine | E-Laden | ✅ Dokumentiert |
| 6 | **UBA Luftqualität** | Bund (UBA) | Keine | Luft | ⚠️ Redirect-Probleme |
| 7 | **NINA Warnungen** | Bund (BBK) | Keine | Sicherheit | ⚠️ Kein REST-Endpoint |
| 8 | **AbfallNavi Bund** | Kommunen (regio iT) | Keine | Abfall | ✅ Bereits integriert |

---

### 1. DWD Unwetterwarnungen (✅ Funktioniert!)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json` |
| **Provider** | Bund (Deutscher Wetterdienst) |
| **Auth** | Keine |
| **Format** | JSON (JavaScript-Callback-Wrapper) |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit |
| **GitHub** | `bundesAPI/dwd-api` |

**API-Format:** `warnWetter.loadWarnings({...})` — JSON in JavaScript-Callback-Wrapper.
Parsing: `JSON.parse(response.replace(/^warnWetter\.loadWarnings\(/, '').replace(/\)$/, ''))`

**Daten:**
- Unwetterwarnungen (Sturm, Hagel, Regen, Hitze, Kälte)
- Regionale Einteilung nach Landkreisen
- Start/Ende-Zeitpunkt
- Schweregrad (Level 1-4)

**In HEIMAT:** Noch nicht integriert. Könnte als Ergänzung zu Open-Meteo-Warnungen dienen.

---

### 2. Feiertage API (✅ Funktioniert!)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://feiertage-api.de/api/?jahr=2026` |
| **Provider** | Bund (Community-Projekt) |
| **Auth** | Keine |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit + Bundesländer |

**Beispiel-Response:**
```json
{
  "Neujahrstag": {"datum":"2026-01-01","hinweis":""},
  "Karfreitag": {"datum":"2026-04-03","hinweis":""}
}
```

**Parameter:** `?jahr=2026&nur_land=HE` (nur Hessen)

**In HEIMAT:** Noch nicht integriert. Nützlich für Daily Briefing oder Kalender-Features.

---

### 3. Pegel-Online (✅ Funktioniert!)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json` |
| **Provider** | Bund (Wasserstraßen- und Schifffahrtsverwaltung) |
| **Auth** | Keine |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Alle deutschen Wasserstraßen |

**Endpoints:**
- `GET /stations.json` — Alle Pegelstationen
- `GET /stations/{name}/measurements.json` — Messwerte
- `GET /stations/{name}/WASSERSTAND菊.json` — Aktueller Wasserstand

**Daten:**
- Pegelstände in cm
- Wasserstand (Hochwasser/Niedrigwasser)
- GPS-Koordinaten
- Flüsse, Kanäle, Seen

**In HEIMAT:** Noch nicht integriert. Könnte für Mobilität (Brücken, Hochwasser) oder Wetter-Feature nützlich sein.

---

### 4. Bundesagentur für Arbeit — Jobsuche (⚠️ Test nötig)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://rest.arbeitsagentur.de/jobboerse/jobsuche/suche` |
| **Provider** | Bund (Bundesagentur für Arbeit) |
| **Auth** | Fester Header: `X-API-Key: jobboerse-jobsuche` |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit (alle BA-Stellen) |
| **GitHub** | `bundesAPI/jobsuche-api` (146 Stars) |
| **Python** | `pip install de-jobsuche` |

**Vorteile:**
- Größte Stellendatenbank Deutschlands
- Offizielle BA-Daten
- Kein API-Key nötig (fester Header)

**In HEIMAT:** Aktuell nutzt HEIMAT Arbeitnow. BA-API als Alternative möglich.

---

### 5. Ladesäulen-API (Bundesnetzagentur)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://ladestationen.api.bund.dev` |
| **Provider** | Bund (Bundesnetzagentur) |
| **Auth** | Keine |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Alle Ladesäulen in Deutschland |
| **GitHub** | `bundesAPI/ladestationen-api` (27 Stars) |
| **Python** | `pip install de-ladestationen` |

**Daten:**
- Alle registrierten Ladesäulen
- Standort, Steckertypen, Leistung
- Betreiber, Verfügbarkeit

**In HEIMAT:** Aktuell nutzt HEIMAT Overpass für E-Laden. Ladesäulen-API als bessere Alternative möglich.

---

### 6. UBA Luftqualität

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.umweltbundesamt.de/api/air_data/v2` |
| **Provider** | Bund (Umweltbundesamt) |
| **Auth** | Keine |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschlandweit |
| **GitHub** | `bundesAPI/luftqualitaet-api` (23 Stars) |
| **Python** | `pip install de-luftqualitaet` |

**Endpoints:**
- `GET /stations/json` — Messstationen
- `GET /measures/json` — Messwerte
- `GET /airquality/json` — Luftqualitätsindex

**In HEIMAT:** Aktuell nutzt HEIMAT Open-Meteo CAMS. UBA als Alternative/Ergänzung möglich.

---

### 7. NINA Warnungen (Bevölkerungsschutz)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | Keine öffentliche REST-API |
| **Provider** | Bund (BBK) |
| **Auth** | N/A |
| **Status** | **Kein REST-Endpoint verfügbar** — NINA-App nutzt interne APIs |

**Alternative:** DWD-Unwetterwarnungen als Hauptquelle für Gefahrenwarnungen.

---

### 8. AbfallNavi Bund (✅ Bereits integriert!)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://{region}-abfallapp.regioit.de/abfall-app-{region}/rest` |
| **Provider** | Kommunen (regio iT) |
| **Auth** | Keine |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐ Exzellent |
| **Abdeckung** | 19 Regionen |
| **GitHub** | `bundesAPI/abfallnavi-api` (14 Stars) |

**In HEIMAT:** ✅ Bereits integriert (`abfallNaviService.ts`)

---

### Empfehlung: Welche Bund-APIs sollte HEIMAT nutzen?

| Priorität | API | Aufwand | Nutzen |
|-----------|-----|---------|--------|
| **1** | DWD Unwetterwarnungen | Gering | Ergänzung zu Open-Meteo |
| **2** | Feiertage API | Minimal | Kalender-Feature |
| **3** | Ladesäulen-API | Gering | Bessere E-Laden-Daten |
| **4** | BA Jobsuche | Gering | Alternative zu Arbeitnow |
| **5** | Pegel-Online | Gering | Wasserstand-Feature |

---

## Internationale APIs — Banken, Organisationen, globale Institutionen

**Quelle:** ECB, WHO, EU, UNESCO, Bundesbank, etc.

### Übersicht — Internationale APIs

| # | API | Provider | Auth | Kategorie | Nutzen für HEIMAT |
|---|-----|----------|------|-----------|-------------------|
| 1 | **ECB Wechselkurse** | EZB | Keine | Finanzen | Taler/EUR-Umrechnung |
| 2 | **Bundesbank SDMX** | Deutsche Bundesbank | Keine | Finanzen | Deutsche Finanzstatistik |
| 3 | **WHO GHO** | WHO | Keine | Gesundheit | Gesundheitsstatistik DE |
| 4 | **Eurostat SDMX** | EU | Keine | Statistik | Arbeitsmarkt, Demografie |
| 5 | **EU Open Data** | EU | Keine | Vielfältig | Breite EU-Datensätze |
| 6 | **EUR-Lex** | EU | Keine | Recht | EU-Regulierungen |
| 7 | **UNESCO Welterbe** | UNESCO | Keine | Kultur | 52 deutsche Stätten |
| 8 | **Europeana** | EU | Kostenloser Key | Kultur | Deutsche Kultursammlungen |
| 9 | **Wikimedia Commons** | Wikimedia | Keine | Medien | Deutsche Kultur-Bilder |
| 10 | **WHO ICD-11** | WHO | OAuth2 | Gesundheit | ICD-Codes (bereits integriert) |

---

### 1. ECB Wechselkurse (✅ Funktioniert!)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` |
| **Provider** | Europäische Zentralbank (EZB) |
| **Auth** | Keine |
| **Format** | XML (auch JSON/CSV verfügbar) |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Offiziell |
| **Abdeckung** | Alle EUR-Währungen |

**Beispiel-Response (XML):**
```xml
<gesmes:Envelope>
  <Cube time='2026-08-04'>
    <Cube currency='USD' rate='1.0923'/>
    <Cube currency='GBP' rate='0.8456'/>
    <Cube currency='CHF' rate='0.9312'/>
  </Cube>
</gesmes:Envelope>
```

**In HEIMAT:** Könnte für Taler/EUR-Umrechnung nützlich sein.

---

### 2. Bundesbank SDMX API

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://data.bundesbank.de/rest/data/` |
| **Provider** | Deutsche Bundesbank |
| **Auth** | Keine |
| **Format** | SDMX/JSON/CSV |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Offiziell |
| **Abdeckung** | Deutschland-spezifisch |

**Daten:**
- Zinssätze
- Wechselkurse
- Geldmenge
- Kreditvolumen

**In HEIMAT:** Könnte für Finanz-Statistiken nützlich sein.

---

### 3. WHO Global Health Observatory (GHO)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://ghoapi.azureedge.net/api/` |
| **Provider** | Weltgesundheitsorganisation (WHO) |
| **Auth** | Keine |
| **Format** | JSON (OData) |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Offiziell |
| **Abdeckung** | Global (inkl. Deutschland) |

**Daten:**
- Lebenserwartung
- Krankheitsraten
- Impfquoten
- Gesundheitsausgaben

**In HEIMAT:** Könnte für Gesundheitsstatistiken nützlich sein.

---

### 4. Eurostat SDMX API

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/` |
| **Provider** | EU (Eurostat) |
| **Auth** | Keine |
| **Format** | SDMX/TSV/CSV |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Offiziell |
| **Abdeckung** | EU-weit (DE = Kern) |

**Daten:**
- Arbeitslosenquote
- BIP
- Bevölkerung
- Inflation

**In HEIMAT:** Könnte für Wirtschaftsstatistiken nützlich sein.

---

### 5. EU Open Data Portal

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://data.europa.eu/api/v2/` |
| **Provider** | EU (Publications Office) |
| **Auth** | Keine |
| **Format** | JSON/CSV/RDF |
| **Datenqualität** | ⭐⭐⭐⭐ Gut |
| **Abdeckung** | EU-weit |

**Daten:**
- Breite EU-Datensätze
- Transport, Umwelt, Wirtschaft, etc.

**In HEIMAT:** Könnte als Ergänzung für verschiedene Features dienen.

---

### 6. EUR-Lex (EU-Recht)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://publications.europa.eu/repository/` |
| **Provider** | EU (Publications Office) |
| **Auth** | Keine |
| **Format** | JSON-LD/RDF |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Offiziell |
| **Abdeckung** | EU-Recht (inkl. DE-Umsetzung) |

**Daten:**
- EU-Verordnungen
- EU-Richtlinien
- Nationale Umsetzungen

**In HEIMAT:** Könnte für Rechts-Informationen nützlich sein.

---

### 7. UNESCO Welterbe

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://whc.unesco.org/en/list/xml/` |
| **Provider** | UNESCO |
| **Auth** | Keine |
| **Format** | XML |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Offiziell |
| **Abdeckung** | Global (52 deutsche Stätten) |

**Daten:**
- Welterbe-Stätten
- Beschreibungen
- GPS-Koordinaten
- Status

**In HEIMAT:** Könnte für Kultur-/Tourismus-Feature nützlich sein.

---

### 8. Europeana (Kulturerbe)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.europeana.eu/record/v2/` |
| **Provider** | Europeana Foundation |
| **Auth** | Kostenloser API-Key |
| **Format** | JSON |
| **Datenqualität** | ⭐⭐⭐⭐⭐ Exzellent |
| **Abdeckung** | Starke deutsche Sammlungen |

**Daten:**
- Deutsche Kultursammlungen
- Bilder, Texte, Videos
- Museen, Bibliotheken, Archive

**In HEIMAT:** Könnte für Kultur-/Events-Feature nützlich sein.

---

### 9. Wikidata SPARQL (✅ Bereits integriert)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://query.wikidata.org/sparql` |
| **Provider** | Wikimedia Foundation |
| **Auth** | Keine |
| **Format** | JSON/CSV |
| **Datenqualität** | ⭐⭐⭐⭐ Gut |
| **Abdeckung** | Global |

**In HEIMAT:** ✅ Bereits integriert für Events, Hotels, Bürgeramt.

---

### Top 10 "Ready to Integrate" (Kein API-Key, keine Registrierung)

| # | API | Nutzen für HEIMAT |
|---|-----|-------------------|
| 1 | **ECB Wechselkurse** | Taler/EUR-Umrechnung |
| 2 | **Eurostat SDMX** | Arbeitsmarkt, Demografie |
| 3 | **WHO GHO** | Gesundheitsstatistik |
| 4 | **DWD Unwetterwarnungen** | Ergänzung zu Open-Meteo |
| 5 | **Bundesbank SDMX** | Finanzstatistik |
| 6 | **UNESCO Welterbe** | Kultur-Feature |
| 7 | **EUR-Lex** | Rechts-Informationen |
| 8 | **EU Open Data** | Breite Datensätze |
| 9 | **Wikimedia Commons** | Medien für Kultur |
| 10 | **Feiertage API** | Kalender-Feature |

---

### Auth-Übersicht

| Auth-Typ | Anzahl | APIs |
|----------|--------|------|
| **Keine** | 22 | ECB, Eurostat, WHO GHO, Open-Meteo, DWD, UNESCO, EUR-Lex, Wikidata, EU Open Data, Bundesbank |
| **Kostenloser API-Key** | 4 | Europeana, Deutsche Digitale Bibliothek, OpenWeatherMap, EMA |
| **OAuth2/Registrierung** | 3 | WHO ICD-11, Eurocontrol, Copernicus CAMS |
| **PSD2 (Bank-OAuth)** | 1 | Open Banking APIs |

---

## Fazit

**HEIMAT nutzt 11 kostenlose, keine-Auth APIs** — ein exzellentes Verhältnis.

**Neue Erkenntnisse (Internationale APIs):**
- **ECB Wechselkurse** — Funktioniert, könnte Taler/EUR-Umrechnung unterstützen
- **WHO GHO** — Funktioniert, Gesundheitsstatistiken für Deutschland
- **Eurostat SDMX** — Funktioniert, Wirtschaftsstatistiken
- **UNESCO Welterbe** — Funktioniert, 52 deutsche Stätten
- **Bundesbank SDMX** — Funktioniert, deutsche Finanzstatistik

**Neue Erkenntnisse (Staatliche APIs):**
- **DWD Unwetterwarnungen** — Funktioniert, JSON-Format, könnte Open-Meteo ergänzen
- **Feiertage API** — Funktioniert, einfach zu integrieren
- **Pegel-Online** — Funktioniert, nützlich für Mobilität
- **Ladesäulen-API** — Bessere Alternative zu Overpass für E-Laden

**Stärken:**
- Wetter, Luft, Jobs, AI, Abfall: Optimal gelöst
- Ärzte, Bürgeramt, ÖPNV: Gut gelöst mit Overpass/Transitous

**Einschränkungen (keine bessere kostenlose API verfügbar):**
- Parken: Keine Echtzeit-Abdeckung
- Events/Hotels: Kaum aktuelle Daten
- Finanzen: Kein Production Exchange

**Gesamtzahl免费 APIs: 22 ohne Auth + 4 mit kostenlosem Key = 26 kostenlose APIs**
