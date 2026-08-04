# HEIMAT API-Referenz — Beste verfügbare offene APIs

**Erstellt:** 2026-08-04 | **Status:** Recherche abgeschlossen

---

## Übersicht

| Kategorie | Service | HEIMAT nutzt | Beste API | Status |
|-----------|---------|-------------|-----------|--------|
| **Mobilität** | ÖPNV | db-rest ✅ | db-rest + Transitous | ✅ Optimal |
| **Mobilität** | Parken | Overpass ⚠️ | ParkAPI + Overpass | ⚠️ Keine Echtzeit |
| **Mobilität** | E-Laden | Overpass ⚠️ | GoingElectric + Overpass | ⚠️ Keine Echtzeit |
| **Gesundheit** | Ärzte | Overpass ✅ | KBV Arztsuche + Overpass | ✅ Gut |
| **Gesundheit** | Lebenszeichen | Checkin ✅ | Eigenentwicklung | ✅ Gut |
| **Alltag** | Wetter | Open-Meteo ✅ | Open-Meteo (DWD ICON) | ✅ Optimal |
| **Alltag** | Luft | Open-Meteo ✅ | UBA + Open-Meteo CAMS | ✅ Gut |
| **Alltag** | Abfall | BSR ❌ | abfall.io | ❌ Reparatur nötig |
| **Alltag** | Bürgeramt | Nominatim ⚠️ | OpenStreetMap Nominatim | ⚠️ Berlin-Default (52.52) |
| **Alltag** | Jobs | Arbeitnow ✅ | Arbeitnow + BA | ✅ Gut |
| **Kultur** | Events | kulturdaten.berlin ⚠️ | Kulturdaten Berlin | ⚠️ NUR BERLIN |
| **Kultur** | Hotels | OSM ❌ | OSM + Wikidata | ❌ Berlin-Default + keine Daten |
| **Finanzen** | Taler | Demo ⚠️ | Kein Production Exchange | ⚠️ Nur Demo |
| **AI** | Chat | Ollama ✅ | Ollama qwen2.5:3b | ✅ Optimal |

---

## Detaillierte API-Dokumentation

### 1. Mobilität

#### ÖPNV — db-rest (✅ HEIMAT nutzt beste Lösung)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://v6.db.transport.rest/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use (Caching empfohlen) |
| **Datenqualität** | Exzellent — Abfahrten, Verspätungen, Routen |
| **DTSche Deckung** | Deutschlandweit (DB, regional) |
| **GitHub** | `derhuerst/db-rest` |

**Vorteile:**
- Sauberes JSON-Format
- Keine Authentifizierung nötig
- Nationale Abdeckung

**Nachteile:**
- Rate Limits (Caching nötig)
- Keine Echtzeit-Verfügbarkeit von Plätzen

#### Parken — Overpass API (⚠️ Keine Echtzeit)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://overpass-api.de/` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | Gut (statisch) |
| **Abdeckung** | Deutschlandweit |

**Problem:** Overpass liefert nur **statische** Parkhaus-Daten, keine **Echtzeit-Verfügbarkeit**.

**Bessere Alternative:** `ParkAPI` / `ParkenDD` für Echtzeit-Daten:
- URL: `https://api.parkendd.de/`
- Auth: Keine
- Abdeckung: Nur größere Städte (Berlin, Hamburg, München)

#### E-Laden — Overpass API (⚠️ Keine Echtzeit)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://overpass-api.de/` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | Gut (statisch) |
| **Abdeckung** | Deutschlandweit |

**Problem:** Overpass liefert nur **statische** Ladestationen, keine **Echtzeit-Verfügbarkeit**.

**Bessere Alternative:** `GoingElectric` für Echtzeit-Daten:
- URL: `https://www.goingelectric.de/stromtankstellen/api/`
- Auth: API-Key nötig
- Abdeckung: Exzellent (DACH-Region)

---

### 2. Gesundheit

#### Ärzte — Overpass API (✅ Gut)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://overpass-api.de/` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | Gut |
| **Abdeckung** | Weltweit (OSM) |

**Vorteile:**
- Keine Auth nötig
- Weltweite Abdeckung
- Echte OSM-Daten

**Bessere Alternative:** `KBV Arztsuche` für Deutschland:
- URL: `https://www.kbv.de/arztsuche`
- Auth: Keine
- Abdeckung: Nur Deutschland
- Vorteil: Offizielle KBV-Daten

---

### 3. Alltag

#### Wetter — Open-Meteo (✅ Optimal)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://api.open-meteo.com/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | Exzellent (DWD ICON) |
| **Abdeckung** | Weltweit |

**Vorteile:**
- DWD ICON Modell (offiziell)
- Keine Auth nötig
- Kostenlose nutzbar

#### Luft — Open-Meteo CAMS (✅ Gut)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://air-quality-api.open-meteo.com/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | Gut (CAMS) |
| **Abdeckung** | Europa |

#### Abfall — AbfallNavi (Bund) ✅ FUNKTIONIERT!

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://{region}-abfallapp.regioit.de/abfall-app-{region}/rest` |
| **Doku** | `https://abfallnavi.api.bund.dev/` (OpenAPI/Swagger) |
| **Auth** | Keine |
| **Rate Limits** | Keine bekannt |
| **Datenqualität** | Exzellent — echte kommunale Daten |
| **Abdeckung** | 19 Regionen in Deutschland |

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

