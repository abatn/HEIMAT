# HANDOFF-PROMPT für nächsten Agenten

## Projekt
HEIMAT 2.0 — Open-Source Super App für Deutschland (Flutter + Node.js + Python ML)

> **Aktueller Status-Override (2026-08-06):** Im Arbeitsverzeichnis läuft kein lokaler Backend-Server und kein lokales PostgreSQL. Die dokumentierte Production-Prüfung ist nur eine öffentliche Read-only-Teilmatrix: Wetter, Luftqualität, E-Laden, Parken, Events, Hotels, Bürgeramt und Jobs bestanden; Abfall ist bei `CITY_NOT_SUPPORTED` `degraded`; die universelle Event-Suche ist `fail`; Mobility-Journey, Finance, Health, Check-in und AI-Chat sind unbewertet/offen. Historische „live“-/Phasenangaben weiter unten sind keine aktuelle Gesamtfunktionszusage.

## aktueller Stand

> **Verifikationsgrenze (2026-08-06):** Im aktuellen Arbeitsverzeichnis läuft kein lokaler Backend-Server und kein lokales PostgreSQL. Lokale `localhost`-/`ECONNREFUSED`-Fehler sind kein Produktnachweis. Die aktuelle Production-Prüfung ist nur eine öffentliche Read-only-Teilmatrix; sie ist kein Nachweis, dass alle Services funktionieren.
>
> **Aktuelle Bewertung:** Wetter, Luftqualität, E-Laden, Parken, Events, Hotels, Bürgeramt und Jobs bestanden die dokumentierte öffentliche Prüfung; Abfall ist bei `CITY_NOT_SUPPORTED` `degraded`; die universelle Event-Suche ist `fail`; Mobility-Journey, Finance, Health, Check-in und AI-Chat bleiben unbewertet/offen.

**Phase 23 Recap — Stand Juli 2026 (historischer Implementierungsnachweis):** Auf einen Blick: Produktion läuft, Finance-Roundtrip ist end-to-end live, Auto-Migration ist abgesichert. Diese Angaben ersetzen keinen aktuellen Service-Production-Check.

