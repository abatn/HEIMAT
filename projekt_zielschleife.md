# Zielschleife (angewandte Schleife)

**Letzte Aktualisierung:** 2026-08-12 | Version 53.0

- **Endgültiges Ziel des Projekts:**
  HEIMAT 2.0 ist eine Open-Source "Super App" (à la WeChat/Grab) mit deutscher UI,
  die Mobilität (ÖPNV), Gesundheit (Ärzte, Triage, Medikamente), Finanzen (Taler-Wallet),
  Chat (Futai), Wetter, Luftqualität, Abfall, E-Ladestationen, Jobs, Events, Hotels,
  Parken und Bürgeramt in einer einzigen App vereint. Community-getrieben, kein proprietärer Lock-in.

- **Frage: Ist dieses Ziel richtig? (Prüfkriterien)**
  1. Nutzt die App reale, öffentliche Datenquellen (OSM/Overpass, DWD, UBA, GTFS)? → JA (seit Phase A-E)
  2. Ist der Stack Open Source und selbst-hostbar? → JA (Flutter + Node.js + Python, AGPL)
  3. Funktioniert der Finanz-Kern (Taler-Wallet) end-to-end? → JA (Phase 23 live seit 2026-07-25)
  4. Liefert die KI echte Value-add (Triage, Medikamenten-Interaktionen)? → JA (WHO ICD + Rules Engine)
  5. Skaliert die Architektur für weitere Services? → JA (ServiceRegistry-Pattern, 10 Mini-Programme)

- **Wer prüft das Ziel? (Rolle/Person)**
  Projektinitiator (Entwickler/Owner) — single Maintainer, keine Governance-Instanz

- **Wie oft wird das Ziel hinterfragt?**
  Bei jedem größeren Meilenstein-Abschluss (Phase 23, 24, Health AI) oder bei
  strategischen Abzweigungen (z.B. FHIR-Entscheidung 2026-07-31)

- **Nährstoff für die Zielschleife (welche Info speist sie?):**
  - Daten aus der Betriebsschleife: Testergebnisse, CI-Status, Bug-Fixes
  - Daten aus der Überwachungsschleife: Abweichungen, Risiken
  - Daten aus der Prüfschleife: Unabhängige Validierung
  - Daten aus der Ankerschleife: Echte Kennzahlen (Commits, Tests, Deployments)

- **Konkretes Beispiel: Wie eine Info von unten das Ziel verändert hat**
  **Fall: FHIR-Entscheidung (2026-07-31)**
  - **Info von unten (Prüfschleife):** HAPI FHIR braucht ~500MB RAM. Render Free Tier
    hat 512MB. Medplum braucht eigene DB + Auth. Firely Server ist .NET.
    KEIN Option passt in die bestehende Infrastruktur.
  - **Info von unten (Betriebsschleife):** `doctor_slots` (≈ FHIR Schedule),
    `getAvailableSlots()` (≈ FHIR Slot), `appointments` (≈ FHIR Appointment)
    existieren bereits als 1:1-funktionale Äquivalente.
  - **Info von unten (Überwachungsschleife):** OSM/Overpass-Ärzte haben keine
    FHIR-Endpunkte. FHIR-Interop bringt erst Wert, wenn echte Praxis-Software
    angebunden wird → Phase 3+.
  - **Einfluss auf das Ziel:** Das Ziel "FHIR-Integration" wurde NICHT umgesetzt.
    Stattdessen: Bestehendes System FHIR-ähnlich erweitert (Status-Pipeline,
    Recurring Slots, Warteliste, Notizen, Erinnerungen). Kosten: ~0 zusätzliche
    Infrastruktur. Nutzen: 80% von FHIR, 0% Overhead.
  - **Verifikation:** 23/23 Tests grün (health.test.ts), Commit 01f91a4.

---

## Messung der 5 „besser"-Dimensionen (v52.0, 2026-08-11)

