# Zielschleife (angewandte Schleife)

**Letzte Aktualisierung:** 2026-08-03 | Version 3.0

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

## Messung der 5 „besser"-Dimensionen (v3.1, 2026-08-04)

| # | Dimension | v2.0 | v3.1 (heute) | Änderung | 20%-Schwelle | Status |
|---|-----------|------|--------------|----------|--------------|--------|
| 1 | **CI-Testrate** | 100% (CI) | 100% (CI) | — stabil | <80% | ✅ OK |
| 2 | **Phasen-Fortschritt** | 40% (4/10) | 100% (10/10) | Hardcoded-Locations komplett entfernt | <24% | ✅ OK |
| 3 | **Regressionen** | 0 | 0 | — stabil | >0 | ✅ OK |
| 4 | **Mock-Verbot** | 0 Violations | 0 Violations | — stabil | >0 | ✅ OK |
| 5 | **Echte APIs** | 120 Calls | 120 Calls | — stabil | — | ✅ OK |

**Ergebnis:** Keine 20%-Schwelle überschritten. Feedback-Loop funktioniert.

**Nächste Messung:** Bei Phase 26 (Erweiterung)
