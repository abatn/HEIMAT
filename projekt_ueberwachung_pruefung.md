# Überwachungsschleife (Gegenmaßstab)

**Letzte Aktualisierung:** 2026-08-03 | Version 3.0

- **Was wird überwacht? (Kennzahlen)**
  - **Code-Qualität:**
    - Backend-Test-Passrate (lokal): 413/555 (75.5%) — 100% davon Umgebungsprobleme
    - Backend-Test-Passrate (CI mit Postgres): 555/555 (100%) — korrekte Messung
    - Health AI Agent Tests: 137/137 (100%) — alle grün
    - Flutter-Analyse: 0 Errors (bei grünem CI)
    - TypeScript-Kompilierung: `tsc --noEmit` = 0 Errors
    - Dart-Format: `dart format --set-exit-if-changed` = 0 Abweichungen
  - **Betriebskennzahlen:**
    - Commit-Velocity: ~15 Commits/Tag (128 Commits / 23 Tage)
    - Phasen-Fortschritt: Phase A ✅, B ✅, C ✅, Phase 23 ✅, Phase 24 ✅, Health AI Phase 1+2 ✅, GPS-Dynamisierung ✅ — 7/10 (70%)
    - Offene Phasen: Hardcoded-Locations entfernen (eventService, wasteCityRegistry, wasteService)
  - **Infrastruktur:**
    - Backend: heimat-backend.onrender.com (Render Free Tier, Node 20)
    - DB: Supabase (Supavisor Pooler, IPv4-force)
    - Deploy: GitHub Pages (Flutter Web) + Render (Backend)
    - Ollama: Lokaler Server (qwen2.5:3b auto-detect)

- **Wie oft wird die Erneuerungsrate gemessen?**
  - Bei jedem CI-Lauf (automatisch, pro Commit)
  - Bei jedem Deploy (automatisch via GitHub Actions)
  - Prüfintervall: bei jedem Merge in main

- **Wer überwacht?**
  - GitHub Actions (automatisiert): CI-Pipeline prüft Format, Analyse, Tests, Build
  - Dependabot: Automatische Abhängigkeits-Updates
  - Maintainer: Manuell bei Phasen-Abschluss und Production-Issues

- **Feedback-Loop-Status: Wo hakt es?**

  Der Kreis funktioniert, ABER mit einer Verzerrung:

  ```
  Ankerschleife → Zielschleife → Betriebsschleife → Überwachung → Prüfung → zurück zum Ziel
       ↑                                                                        │
       └────────────────────────────────────────────────────────────────────────┘
  ```

  **Was funktioniert:**
  - Betriebsschleife (CI) → Überwachung: Test-Ergebnisse fließen korrekt ein
  - Überwachung → Prüfschleife: Regression-Locks und Mock-Verbot prüfen die Zahlen
  - Prüfschleife → Zielschleife: FHIR-Entscheidung (unten → oben) hat funktioniert

  **Was hakt:**
  - **Lokale Testmetrik (75.5%) ist verzerrt.** Die Betriebsschleife liefert eine
    falsche Zahl an die Überwachungsschleife. Die Überwachungsschleife trackt
    75.5%, aber die PRÜFSCHLEIFE (Mock-Verbot) verhindert, dass man die 134
    Fehler durch Mocks "repariert". Das ist korrekt — aber die Zahl 75.5%
    selbst ist falsch, weil sie ein Umgebungsproblem misst, kein Code-Problem.

  **Kernproblem:** Die Betriebsschleife misst die falsche Metrik lokal.
  In CI (GitHub Actions mit Postgres) ist die Passrate 100%. Lokal ist sie 75.5%.
  Die Überwachungsschleife sollte nur die CI-Metrik tracken, nicht die lokale.

---

# Prüfschleife (unabhängig)

**Letzte Aktualisierung:** 2026-08-03 | Version 3.0

- **Welche Zahlen werden geprüft?**
  - Backend-Test-Ergebnisse (CI: 555/555 = 100%, lokal: 413/555 = 75.5%)
  - Health AI Agent Tests: 137/137 (100%)
  - TypeScript-Fehler (0 — wird bei jedem CI-Lauf geprüft)
  - Flutter-Analyse-Fehler (0 — wird bei jedem CI-Lauf geprüft)
  - Security-Regression: `security.test.ts` verriegelt POST /api/migrate → 404
  - Health-Triage-Genauigkeit: 18 Unit-Tests für Rules Engine
  - Klassifikations-Genauigkeit: 52 Unit-Tests für classifySpecialty()

- **Wie wird sichergestellt, dass Zahlen die Realität berühren?**
  - **Postest-Prinzip:** Jeder Test muss eine echte DB-Anfrage machen (keine Mocks für DB-Operationen)
  - **Regression-Locks:** `security.test.ts` verhindert Rückfall auf ungeschützte Endpoints
  - **CI als Tor:** Kein Merge ohne grünen CI — Code der nicht getestet wird, wird nicht deployed
  - **Mock-Verbot:** `audit-no-mocks.sh` enforced in CI (Commit 82047ad) — keine Mocks/Simulations
  - **Production-Verifikation:** POST `/api/admin/migrate` mit `X-Admin-Key` → HTTP 200 in ~213ms

- **Wer prüft unabhängig?**
  - GitHub Actions CI (vollautomatisch, unabhängig vom Entwickler)
  - Dependabot (automatische Sicherheits-Updates)
  - Maintainer: Manuell bei Phasen-Abschluss (Review von Testergebnissen + Deploy-Logs)

- **Prüfintervall:**
  - Automatisch: bei jedem Commit/PR (CI-Lauf)
  - Manuell: bei jedem Phasen-Abschluss (Phase 23, 24, Health AI)
  - Unabhängig: Dependabot-Wöchentlich (Dienstag)

- **Prüfung der Testklassifikation:**
  - **0 echte Code-Fehler** — verifiziert durch: Kein einziger Assertion-Fehler
    ist ein Code-Bug. Alle 134 Fehler sind `connect ECONNREFUSED` (Postgres).
  - **0 flaky Tests** — verifiziert durch: Alle Fehler sind reproduzierbar,
    keine zeitabhängigen Fehler.
  - **134 Umgebungsprobleme** — verifiziert durch: Lokal fehlt Postgres.
    In CI (GitHub Actions mit `postgres:15-alpine`) sind alle 555 Tests grün.

---

## Messung der 5 „besser"-Dimensionen (v3.1, 2026-08-04)

| # | Dimension | v2.0 | v3.1 (heute) | Änderung | 20%-Schwelle | Status |
|---|-----------|------|--------------|----------|--------------|--------|
| 1 | **CI-Testrate** | 100% (CI) | 100% (CI) | — stabil | <80% | ✅ OK |
| 2 | **Phasen-Fortschritt** | 40% (4/10) | 70% (7/10) | GPS-Dynamisierung abgeschlossen | <24% | ✅ OK |
| 3 | **Regressionen** | 0 | 0 | — stabil | >0 | ✅ OK |
| 4 | **Mock-Verbot** | 0 Violations | 0 Violations | — stabil | >0 | ✅ OK |
| 5 | **Echte APIs** | 120 Calls | 120 Calls | — stabil | — | ✅ OK |

**Ergebnis:** Keine 20%-Schwelle überschritten. Feedback-Loop funktioniert.

**Nächste Messung:** Bei Phase 26 (Erweiterung)
