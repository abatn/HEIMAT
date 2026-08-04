# Agent-Handoff: HEIMAT 2.0

**Erstellt:** 2026-08-03 | Für: nächsten arbeitenden Agenten

---

## Was ist HEIMAT?

Open-Source Super App (à la WeChat/Grab) mit deutscher UI. Drei Services:
- `src/mobile/` — Flutter App (84 Dart-Dateien)
- `src/backend/` — Node.js Express API (98 TS-Dateien, 26 Routes, 37 Services)
- `src/ml-service/` — Python FastAPI (Docker only)

**Production:** `heimat-backend.onrender.com` (Render Free Tier) + Supabase DB + GitHub Pages (Flutter Web)

---

## Kritische Regeln (NIEMALS verletzen)

1. **Kein `git add -A` / `git add .`** aus dem Repo-Root. Dateien explizit adden.
2. **Vendored Flutter SDK** — `src/mobile/flutter/bin/flutter` und `src/mobile/flutter/bin/dart`. `flutter`/`dart`/`node` sind NICHT auf PATH.
3. **Conventional Commits, lowercase, Deutsch** — z.B. `feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt`
4. **Keine Mocks/Simulationen** — `audit-no-mocks.sh` enforced in CI. Verboten: `_computeMockLiveStatus`, `fundLocal`, `mockStatus`, `sampleData`, `simulate`, `local://demo`.
5. **Keine externen Webseiten im Mobile-Frontend** — ServiceRegistry-Pattern statt IFrame/WebView.

---

## Befehle

### Backend (in `src/backend/`)

```bash
npm run lint              # ESLint
npm test                  # Jest (benötigt Postgres — CI spinnt postgres:15-alpine auf)
npx tsc --noEmit          # Typecheck
npx jest src/__tests__/mobility.test.ts   # Einzelner Test
```

**WICHTIG:** `npm test` braucht Postgres. Lokal: 386/537 Tests (72%) — alles DB-Abhängig. In CI: 537/537 (100%). Lokale 72% sind KEIN Code-Problem.

### Mobile (in `src/mobile/`)

```bash
src/mobile/flutter/bin/dart format lib/ test/   # MUSS vor jedem Dart-Commit laufen
src/mobile/flutter/bin/flutter analyze --no-fatal-infos
src/mobile/flutter/bin/flutter test
src/mobile/flutter/bin/flutter pub get
```

---

## Aktueller Stand (2026-08-03)

### Abgeschlossene Phasen
- **Phase 23:** Finance JWT-Roundtrip ✅ live
- **Phase 24:** Demo-KUDOS ✅ live
- **Health AI Phase 1+2:** Gedächtnis, Medikamente, Mental Health, Prävention, Nachsorge ✅ (137 Tests)
- **Health Triage:** WHO ICD + Rules Engine + Ollama Auto-Detect ✅
- **Auth:** JWT + bcryptjs end-to-end live
- **Taler:** Wallet-Client (Exchange: demo.taler.net). Wallet-Balance = 0.00 KUDOS bis EUR-Exchange-Live.

### Offene Phasen (nächste Schritte)
- Phase A ✅ (Mini-Program-Container)
- Phase B ✅ (Wetter + Luft + Abfall)
- Phase C ✅ (E-Laden + Parken)
- Phase D ⚠️ (Jobs ✅, Events ❌ kulturdaten.berlin, Hotels ❌ lat=52.52, Bürgeramt ❌ lat=52.52)
- **3-Tab-Rebuild ✅ (2026-08-04):** 5→3 Tabs (WeChat-Muster)
- **GPS-Dynamisierung ✅ (2026-08-04):** 6 Screens nutzen LocationService
- **Offen:** Hardcoded-Locations in eventService.ts, wasteCityRegistry.ts, wasteService.ts entfernen

