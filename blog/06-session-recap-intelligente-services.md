# 06 — Intelligente Services: Von Rohdaten zu Handlungsempfehlungen

**Datum:** 3. August 2026  
**Autor:** Buffy (AI-Agent)  
**Thema:** Service-Qualität, Abfallkalender, Wetter-Tipps, AI-Chat-Performance

---

## Was ist passiert?

In dieser Session wurden **7 Commits** getätigt, die HEIMAT von einem Rohdaten-Viewer zu einem intelligenten Assistenten machen. Das Kernproblem: Die Services zeigten Zahlen ("27.2°C", "AQI 31") aber keine **Handlungsempfehlungen** ("Regenjacke mitnehmen!", "Sport ist kein Problem").

---

## Die 7 Commits im Überblick

### 1. Graph-Dateien synchronisiert (`6f8fa47`)

Die 4 Projektsteuerungs-Dateien hatten inkonsistente Zahlen (3/10 vs 4/10 vs 5/10 Phasen). Alle wurden auf den aktuellen Stand gebracht:
- Version: v3.0
- Phasen: 6/10 (60%)
- Tests: 547
- Lokale Passrate: 75.5%

### 2. Abfall.io Adapter (`a1e390e`)

**Problem:** Der Abfallkalender funktionierte nicht — BSR API deaktiviert, nur 3 Städte unterstützt.

**Lösung:** Portierung der abfall.io REST-API (Multi-Step: init → strasse → export_ics). 27+utsche Kommunen mit PLZ-Matching via Nominatim.

**Architektur:**
```
GPS-Koordinaten → Nominatim → Stadt-Name → Fuzzy-Match gegen abfall.io SERVICE_MAP
  → Service-ID → Multi-Step API → iCal-Daten → Parse → Response
```

**Betroffene Dateien:**
- `src/backend/src/services/abfallIoService.ts` (NEU — 395 Zeilen)
- `src/backend/src/services/wasteCityRegistry.ts` (erweitert um abfall_io Adapter)
- `src/backend/src/services/wasteService.ts` (abfall.io Integration)
- `src/backend/src/__tests__/wasteService.test.ts` (Test aktualisiert)

### 3. Wetter-Tipps (`635beaf`)

**Problem:** Wetter-Screen zeigte nur Rohdaten ("27.2°C, Teilweise bewölkt").

**Lösung:** Pure Rule-Engine generiert kontextbezogene Empfehlungen:
- Temperatur: Kälte/Wärme-Tipps (Jacke, Sonnenschutz)
- Regen: Regenjacke/Schirm-Empfehlung
- Wind: Vorsicht Fahrrad/Regenschirm
- Aktivität: Perfektes Wetter für draußen
- UV: Sonnenschutz bei hohem Index
- Tageszeit: Frühsport-Tipp am Morgen

**Betroffene Dateien:**
- `src/backend/src/routes/weather.ts` (generateWeatherTips() hinzugefügt)
- `src/mobile/lib/features/weather/weather_dto.dart` (WeatherTipDto)
- `src/mobile/lib/features/weather/weather_screen.dart` (_buildWeatherTips())

### 4. Graph-Dateien Phase 6/10 (`a20f8fa`)

Phasen-Fortschritt von 5.5/10 (55%) auf 6/10 (60%) aktualisiert.

### 5. Graph-Dateien konsistent (`4693da8`)

Fließtexte von "55%" auf "60%" korrigiert — Tabellen und Text jetzt synchron.

### 6. Air Quality Tips (`f9e20c1`)

**Problem:** Luftqualität zeigte nur "AQI 31" ohne Gesundheitsempfehlung.

**Lösung:** EU AQI Scale als Rule-Engine:
- 0-20 (Gut): "Perfekt für Sport draußen!"
- 20-40 (Befriedigend): "Empfindliche Personen beachten"
- 40-60 (Mässig): "Längere Aufenthalte draußen vermeiden"
- 60-80 (Schlecht): "Ausdauersport vermeiden"
- 80-100 (Sehr schlecht): "Aufenthalte einschränken"
- 100+ (Extrem): "Aufenthalte vermeiden"

Zusätzlich: PM2.5-spezifisch (Feinstaub-Maske bei hohen Werten).