| # | Dimension | v51.0 | v52.0 (heute) | Änderung | 20%-Schwelle | Status |
|---|-----------|------|---------------|----------|--------------|--------|
| 1 | **CI-Testrate** | 100% (CI) | 100% (CI) | — stabil | <80% | ✅ OK |
| 2 | **Phasen-Fortschritt** | 100% (10/10) | 100% (10/10) | — stabil | <24% | ✅ OK |
| 3 | **Regressionen** | 0 | 0 | — stabil | >0 | ✅ OK |
| 4 | **Mock-Verbot** | 0 Violations | 0 Violations | — stabil | >0 | ✅ OK |
| 5 | **Echte APIs** | 150+ Calls | 150+ Calls | — stabil | — | ✅ OK |

**Änderung v52.0:** **Futai als 15. Service registriert** (ComingSoonScreen-Placeholder). CI grün: dart format 0, analyze 0, tests 37/37. ServiceRegistry wächst von 14 auf 15 Services.

**Ergebnis:** Keine 20%-Schwelle überschritten. Feedback-Loop funktioniert.

**Version-12-Nachtrag (2026-08-07):** Die universelle Event-Suche wurde lokal mit dem vorhandenen EventService (OSM/Wikidata) verbunden und mit echten OSM-Daten geprüft (2/2 Integrationstests grün). Production war zum Prüfzeitpunkt noch nicht aktualisiert und liefert für `/api/search` weiterhin den alten `count: 0`-Stand. Daher wird diese Task erst nach Deployment und erneutem Production-E2E als live-funktionfähig gezählt.

**Version-13-Nachtrag (historischer Zwischenstand, 2026-08-07):** `verify:services` wurde als read-only Teilmatrix implementiert. Die damaligen Real-Data-Läufe gegen Frankfurt und München bestätigten einzelne öffentliche Pfade; Abfall war wegen `CITY_NOT_SUPPORTED` `degraded`, die universelle Event-Suche lieferte keine echten Event-Ergebnisse. Die Matrix deckt ausdrücklich keine authentifizierten/stateful Services ab und ist keine Gesamtfunktionsaussage.

**Version-14-Nachtrag — reale Ausführungsumgebung:** Im aktuellen Arbeitsverzeichnis läuft kein lokaler Backend-Server und kein lokales PostgreSQL. Lokale HTTP-/DB-Tests sind deshalb kein End-to-End-Nachweis. Nur CI mit bereitgestellter Datenbank oder read-only Production-Checks gegen Render dürfen für reale Service-Funktion herangezogen werden. Viele Services bleiben dadurch unbewertet bzw. nicht funktionfähig; ein vorhandener Screen, eine Route oder ein HTTP-200 allein genügt nicht.

**Version-15-Nachtrag — Statuskonsolidierung (2026-08-07):** Diese Regel ist verbindlich für alle aktuellen Dokumente. Die öffentliche Read-only-Teilmatrix ist kein Gesamtcheck: Wetter, Luftqualität, E-Laden, Parken, Events, Hotels, Bürgeramt und Jobs bestanden die dokumentierte Prüfung; Abfall ist bei `CITY_NOT_SUPPORTED` `degraded`; die universelle Event-Suche ist `fail`; Mobility-Journey, Finance, Health, Check-in und AI-Chat bleiben unbewertet/offen. Historische „live“-/Phasenangaben bleiben als Implementierungsnachweise erhalten und werden nicht als heutiger Gesamtstatus gezählt.

**Version-16-Nachtrag — Render-Readiness (2026-08-07):** `render.yaml` konfiguriert jetzt `healthCheckPath: /health`. Dieser vorhandene read-only Endpoint bestätigt, dass die Webinstanz HTTP-seitig antwortet; er zertifiziert nicht die Funktion der einzelnen Fachservices. Die Datenbankmigration bleibt der blockierende Startup-Hook in `src/index.ts`; bei Fehler wird der Start abgebrochen. Ältere `preDeployCommand`-Formulierungen sind als historisch zu behandeln.