### ✅ Was funktioniert
- User-Auth (JWT+bcryptjs): Register/Login/Logout end-to-end live auf Render
- Finance-Roundtrip: Mobile Bearer-Header in allen 5 Finance-Calls (cfb0561); URL-Pfade ohne `/$userId`-Suffix; `GET /wallet` Route neu; Schema-DROP `wallet_priv` durchgelaufen
- Security-Härtung: `POST /api/migrate` entfernt (25ac7ab); `security.test.ts` Regression-Lock (3414aea)
- Auto-Migration: `AUTO_MIGRATE=true` startup-hook (7e5f063) — ✅ Live bestätigt am 2026-07-25 (Build-Log + funktionaler Beweis)
- Admin-Pfad: `ADMIN_KEY` auf Render; `/api/admin/migrate` mit X-Admin-Key positive-control HTTP 200 in ~213ms
- DB-Connection: Supavisor-Pooler mit IPv4-Force (`family:4`), SSL — stabil
- Taler-Exchange-Client: GET /keys + GET /reserves/<pub> gegen `exchange.demo.taler.net` (Ed25519, KUDOS)
- **UX-Modernisierung (Commit 5ad8068, 661afb28, f389001)**: FinanceScreen (animierte Balance-Card, Quick Actions, Timeline), HealthScreen (Shimmer, DoctorCards mit Presseffekt, Gradienten), MobilityScreen (GPS/Route/Marker Widgets, Gradienten)
- **CI-Fix Runde 1**: `unnecessary_null_comparison` lint durch `// ignore:` gelöst, `dart format` auf beide Screens angewandt
- **CI-Fix Runde 2 (2026-07-27)**: `withOpacity` statt `withValues` (Flutter 3.24.5), `unnecessary_non_null_assertion` in `home_screen.dart` entfernt, Conditional Imports korrigiert, `deploy-web.yml` safe.directory Fix — alle CI-Workflows grün (Commit 246ece3)
- **Phase A: Mini-Program-Container (Commit 92ec307)**: 10 Mini-Programme + Apps-Tab + Conditional Imports (web/mobile)
- **AI-Home Dashboard (Commit 0308bfaa)**: Personalisierter Startseiten-Tab mit Greeting-Card + Nearby-Stops + RecordAction-Cross-Provider
- **Dashboard-Navigation (Commits bd04e2b + 4fcb0ac)**: Quick Actions, Stat-Karten und AI-Vorschläge navigieren per onNavigateTab-Callback. CI grün ✅
- **Phase B: Wetter-Mini-Programm (Commit 9e42a30)**: weatherService.ts + weather.ts + weather.html. DWD Open-Meteo mit 429-Retry (0d75f1f) ✅
- **Phase E Wetter Real-Fix ✅ (2026-07-27, Commit 99daa9c)**: Wetter-Tab-Bug "Wettervorhersage konnte nicht abgerufen werden" behoben — Render Free-Tier Shared-IP wurde von Open-Meteo mit HTTP 429 rate-limited. Mirror-Fallback-Pattern etabliert (gleiche Architektur wie mobilityService.ts Overpass-Mirror-List): Open-Meteo primary + Bright Sky DWD-Proxy (api.brightsky.dev). Trigger: HTTP 429/5xx/ECONNABORTED. Real-Data-Only (keine Mocks). 10 Regression-Tests grün. Live-Verifikation: heimat-backend.onrender.com/api/weather/forecast → 200 OK mit echten Berlin-Daten (21.1°C, Klarer Himmel). Public-API getWeather unverändert.
- **Quick-Actions-Flicker-Fix (Commit 8aad85f)**: getPersonalizedContext() überschrieb Quick Actions mit intent-spezifischen 2-Button-Sets („Störungen/Alternativ"). Fix: Nur Suggestions werden personalisiert, Quick Actions bleiben 4 Standard-Buttons. Dead Code entfernt. ✅
- Backend CI + Mobile CI grün auf `main`
- Swagger/OpenAPI /docs + /docs.json
- Mobilität und Gesundheit (100% Overpass-Live, standortunabhängig) seit MVP grün

### Was ist offen
- **Kein lokaler E2E-Nachweis:** Kein lokaler Backend-Server und kein lokales PostgreSQL; für reale Funktionsaussagen sind CI mit Datenbank oder read-only Production-Checks erforderlich.
- **Universelle Event-Suche:** Production-`fail`, bis `/api/search` echte Event-Ergebnisse liefert.
- **Abfall:** `degraded` an Orten ohne belegte kommunale Quelle (`CITY_NOT_SUPPORTED`).
- **Nicht vollständig verifiziert:** Mobility-Journey, Finance, Health, Check-in und AI-Chat bleiben unbewertet/offen.
- EUR-Exchange: Wallet-Balance bleibt 0.00 KUDOS bis EUR-Production-Exchange (oder bank.demo.taler.net) echtes Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. Demo-Mock-Bypass fundLocal liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" + `_computeMockLiveStatus` entfernt (Commit 7718333). audit-no-mocks.sh enforced in CI (Commit 82047ad). User-Regel (AGENTS.md:143 + knowledge.md:283): "mock, simulation, fake sind verboten".
- **migrate.ts Unit-Test ✅ (Commit 06dc2e3)** — 18 Tests, alle gruen

### Was fehlt
- ~~Flutter Integration-Tests fehlen noch~~ ✅ erledigt in Phase Q (Commit 78a371d, `test/auth_integration_test.dart` mit 6 Tests).
- ~~Auth-Routing-Bug Regression-Test in mobile tests~~ ✅ erledigt in Phase Q (5 Tests in `auth_gate_test.dart`).
- Auto-Migration health-check Tool

**Auth-Track seit 2026-07-25 end-to-end live auf Production** (`/api/auth/{register, login, me}` gegen `heimat-backend.onrender.com`, Smoke-Test-User in Supabase-Production-DB).

**Quality-Pass Phase Q ✅ (2026-07-27, Commit 78a371d, CI grün via ea29e63):** AuthGate-Extraktion eliminiert Production-Test-Drift. Neu: `lib/core/auth/auth_gate.dart` mit required `authenticated` Parameter (Single Source of Truth). `main.dart` Route '/' jetzt `AuthGate(authenticated: const MainScreen())`. 11 neue authlock-regression-Tests (5 `auth_gate_test.dart` + 6 `auth_integration_test.dart` mit FakeAuthProvider Stub-Vererbungs-Pattern). Flutter CI läuft automatisch.

### Was bereits implementiert ist
- Mobilität: Overpass, Nominatim, OSRM, transitous.org, RAPTOR, GTFS Stop-Matching
- Gesundheit: 100% Overpass-Live (weltweit, keine Seed-Daten), classifySpecialty 25 Rules, 21 Specialty-Chips, dynamische DB bei Terminbuchung via ensureDoctorInDb()
- Finanzen: Taler Wallet-Client (echte GNU-Taler-Software, Ed25519, /keys + /reserves/<pub>). **Currency dynamisch aus /keys (d91fc76)** — EUR-ready via `TALER_EXCHANGE_URL` env var.
- AI: Intent-Klassifikation (BayesClassifier), Disruption-Analyse, Personal Routing
- ML-Service: LightGBM Delay Predictor + Naive Bayes Budget Classifier (mit Training-Endpoints)
- **Auth: JWT + bcryptjs — end-to-end live auf Production** (Register/Login/Profile/Password; Flutter-Token-Roundtrip via `AuthProvider`+`AuthService`+`AuthGate`; AppBar mit Logout-PopupMenu; Login-Routing-Bug 2026-07-25 gefixt)
- Validierung: Zod für alle Routes
- API-Docs: Swagger/OpenAPI 3.0 auf `/docs`
- Tests: 113+ Tests (Backend + Flutter); 14 dedizierte Auth-Tests grün
- Sicherheit: Admin-Key geschützt, CORS eingeschränkt, Health-Checks mit DB/Ping, JWT-Auth-Roundtrip verifiziert

### Render + Supabase Production-Anbindung (Juli 2026)
`render.yaml` ist auf **Supavisor-Pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`), `DB_SSL=true`, Node 20, devDeps-Prune. Klassischer `db.<project>.supabase.co` (Supabase-IPv6-only) ist von Render Free Tier (IPv4-only) nicht erreichbar; Supavisor-Pooler bridged das.

### Dateien die du kennen musst
- `bauplan.md` — alle Tasks mit Status ✅/🔲
- `heimat-plan.md` — Gesamtplanung, Task 18 ist offen
- `.claude/CLAUDE.md` — Projekt-Regeln, Tech-Stack, Befehle
- `src/backend/src/` — Node.js Express API
- `src/mobile/lib/` — Flutter App
- `src/ml-service/` — Python FastAPI ML-Service

### ✅ Phase X.1 — IFrame-Elimination (2026-07-28, Commits b80b07d + 0d7ef3d)
**Status:** Live. Frontend komplett ohne externe Webseiten-Einbettung. Dieser Handoff-Abschnitt beschreibt den historischen Phase-X.1-Stand (3 native + 7 Coming Soon); spätere Registry-Einträge werden separat nach realem Datenpfad, Tests und Production-Check bewertet. KEIN IFrame, KEIN WebView, KEIN `dart:html`.

**Commits:**
- `b80b07d` feat(miniprogram) — 11 files (5 modified + 4 deleted + 1 new), Phase X.1 Haupt-Refactor
- `0d7ef3d` fix(phase-x-1) — 2 new test files + index.ts cleanup (path-Import entfernt)

**Was funktioniert:**
- Historischer Phase-X.1-Stand: `weather`, `air`, `waste` = echte Native-Screens; weitere Services waren damals `ComingSoonScreen`-Placeholder. Der aktuelle Code-Stand ist in `ServiceRegistry` und Version-12-Nachweisen zu prüfen.
- **+16 neue Tests** (Phase R-Q-Backend ~177 + Phase X.1: 12 in service_registry_test.dart + 4 in coming_soon_screen_test.dart)
- `MiniProgram.url`: Sentinel-URLs `native://registry/<id>` (kein HTTP-Request, nur Registry-Lookup)
- `index.ts`: `/mini`-Static-Serving entfernt (`express.static(miniDir, ...)` weg)

**Was entfernt wurde (5 Files):**
- `src/mobile/lib/features/miniprogram/presentation/miniprogram_container.dart` (war IFrame-Web-Container)
- `src/mobile/lib/features/miniprogram/presentation/miniprogram_container_stub.dart` (Stub-Container)
- `src/mobile/lib/features/miniprogram/presentation/miniprogram_container_web.dart` (war `dart:html` IFrameElement)
- `src/backend/public/miniprograms/air.html` (Dead IFrame-Code seit Phase B nativer Air-Quality)
- `src/backend/public/miniprograms/weather.html` (Dead IFrame-Code seit Phase E nativem Wetter)

### ✅ Phase X.1.5 — MD-Files-Sweep (2026-07-28, Commit 9eed3a0 + Amend)
**Status:** Live. Konsistenz zwischen Code (Phase X.1) und Docs. AGENTS.md + HANDOFF.md + README.md + bauplan.md spiegeln die neue Frontend-Architektur wider.

**Was aktualisiert wurde:**
- AGENTS.md (+35 LOC) — Neue Sektion "HEIMAT Architecture Rules (Phase X)": ServiceRegistry-Pattern, KEIN IFrame/WebView/dart:html-Regel, Phase-X.2-Refactor-Liste (7 Backend-Services mit hardcoded URLs), Phase-X.3-Mobile-Dynamic-Config-Plan, verstaerkter Mock-Policy-Hinweis.
- HANDOFF.md (dieser Eintrag) — Phase-X.1-Recap mit Commit-SHAs, +16-Tests-Delta, 10-Mini-Programme-Status, 5-entfernte-Files.
- README.md (+15 LOC) — Neue Sektion "Mini-Programme (Apps-Tab)", Roadmap-Tabelle mit Phase C-1 + Phase X.1, HEIMAT-Expansion-Tabelle mit 5 Services auf Native.
- bauplan.md (+50 LOC, "Phase X.1.5" Sektion) — docs-sweep Marker mit Status, Lessons-Learned, Konvention-Compliance.

### Phase X.2 + X.3 + X.4 Roadmap
| Task | Ziel | Status |
|---|---|---|
| Phase X.2 Backend-Config-Registry | `src/backend/src/config/externalServices.ts` als typisierte Singleton-Config, 9 Backend-Services refactoren | ⏳ next |
| Phase X.3 Backend-driven BBox-Defaults | `GET /api/config/location-defaults` Endpoint, waste_provider.dart konsumiert statt 9 hardcoded Konstanten | ⏳ after X.2 |
| Phase X.4 Per-Service Native Migration | 7 ComingSoonScreen-Services zu echten Native-Screens (events, jobs, hotels, buergeramt, mobility, finance, health) | ⏳ after X.3 |

---

## HEIMAT Expansion Plan (Phase 25-26) — Juli 2026

### Neue Services (10+)

| # | Service | Datenquelle | AI | Phase |
|---|---------|------------|-----|-------|
| 4 | 💬 Futai Chat/Social | github.com/abatn/futai via Mini-Program | Ollama KI-Twin | D |
| 5 | 🌤️ Wetter | DWD opendata.dwd.de (CC-BY) | Unwetter-Früherkennung | B |
| 6 | 🌬️ Luftqualität | UBA luftdaten.umweltbundesamt.de | Gesundheitsempfehlung | B |
| 7 | 🗑️ Abfallkalender | Kommunale Open-Data | Sortier-Tipps + Erinnerung | B |
| 8 | 🔌 E-Ladestationen | OSM Overpass + GoingElectric | Routenplanung | C |
| 9 | 💼 Job-Suche | BA Bundesagentur + Adzuna | Job-Matching | D |
| 10 | 📰 Veranstaltungen | Wikidata + OSM | Persönl. Empfehlung | D |
| 11 | 🏨 Hotels | OSM + Wikidata (Standorte) | Reise-Budget-Planung | E |
| 12 | 🅿️ Parken | OSM | — | C |
| 13 | 🏛️ Bürgeramt | Kommunale APIs | AI-Terminfindung | E |

### Bau-Phasen
**A: Mini-Program-Container (2-3d) ✅ Live (Commit 92ec307, 2026-07-27)** — 10 Mini-Programme + WebView-Framework.
B: Wetter/Luft/Abfall (3-5d) → C: Ladestationen/Parken (2-3d) → D: Futai/Jobs/Events (3-5d) → E: Hotels/Bürgeramt (5-7d) = ~15-20 Tage

### Futai-Integration
https://github.com/abatn/futai — React Native Social-Media-App mit KI-Chat (Ollama), 12 Emotionen, Gedächtnis, Social Feed (353 Tests). Integration via Mini-Program-Container (WebView), weil HEIMAT = Flutter ≠ React Native.

## OFFENE TASKS


### Phase 23: ✅ Finance-JWT-Roundtrip + Security-Härtung (2026-07-25 abgeschlossen)
**Status:** Historischer Phase-23-Nachweis. ADMIN_KEY auf Render gesetzt; der aktuelle Migrationspfad läuft im Startup-Hook; `/api/admin/migrate` bleibt der manuelle Admin-Pfad. security.test.ts Regression-Lock aktiv (Commit 3414aea).

Commits:
- `cfb0561` — Mobile Finance-Bearer-Header
- `e00105d` — URL-Pfade bereinigt + neue GET /wallet + Schema-Migration wallet_priv
- `25ac7ab` — Security-Fix: POST /api/migrate entfernt
- `3414aea` — security.test.ts Regression-Lock (POST /api/migrate → 404 + Body != Schema-loaded)
- `e7fcd85` — migrate.ts-Auto-Migration (idempotent, atomar); der aktuelle Aufruf erfolgt im Startup-Hook vor `app.listen`.

Verifikation: POST `/api/admin/migrate` mit X-Admin-Key Header gegen Render → HTTP 200 `{"success":true,"message":"Schema migrated"}` in 213ms.

### Phase R: Mock-Removal + Wallet 0.00 bis EUR-Exchange-Live (2026-07-27)
**Status:** ✅ Phase R geschlossen. Wallet-Balance bleibt 0.00 KUDOS bis ein EUR-Production-Exchange (oder bank.demo.taler.net) echtes Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. Demo-Mock-Bypass fundLocal (POST /api/finance/taler/fund-local) liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" im Finanzen-Tab-Bottom-Sheet + `_computeMockLiveStatus` im Apps-Tab entfernt (Commit 7718333). P2P-Send an registrierte HEIMAT-User bleibt funktional nach erfolgreichem Bank-Wire. audit-no-mocks.sh enforced in CI (Commit 82047ad) + Pre-Commit-Hook-Installer verfuegbar (bash scripts/install-audit-hook.sh). EUR-Production-Exchange bleibt offen (GLS-Bank-Integration).

**📱 Taler aus der App — User-Guide:**
Finanzen-Tab öffnen → Wallet auto-erstellt → 0.00 KUDOS → [Guthaben aufladen] → nur echter Reserve-Adresse-Weg (Phase R, 2026-07-27): App erzeugt reserve_pub → 4 Schritte: (1) bank.demo.taler.net öffnen, (2) registrieren, (3) echtes KUDOS-Wire vom bank.demo.taler.net-Konto ausfuehren, (4) zurück zu HEIMAT → [Aktualisieren] → Balance zeigt via Bank-Wire gebuchten Live-Wert. Demo-KUDOS-Option "25 Demo-KUDOS erhalten" wurde komplett entfernt (kein Mock-Bypass, kein Fake-Geld-Pfad).

**Backend bereits fertig:**
- `POST /api/finance/taler/reserve/open` → reserve_pub + bank_wire_url
- `POST /api/finance/taler/reserve` → existierende Reserve binden
- `GET /api/finance/balance` → Balance vom echten Exchange
- `POST /api/finance/taler/wallet` → Wallet auto-erstellen
- `GET /api/finance/taler/status` → Exchange-Status (✅ reachable=true nach denomination_keys-Fix)

## BEFEHLE

```bash
# Backend
cd src/backend && npm test          # Tests
cd src/backend && npx tsc --noEmit  # Typecheck

# Flutter
cd src/mobile && ./flutter/bin/flutter test
cd src/mobile && ./flutter/bin/dart format lib/ test/
cd src/mobile && ./flutter/bin/flutter analyze --no-fatal-infos
```

## REGELN
1. NIEMALS `git add -A` vom Repo-Root
2. Vendored Flutter SDK nutzen: `src/mobile/flutter/bin/`
3. Conventional Commits, lowercase, deutsch
4. Nach jeder Änderung: Tests laufen lassen
5. Nach jeder Änderung: bauplan.md aktualisieren
6. Keine Erfindungen, keine Halluzinationen
