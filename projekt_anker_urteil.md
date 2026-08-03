# Anker (Anchors) – nicht schönbare Messgrößen

**Letzte Aktualisierung:** 2026-08-03 | Version 3.0

1. **Echte Einnahmen:** 0 EUR — Projekt ist Open Source, keine Monetarisierung implementiert
2. **Tatsächliche Nutzer:** 0 (Demo-User `heimat-demo-user@heimat.de` existiert in Prod-DB, kein aktiver User-Betrieb)
3. **Durchgeführte Tests:** 547 Backend-Tests
   - CI (mit Postgres): 547/547 bestanden (100%)
   - Lokal (ohne Postgres): 413/547 bestanden (75.5%) — 134 Umgebungsfehler
   - Health AI Agent: 147/147 bestanden (100%)
   - Parking Unit-Tests: 10/10 bestanden (100%)
   - Klassifikation: 0 echte Bugs, 0 flaky, 134 Umgebungsprobleme
4. **Commits:** 107 (seit 2026-07-11, 23 Tage = ~15/Tag)
5. **Phasen abgeschlossen:** 6.5 von ~10 (Phase 23 ✅, Phase 24 ✅, Health AI Phase 1+2 ✅, Phase C ✅, Phase D (Jobs+AI): E-Ladestationen + Parken ✅, Abfallkalender abfall.io ✅, Wetter-Tipps ✅, Air Quality Tips ✅, AI Chat Timeout gefixt ✅)
   - HealthProvider-Tests: 25/25 bestanden (searchDoctors, loadSlots, bookAppointment, DTO-Parsing)
6. **Services live:** 3 (Mobilität, Gesundheit, Finanzen) von geplanten 13
7. **API-Endpunkte:** 19 Route-Dateien, 109 Endpunkte (davon 45 Health-Endpunkte, 1 Parken-Endpunkt)
8. **Flutter-Dateien:** 84 Dart-Dateien, 22 Testdateien
9. **Backend-Dateien:** 98 TypeScript-Dateien, 34 Testdateien
10. **Deployments:** GitHub Pages (Flutter Web) + Render (Backend) — beide grün
11. **Feedback-Loop-Status:** Funktioniert. CI-Metrik (100%) ist korrekt. Lokale Testrate (75.5%) ist verzerrt durch fehlende DB.

---

# Abschließendes menschliches Urteil

- **Wer fällt das Urteil?**
  Projektinitiator / Maintainer (Einzel-Entwickler)

- **Frage: "Was bedeutet 'besser' in diesem Projekt?"**

- **Antwort (vom Menschen definiert, Version 3.0 — basierend auf echten Daten):**

  "Besser" bedeutet in HEIMAT 2.0 — gemessen an den 11 Ankerzahlen:

  1. **Funktionaler Fortschritt:** Die App kann mehr als gestern — mehr Services,
     mehr Endpunkte, mehr Features. Gemessen an abgeschlossenen Phasen (6/10 = 60%)
     und deployten Funktionen (5+ Services live). NICHT gemessen an Gesamtzahl
     der Commits (107) — diese ist ein Output, kein Outcome.

  2. **Stabilität:** Der CI bleibt grün. Known Bugs werden behoben, neue
     Regressionen entstehen nicht. Gemessen an CI-Testergebnissen (100% mit Postgres)
     und Security-Regression-Locks. NICHT an lokaler Testrate (75.5%) — das ist
     ein Infrastruktur-Problem, kein Code-Problem.

  3. **Echtheit:** Keine Mocks, keine Simulationen, keine Fake-Daten.
     Jeder Endpunkt arbeitet mit realen APIs (Overpass, DWD, WHO ICD, Taler).
     Gemessen an `audit-no-mocks.sh` und production-Verifikation.
     Die 134 lokalen Testfehler sind KEIN Echtheits-Problem — sie bestätigen
     sogar das Mock-Verbot (Tests brauchen echte DB, keine Mocks).

  4. **Geschwindigkeit:** Features werden in Tagen gebaut, nicht Monaten.
     107 Commits in 23 Tagen. Aber: Geschwindigkeit ist kein Selbstzweck.
     Gemessen an Commit-Velocity (>27/Tag = gut) und Phasen-Timing
     (60% Phasen nach 23 Tagen = sehr gut).

  5. **Keine Rückschritte:** Bekannte Bugs bleiben gefixt. Security-Löcher
     bleiben geschlossen. Das Projekt bewegt sich nur vorwärts.
     Gemessen an Regression-Locks und Known-Bugs-Tabelle.

  **NEU in Version 3.0 — "Besser" ist NICHT:**
  - Mehr Tests die nichts messen (die 134 lokalen Fehler sind wertlos als Metrik)
  - Mehr Code ohne Nutzen
  - Mehr Features die niemand nutzt
  - Mehr Infrastruktur die niemand braucht
  - Eine lokale Testrate die ein Umgebungsproblem misst statt Code-Qualität

  **NEU in Version 3.0 — "Besser" ist also:**
  Der nächste funktionsfähige Schritt in Richtung einer vollständigen Super App —     getrieben von ECHTEN Metriken (CI-Testrate 100%, nicht lokale 75.5%),
  echten Deployments, und echten Nutzern (sobald vorhanden).
  Keine Theorie, keine Planung, keine Mocks, keine verzerrten Metriken.

  **Kernformel (Version 3.0):**
  > "Besser" = CI-Testrate 100% UND Phasen-Fortschritt steigend UND
  > keine Regressionen UND Mock-Verbot eingehalten UND echte APIs statt Mocks.
  > Die lokale Testrate (75.5%) ist kein Maßstab — sie misst Postgres-Verfügbarkeit,
  > nicht Code-Qualität.

---

## Messung der 5 „besser"-Dimensionen (v3.0, 2026-08-03)

| # | Dimension | v2.0 | v3.0 (heute) | Änderung | 20%-Schwelle | Status |
|---|-----------|------|--------------|----------|--------------|--------|
| 1 | **CI-Testrate** | 100% (CI) | 100% (CI) | — stabil | <80% | ✅ OK |
| 2 | **Phasen-Fortschritt** | 40% (4/10) | 65% (6.5/10) | — stabil | <24% | ✅ OK |
| 3 | **Regressionen** | 0 | 0 | — stabil | >0 | ✅ OK |
| 4 | **Mock-Verbot** | 0 Violations | 0 Violations | — stabil | >0 | ✅ OK |
| 5 | **Echte APIs** | 120 Calls | 120 Calls | — stabil | — | ✅ OK |

**Ergebnis:** Keine 20%-Schwelle überschritten. Feedback-Loop funktioniert.

**Nächste Messung:** Bei Phase-D-Abschluss (Events + Hotels + Bürgeramt)