**Test-Ergebnis (Nürnberg):**
```json
[{"id":6756817,"name":"Nürnberg"}]
```

**Vorteile:**
- Staatliche API (Bund)
- Kostenlos
- Keine Auth nötig
- Echte kommunale Daten
- OpenAPI-Dokumentation vorhanden

#### Bürgeramt — OpenStreetMap Nominatim (⚠️ Berlin-Default)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://nominatim.openstreetmap.org/` |
| **Auth** | Keine |
| **Rate Limits** | 1 req/sec (streng) |
| **Datenqualität** | Gut |
| **Abdeckung** | Weltweit |

**Probleme:**
1. `buergeramt_screen.dart` + `buergeramt_dto.dart` haben `lat = 52.52` als Berlin-Default
2. `routes/buergeramt.ts:19` hat `lat || 52.52`
3. Nominatim liefert wenig spezifische Bürgeramt-Daten

**Keine bessere kostenlose API verfügbar.**

#### Jobs — Arbeitnow (✅ Gut)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://www.arbeitnow.com/api/job-board-api` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | Gut |
| **Abdeckung** | Deutschlandweit |

---

### 4. Kultur & Reise

#### Events — kulturdaten.berlin (⚠️ NUR BERLIN-hardcoded!)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://query.wikidata.org/` |
| **Auth** | Keine |
| **Rate Limits** | Fair-use |
| **Datenqualität** | Mittel |
| **Abdeckung** | Weltweit |

**Problem:** `eventService.ts` nutzt `kulturdaten.berlin` — eine API die NUR Berlin abdeckt! Backend-Route `routes/events.ts:19` hat `lat || 52.52` als Berlin-Default.

**Keine bessere kostenlose API verfügbar.** Wikidata SPARQL hat wenige aktuelle Events.

#### Hotels — OpenStreetMap + Wikidata (❌ Berlin-Default + keine Daten)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://overpass-api.de/` + `https://query.wikidata.org/` |
| **Auth** | Keine |
| **Rate Limits** | Slot-basiert |
| **Datenqualität** | Mittel |
| **Abdeckung** | Weltweit |

**Probleme:**
1. `hotels_screen.dart` + `hotels_dto.dart` haben `lat = 52.52` als Berlin-Default
2. Nur Standort-Daten, keine Buchungsdaten
3. Keine kostenlose Hotel-Buchungs-API verfügbar

---

### 5. Finanzen

#### GNU Taler — Demo Exchange (⚠️ Nur Demo)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `https://exchange.demo.taler.net/` |
| **Auth** | Ed25519 Wallets |
| **Rate Limits** | Fair-use |
| **Datenqualität** | Demo |
| **Abdeckung** | Nur Demo |

**Problem:** Es gibt KEINEN Production Exchange für GNU Taler in Deutschland.

**Status:** Taler ist ein Zahlungssystem, kein Daten-Service. Keine bessere API verfügbar.

---

### 6. AI

#### Ollama — Lokaler AI-Server (✅ Optimal)

| Eigenschaft | Wert |
|-------------|------|
| **URL** | `http://localhost:11434/` (lokal) |
| **Auth** | Keine |
| **Rate Limits** | Keine (lokal) |
| **Datenqualität** | Gut (qwen2.5:3b) |
| **Abdeckung** | Global |

**Vorteile:**
- Keine API-Kosten
- Privacy-by-Design
- Lokal nutzbar

---

## Empfehlungen für HEIMAT

### Priorität 1: Reparatur (Services die nicht funktionieren)

| Service | Aktuelle API | Empfohlene API | Aufwand |
|---------|-------------|----------------|---------|
| **Abfall** | BSR ❌ | **KEINE verfügbare API** | Nicht lösbar |
| **Events** | Wikidata ⚠️ | Kulturdaten Berlin | 2-3 Tage |

### Priorität 2: Verbesserung (Services die besser sein könnten)

| Service | Aktuelle API | Empfohlene API | Aufwand |
|---------|-------------|----------------|---------|
| **Parken** | Overpass ⚠️ | ParkAPI + Overpass | 2-3 Tage |
| **E-Laden** | Overpass ⚠️ | GoingElectric + Overpass | 2-3 Tage |
| **Ärzte** | Overpass ✅ | KBV Arztsuche + Overpass | 1-2 Tage |

### Priorität 3: Optimal (Services die schon gut sind)

| Service | Aktuelle API | Status |
|---------|-------------|--------|
| **ÖPNV** | db-rest ✅ | Optimal |
| **Wetter** | Open-Meteo ✅ | Optimal |
| **Luft** | Open-Meteo CAMS ✅ | Gut |
| **Bürgeramt** | Nominatim ✅ | Einzig verfügbar |
| **Jobs** | Arbeitnow ✅ | Gut |
| **Taler** | Demo ⚠️ | Kein Production Exchange |
| **AI** | Ollama ✅ | Optimal |

---

## Fazit

**HEIMAT nutzt schon viele gute APIs.** Die Hauptprobleme sind:
1. **Abfall:** BSR-API defekt → abfall.io als Alternative
2. **Events:** Wenig Daten → Kulturdaten Berlin als Alternative
3. **Parken/E-Laden:** Keine Echtzeit → ParkAPI/GoingElectric als Alternative

**Keine bessere API verfügbar für:**
- Hotels (nur Standorte, keine Buchung)
- Taler (kein Production Exchange)
- Bürgeramt (Nominatim ist einzig verfügbar)