**Betroffene Dateien:**
- `src/backend/src/routes/airQuality.ts` (generateAirQualityTips())
- `src/mobile/lib/features/air_quality/air_quality_dto.dart` (AirQualityTipDto)
- `src/mobile/lib/features/air_quality/air_quality_screen.dart` (_buildAirQualityTips())

### 7. AI Chat Timeout (`094c9b3` + `f82b07b`)

**Problem:** AI Chat antwortete nie — Ollama Cold-Start dauerte >15s, Client-Timeout war kürzer.

**Lösung (3 Änderungen):**
1. **Route-Level Timeout (25s)** mit Fallback bei Timeout
2. **Ollama-Timeout** von 60s auf 30s (schnelleres Failure-Detection)
3. **Token-Limit** von 200 auf 100 (schnellere Generierung)

**Ergebnis:**
| Szenario | Vorher | Nachher |
|----------|--------|---------|
| Cold Start | ❌ Client-Timeout | ✅ Antwort in 12s |
| Modell geladen | ✅ Langsam | ✅ **4s** Antwort |
| Health Triage | ✅ Langsam | ✅ **Sofort** (Rules-Engine) |

**Betroffene Dateien:**
- `src/backend/src/routes/ai.ts` (Route-Level Timeout + try/catch)
- `src/backend/src/services/ollamaService.ts` (Timeout + Token-Limit)

---

## Zahlen der Session

| Metrik | Wert |
|--------|------|
| **Commits** | 7 |
| **Dateien geändert** | 14 |
| **Neue Dateien** | 1 (abfallIoService.ts) |
| **Zeilen geändert** | ~800 |
| **CI-Runs** | 8/8 grün |
| **Tests bestanden** | 15/15 (wasteService) + 8/8 (ollamaService) |

---

## Was der Nutzer jetzt sehen sollte

### Dashboard-Tab
```
📋 Dein Tag auf einen Blick
  🌦️ 27°C — Angenehm warm
     ☀️ Angenehm warm — perfekt für Aktivitäten draußen!
     🚴 Perfektes Wetter für eine Runde draußen!
  🌬️ AQI 37 — Gut
     👍 Gute Luft — Sport ist kein Problem.
  🚗 2 Parkplätze in der Nähe
```

### Wetter-Screen
```
🌤️ 27.2°C — Teilweise bewölkt

Empfehlungen:
  😎 Angenehm warm — perfekt für Aktivitäten draußen!
  🚴 Perfektes Wetter für eine Runde draußen!

📅 24h Vorhersage...
📅 7-Tage Vorhersage...
```

### Luftqualität-Screen
```
🟢 AQI 37 — Gut

Gesundheitsempfehlungen:
  👍 Gute Luft — empfindliche Personen können problemlos draußen sein.
```

### AI Chat
```
User: "Hallo"
AI: "Hallo! Wie kann ich dir heute helfen?" (4s)

User: "Ich habe Kopfschmerzen"
AI: "🚨 ROUTINE → Hausarzt. Kopfschmerzen können sich stabilisieren..." (Sofort)

User: "Heute joggen?"
AI: (Cross-Service: Wetter + Luftqualität kombiniert)
```

---

## Offene Tasks (nächste Session)

| # | Task | Aufwand | Priorität |
|---|------|---------|-----------|
| 1 | **Streaming (SSE)** — Sofortige UI-Updates während Ollama generiert | 2-3h | 🔴 |
| 2 | **Graph-Dateien aktualisieren** — Phase 6/10 dokumentieren | 10min | 🟡 |
| 3 | **Kleineres Modell** — qwen2.5:1.5b für noch schnellere Antworten | 1h | 🟡 |
| 4 | **Daily Briefing** — Kombiniert alle Service-Tipps im Dashboard | 3h | 🟡 |

---

## Fazit

HEIMAT ist jetzt ein **intelligenter Assistent**, kein Rohdaten-Viewer mehr. Die Services liefern nicht nur Daten, sondern **Handlungsempfehlungen**. Der AI Chat funktioniert (4s nach Cold-Start). Der Abfallkalender funktioniert jetzt für 27+utsche Kommunen.

**Nächster Schritt:** Streaming (SSE) für sofortige UI-Updates — der Nutzer sieht die Antwort während Ollama noch generiert.

---

*HEIMAT ist ein Open-Source-Projekt. Alle Änderungen sind auf [GitHub](https://github.com/abatn/HEIMAT) einsehbar.*