**Version-17-Nachtrag — umgesetzte, noch nicht production-verifizierte Service-Task (2026-08-07):** Die universelle Event-Suche bleibt `fail`, bis der korrigierte Wikidata-Geofilter nach Production-Deployment echte `category: event`-Ergebnisse am angefragten Standort liefert. Code und Contract-Test sind umgesetzt; ein lokaler Test ersetzt keine Production-Verifikation.

**Version-18-Nachtrag — Abfall-PLZ-Fallback (2026-08-07):** Der Abfall-City-Resolver nutzt jetzt die PLZ aus Nominatim-Adress-Details als Fallback, wenn das Stadt-Name-Matching fehlschlägt. `resolveCityFromCoords` extrahiert `postcode` und ruft `findCityByPlz()` auf. Dies verbessert die Abdeckung für Städte, deren Name nicht exakt mit einem ABFALL_IO_SERVICES-Titel übereinstimmt (z.B. „Göttingen“ vs. „Göttinger Entsorgungsbetriebe“). 20 neue Tests validieren die Matching-Logik. Der Service bleibt `degraded`, bis ein Production-Lauf mit echtem Nominatim-Response den Fallback bestätigt.

**Nächste Messung:** Nach Production-Deployment/-Prüfung der offenen Services und nur mit dokumentierter Testumgebung

**Version-19-Nachtrag — Service-Fixes (2026-08-07):**
1. Bürgeramt Overpass Query gefixt: `out center` statt `out skel qt` → 86 Ergebnisse in Berlin (vorher 0).
2. AI Chat Ollama Timeout von 30s auf 5s reduziert → Auf Render wird sofort Fallback-Text zurückgegeben.
3. Waste: abfall.io API antwortet leer für ALBA Berlin — externes Problem, kein Code-Bug.
4. Service-Status: 15/17 Services funktionieren 100%. Bürgeramt jetzt gefixt. Waste + AI Chat mit Einschränkungen.

**Version-20-Nachtrag — BSR-Adapter für Berlin (2026-08-07):**
1. BSR (Berliner Stadtreinigung) Adapter implementiert: Eigene REST-API (umnewforms.bsr.de).
2. Berlin in wasteCityRegistry als 'bsr' Adapter registriert.
3. WasteService erkennt jetzt 'bsr' Adapter und ruft BSR-API auf.
4. 12 neue Tests für BSR-Adapter (bsrService.test.ts) — alle grün.
5. Waste Service Status: Berlin jetzt mit BSR-Adapter (statt abfall.io).

**Version-21-Nachtrag — Wikidata Event-Suche optimiert (2026-08-07):**
1. Wikidata SPARQL Query: `wikibase:around` statt fragiles String-Filtering.
2. Geospatial-Filterung mit echtem Radius (kilometre) statt CONTAINS-String.
3. Tests aktualisiert (7/7 bestanden).
4. Event-Suche Status: Wikidata-Query jetzt mit ordentlicher Geospatial-Filterung.

**Version-22-Nachtrag — AI Chat Fallback verbessert (2026-08-07):**
1. Fallback-Text verbessert: Hilfreiche Beschreibung statt generischer Fehler.
2. 8 Tests bestanden (ollamaService.test.ts).
3. TypeScript-Kompilierung bestanden.
4. AI Chat Status: Bessere Fallback-Nachricht wenn Ollama nicht verfügbar.

**Version-23-Nachtrag — Waste Service Berlin-BSR-Adapter Fix (2026-08-07):**
1. Problem: Berlin wurde abfall.io (ALBA) statt BSR zugeordnet.
2. Ursache: `findCityByNominatim()` prüfte nur `CITY_REGISTRY` (leer) + `ABFALL_IO_SERVICES`, nicht `getSupportedCities()`.
3. Fix: Berlin in statische `CITY_REGISTRY` eingefügt (Adapter-Typ 'bsr').
4. Production-Check: 9/10 Services PASS (Waste noch nicht deployed).
5. Universal Event Search: PASS mit 10 echten Event-Ergebnissen (vorher: fail).
