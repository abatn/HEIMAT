# ortsunabhängige Migration — Alle Services

**Erstellt:** 2026-08-04 | **Status:** Planung | **Version:** v1.0

---

## Problemstellung

6 Services haben Berlin (52.52/13.405) hardcoded und funktionieren NICHT ortsunabhängig:

| Service | Problem | Schweregrad |
|---------|---------|-------------|
| Events | `kulturdaten.berlin` API (nur Berlin) | 🔴 Hoch |
| Hotels | `lat = 52.52` Default + keine Daten | 🔴 Hoch |
| Bürgeramt | `lat = 52.52` Default | 🟡 Mittel |
| Smart Alerts | `lat = 52.52` Default | 🟡 Mittel |
| Daily Briefing | `lat = 52.52` Default | 🟡 Mittel |
| Waste | Nur Berlin/Hamburg/München | 🟡 Mittel |

---

## Architektur-Muster (Referenz)

### ✅ RICHTIG — LocationService-getrieben (Weather, Parking, EV-Charging)

```dart
// weather_provider.dart
final pos = await LocationService.getCurrentLocation().timeout(
  const Duration(seconds: 5),
  onTimeout: () => null,
);
if (pos != null) {
  _lat = pos.latitude;
  _lng = pos.longitude;
}
```

**Prinzip:**
1. `LocationService.getCurrentLocation()` als primäre Quelle
2. `null`-Check vor Nutzung
3. Kein hardcoded Default
4. Fallback: Klare Fehlermeldung "Standort nicht verfügbar"

### ❌ FALSCH — Berlin-Hardcoded (aktuelle Services)

```dart
// events_screen.dart
this.lat = 52.52,   // ← Berlin hardcoded!
this.lng = 13.41,
```

```typescript
// routes/events.ts
const lat = parseFloat(req.query.lat as string) || 52.52;  // ← Berlin fallback!
```

---

## Migrationsplan

### Phase 1: Backend — Lat/Lng Defaults entfernen (1 Tag)

**Ziel:** Alle Backend-Routes erzwingen lat/lng als Pflichtparameter.

| Datei | Änderung | Aufwand |
|-------|----------|---------|
| `routes/events.ts:19-20` | `lat \|\| 52.52` → Pflichtparameter (400 bei fehlend) | 10 Min |
| `routes/smartAlerts.ts:36-37` | `lat \|\| 52.52` → Pflichtparameter | 10 Min |
| `routes/dailyBriefing.ts:78-79` | `lat \|\| 52.52` → Pflichtparameter | 10 Min |
| `routes/search.ts:153-154` | `lat \|\| 52.52` → Pflichtparameter | 10 Min |
| `routes/buergeramt.ts:19-20` | `lat \|\| 52.52` → Pflichtparameter | 10 Min |
| `routes/hotels.ts:19-20` | `lat \|\| 52.52` → Pflichtparameter | 10 Min |

**Code-Muster:**
```typescript
// VORHER:
const lat = parseFloat(req.query.lat as string) || 52.52;

// NACHHER:
const latStr = req.query.lat as string;
if (!latStr || isNaN(parseFloat(latStr))) {
  return res.status(400).json({ 
    error: 'lat als Query-Parameter erforderlich',
    hint: 'Nutze /api/location um GPS-Position zu erhalten'
  });
}
const lat = parseFloat(latStr);
```

**Tests:** Alle bestehenden Tests mit `lat=52.52` weiterhin gültig (sie senden lat explizit).

---

### Phase 2: Flutter — LocationService in alle Screens (2 Tage)

**Ziel:** Alle Screens nutzen `LocationService.getCurrentLocation()` statt hardcoded Defaults.

#### 2a. Events Screen + Provider

| Datei | Änderung |
|-------|----------|
| `events_screen.dart:19-20` | `lat = 52.52` → `lat` als required Parameter |
| `events_screen.dart` initState | `LocationService.getCurrentLocation()` aufrufen |
| `events_provider.dart` | `init()` mit lat/lng parametrisieren |