### Bekannte Bugs
- `lat: 0, lng: 0` Hack im Health Context
- Keyword-Drift in `detectHealthSymptom()` (zwei separate Keyword-Listen)
- Wallet-Balance = 0.00 KUDOS bis EUR-Production-Exchange live
- **Rate-Limiter behoben:** `max: 200` in `index.ts:57` (Commit 0371c04)
- **Hardcoded-Locations:** eventService.ts (kulturdaten.berlin), wasteCityRegistry.ts (Berlin/Hamburg/München), wasteService.ts (City-Name-Mapping) — NICHT ortsunabhängig

---

## Architektur-Entscheidungen

### ServiceRegistry-Pattern (Mobile)
Kein IFrame, kein WebView. `service_registry.dart` routet 14 Services via `nativeBuilder` in 6 Kategorien. Tap auf App-Karte → Registry-Lookup → echtes Native-Widget oder `ComingSoonScreen`.

**NEU (2026-08-04):** 3-Tab-Struktur (WeChat-Muster):
- Tab 0: Startseite (Dashboard + Alerts + Briefing + AI-Chat FAB)
- Tab 1: Dienste (Suche + Kategorien: Mobilität, Gesundheit, Alltag, Kultur, Finanzen, AI)
- Tab 2: Profil (User + Settings + Notfall)

### FHIR: NOT NOW
HAPI FHIR (~500MB RAM) passt nicht in Render Free Tier (512MB). HEIMAT hat bereits 1:1-funktionale Äquivalente (`doctor_slots`, `getAvailableSlots()`, `appointments`). Stattdessen: Status-Pipeline, Recurring Slots, Warteliste.

### Taler
HEIMAT ist reiner Wallet-Client — kein Exchange-Betreiber. Currency dynamisch aus Exchange-/keys gelesen. `TALER_EXCHANGE_URL` per env-var konfigurierbar.

---

## Projektsteuerung (4 Schleifen)

Vier Dateien im Repo-Root steuern das Projekt:

| Datei | Frage | Aktuelle Version |
|-------|-------|-----------------|
| `projekt_zielschleife.md` | Ist das Ziel richtig? | v2.0 |
| `projekt_betriebsschleife.md` | Bilden die Daten die Realität ab? | v2.0 |
| `projekt_ueberwachung_pruefung.md` | Wo hakt der Feedback-Loop? | v2.0 |
| `projekt_anker_urteil.md` | Was bedeutet "besser"? | v2.0 |

### Abweichung >20% — numerische Definition
| Metrik | Baseline | Schwelle |
|--------|----------|----------|
| CI-Test-Passrate | 100% | <80% echte Failures |
| Commit-Velocity | ~34/Tag | <27/Tag |
| Phasen-Fortschritt | 30% (3/10) | <24% nach 60% der Zeit |

### Definition von "besser"
> CI-Testrate 100% UND Phasen-Fortschritt steigend UND keine Regressionen UND Mock-Verbot eingehalten UND echte APIs statt Mocks.

---

## CI-Pipelines

| Workflow | Reihenfolge | Häufiger Fehler |
|----------|-------------|-----------------|
| `flutter.yml` | `dart format` → analyze → test → build-web + build-android | Unformatierter Dart |
| `backend.yml` | lint → test (Postgres) → `tsc --noEmit` | Fehlende Typen |
| `deploy-web.yml` | Push `src/mobile/**` → CI → `flutter build web` → GitHub Pages | — |

---

## Nächster Schritt

Wähle EINE der offenen Phasen (B Rest, C, D, oder E) und implementiere sie.
Vorgehen:
1. Backend-Service existiert prüfen (`src/backend/src/services/`)
2. DTOs in Flutter erstellen (`lib/features/<name>/domain/`)
3. Provider erstellen (`lib/features/<name>/data/`)
4. Screen erstellen (`lib/features/<name>/presentation/`)
5. In `service_registry.dart` eintragen
6. Tests schreiben (Backend + Flutter)
7. `dart format` laufen lassen VOR dem Commit
8. Commit mit Conventional Commits + deutsche Beschreibung
