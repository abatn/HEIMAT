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

## Fazit

**HEIMAT nutzt 11 kostenlose, keine-Auth APIs** — ein exzellentes Verhältnis.

**Stärken:**
- Wetter, Luft, Jobs, AI, Abfall: Optimal gelöst
- Ärzte, Bürgeramt, ÖPNV: Gut gelöst mit Overpass/Transitous

**Einschränkungen (keine bessere kostenlose API verfügbar):**
- Parken/E-Laden: Keine Echtzeit-Abdeckung
- Events/Hotels: Kaum aktuelle Daten
- Finanzen: Kein Production Exchange

**Kein Handlungsbedarf** — die gewählten APIs sind die besten verfügbaren kostenlosen Lösungen.