**Code-Muster:**
```dart
// VORHER:
class EventsScreen extends StatefulWidget {
  final double lat;
  final double lng;
  EventsScreen({this.lat = 52.52, this.lng = 13.41});  // ❌
}

// NACHHER:
class EventsScreen extends StatefulWidget {
  final double? lat;
  final double? lng;
  EventsScreen({this.lat, this.lng});  // ✅ Kein Default
}

// In initState:
@override
void initState() {
  super.initState();
  _loadLocation();
}

Future<void> _loadLocation() async {
  final pos = await LocationService.getCurrentLocation().timeout(
    const Duration(seconds: 5),
    onTimeout: () => null,
  );
  if (pos != null && mounted) {
    setState(() {
      _lat = pos.latitude;
      _lng = pos.longitude;
    });
    _loadEvents();
  }
}
```

#### 2b. Hotels Screen + Provider

| Datei | Änderung |
|-------|----------|
| `hotels_screen.dart:19-20` | `lat = 52.52` → LocationService |
| `hotels_dto.dart:28` | `lat ?? 52.52` → `lat` required |
| `hotels_provider.dart` | `init()` mit lat/lng |

#### 2c. Bürgeramt Screen + Provider

| Datei | Änderung |
|-------|----------|
| `buergeramt_screen.dart:19-20` | `lat = 52.52` → LocationService |
| `buergeramt_dto.dart:28` | `lat ?? 52.52` → `lat` required |
| `buergeramt_provider.dart` | `init()` mit lat/lng |

#### 2d. Smart Alerts Screen

| Datei | Änderung |
|-------|----------|
| `smart_alerts_screen.dart:19-20` | `lat = 52.52` → LocationService |

#### 2e. Daily Briefing Screen

| Datei | Änderung |
|-------|----------|
| `daily_briefing_screen.dart:19-20` | `lat = 52.52` → LocationService |

#### 2f. Search Screen

| Datei | Änderung |
|-------|----------|
| `search_screen.dart:24-25` | `lat = 52.52` → LocationService |

**Gesamt:** 12 Dateien, ~200 Zeilen Änderung

---

### Phase 3: AI Chat — Berlin-Vorschläge entfernen (0.5 Tage)

| Datei | Änderung |
|-------|----------|
| `ai_chat_provider.dart:39-40` | `'Ärzte in Berlin'` → `'Ärzte in deiner Nähe'` |
| `ai_chat_provider.dart` | `question: 'Welche Ärzte gibt es in Berlin?'` → dynamisch |

**Code-Muster:**
```dart
// VORHER:
Suggestion(
  label: 'Ärzte in Berlin',
  question: 'Welche Ärzte gibt es in Berlin?',
)

// NACHHER:
Suggestion(
  label: 'Ärzte in meiner Nähe',
  question: 'Welche Ärzte gibt es in meiner Nähe?',
)
```

---

### Phase 4: Events — API-Wechsel (2-3 Tage)

**Problem:** `kulturdaten.berlin` API funktioniert NUR für Berlin.

**Optionen:**

| Option | Beschreibung | Aufwand | Empfehlung |
|--------|-------------|---------|------------|
| **A) Wikidata SPARQL** | Weltweit, aber wenige aktuelle Events | 1 Tag | ⚠️ Mittel |
| **B) OpenStreetMap Overpass** | `amenity=events_venue` + `event=*` | 1 Tag | ✅ Besser |
| **C) Eventbrite API** | Kommerziell, API-Key nötig | 2 Tage | ❌ Nicht kostenlos |
| **D) Nominatim + Custom** | Events via Overpass + Geocoding | 2 Tage | ✅ Best |

**Empfehlung: Option B + D (Overpass + Nominatim)**

```typescript
// NEU: eventService.ts
async function getEvents(lat: number, lng: number, radius: number) {
  // 1. Overpass: Event-Venues in der Nähe
  const venues = await queryOverpass(`
    [out:json][timeout:25];
    (
      node["amenity"="events_venue"](around:${radius * 1000},${lat},${lng});
      way["amenity"="events_venue"](around:${radius * 1000},${lat},${lng});
    );
    out center;
  `);
  
  // 2. Nominatim: Adressen auflösen
  // 3. Wikidata: Events an Venues abrufen (optional)
  
  return venues;
}
```

---

### Phase 5: Waste — AbfallNavi erweitern (1-2 Tage)

**Problem:** `wasteCityRegistry.ts` hat nur Berlin/Hamburg/München.

**Lösung:** AbfallNavi (Bund) hat 19 Regionen — diese eintragen.

| Datei | Änderung |
|-------|----------|
| `wasteCityRegistry.ts` | 19 AbfallNavi-Regionen hinzufügen |
| `wasteService.ts` | AbfallNavi-Adapter für alle Regionen |

**Bereits implementiert:** `abfallNaviService.ts` existiert!

**Nötig:** 19 Einträge in `CITY_REGISTRY`:
```typescript
{
  id: 'nuernberg',
  displayName: 'Nürnberg',
  adapter: 'abfall_navi',
  abfallNaviRegionId: 'nuernberg',
  abfallNaviBaseUrl: 'https://nuernberg-abfallapp.regioit.de/abfall-app-nuernberg/rest',
  requiresStreet: true,
  requiresHouseNr: true,
  nominatimKeywords: ['nürnberg', 'nuernberg'],
  bbox: { minLat: 49.2, maxLat: 49.6, minLng: 10.9, maxLng: 11.3 },
  attribution: 'AbfallNavi Bund/RegioIT — CC-BY 4.0',
}
```

---

### Phase 6: Tests aktualisieren (1 Tag)

| Test-Datei | Änderung |
|------------|----------|
| `e2e.test.ts` | Berlin-Koordinaten beibehalten (Test-Daten) |
| `wasteService.test.ts` | AbfallNavi-Tests hinzufügen |
| `eventService.test.ts` | Overpass-Events-Tests |
| Mobile Tests | LocationService-Mock für alle Provider |

**Wichtig:** Tests dürfen weiterhin Berlin-Koordinaten nutzen — das sind Test-Daten, nicht Hardcoding.

---

## Gesamtübersicht

| Phase | Beschreibung | Tage | Dateien |
|-------|-------------|------|---------|
| **1** | Backend: Lat/Lng Defaults entfernen | 1 | 6 Dateien |
| **2** | Flutter: LocationService in alle Screens | 2 | 12 Dateien |
| **3** | AI Chat: Berlin-Vorschläge entfernen | 0.5 | 1 Datei |
| **4** | Events: API-Wechsel (Overpass) | 2-3 | 2 Dateien |
| **5** | Waste: AbfallNavi erweitern | 1-2 | 2 Dateien |
| **6** | Tests aktualisieren | 1 | 5 Dateien |
| **🎯 Gesamt** | **Alle Services ortsunabhängig** | **7-9 Tage** | **~28 Dateien** |

---

## Erfolgskriterien

| Kriterium | Ziel |
|-----------|------|
| **Berlin-Hardcoding** | 0 hardcoded Defaults in Production-Code |
| **LocationService** | 100% der Screens nutzen GPS |
| **Backend** | Alle Routes erzwingen lat/lng (400 bei fehlend) |
| **Tests** | Alle grün nach Migration |
| **CI** | Flutter CI + Backend CI + Deploy Web grün |

---

## Risiken

| Risiko | Impact | Maßnahme |
|--------|--------|----------|
| GPS nicht verfügbar | Services zeigen Fehler | Klare Fehlermeldung "Standort nicht verfügbar" |
| Overpass Rate-Limit | Events/Parking langsam | Retry + Caching (bereits implementiert) |
| AbfallNavi nicht für alle Städte | Abfall nur in 19 Regionen | Klare Meldung "noch nicht verfügbar in deiner Stadt" |
| Breaking Changes | API-Vertrag ändert sich | Versionierung: `/api/v2/events` |

---

## Nächste Schritte

1. **User-Freigabe** für diesen Plan
2. **Phase 1 starten** (Backend Lat/Lng Defaults)
3. **Commit pro Phase** mit Conventional Commits
4. **CI nach jeder Phase prüfen**

---

## Dokumentation

| Datei | Aktualisierung |
|-------|---------------|
| `knowledge.md` | Service-Registry Tabelle nach Migration |
| `AGENTS.md` | Known Bugs: Berlin-Hardcoding entfernt |
| `docs/api-reference.md` | Services als ortsunabhängig markieren |
| `docs/location-independent-migration-plan.md` | Status-Updates nach jeder Phase |
