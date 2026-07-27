# HANDOFF-PROMPT für nächsten Agenten

## Projekt
HEIMAT 2.0 — Open-Source Super App für Deutschland (Flutter + Node.js + Python ML)

## aktueller Stand

**Phase 23 Recap — Stand Juli 2026:** Auf einen Blick: Produktion läuft, Finance-Roundtrip ist end-to-end live, Auto-Migration ist abgesichert.

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
- Mobilität und Gesundheit seit MVP grün

### Was ist offen
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
- Gesundheit: Overpass-Ärzte, Registrierung, Slots, Terminbuchung
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
**Status:** Live. ADMIN_KEY auf Render gesetzt. preDeployCommand (auto) + `/api/admin/migrate` (manual) beide grün. security.test.ts Regression-Lock aktiv (Commit 3414aea).

Commits:
- `cfb0561` — Mobile Finance-Bearer-Header
- `e00105d` — URL-Pfade bereinigt + neue GET /wallet + Schema-Migration wallet_priv
- `25ac7ab` — Security-Fix: POST /api/migrate entfernt
- `3414aea` — security.test.ts Regression-Lock (POST /api/migrate → 404 + Body != Schema-loaded)
- `e7fcd85` — render.yaml preDeployCommand + migrate.ts (Auto-Migration, idempotent, atomar)

Verifikation: POST `/api/admin/migrate` mit X-Admin-Key Header gegen Render → HTTP 200 `{"success":true,"message":"Schema migrated"}` in 213ms.

### Phase R: Mock-Removal + Wallet 0.00 bis EUR-Exchange-Live (2026-07-27)
**Status:** ✅ Phase R geschlossen. Wallet-Balance bleibt 0.00 KUDOS bis ein EUR-Production-Exchange (oder bank.demo.taler.net) echtes Taler-Guthaben via Reserve-Adresse-Bank-Wire bucht. Demo-Mock-Bypass fundLocal (POST /api/finance/taler/fund-local) liefert HTTP 410 Gone (Commit 2d3ae18). Mobile Demo-Button "25 Demo-KUDOS" im Finanzen-Tab-Bottom-Sheet + `_computeMockLiveStatus` im Apps-Tab entfernt (Commit 7718333). P2P-Send an registrierte HEIMAT-User bleibt funktional nach erfolgreichem Bank-Wire. audit-no-mocks.sh enforced in CI (Commit 82047ad) + Pre-Commit-Hook-Installer verfuegbar (bash scripts/install-audit-hook.sh). EUR-Production-Exchange bleibt offen (GLS-Bank-Integration).

**📱 Taler aus der App — User-Guide:**
Finanzen-Tab öffnen → Wallet auto-erstellt → 0.00 KUDOS → [Guthaben aufladen] → nur echter Reserve-Adresse-Weg (Phase R, 2026-07-27): App erzeugt reserve_pub → 4 Schritte: (1) bank.demo.taler.net öffnen, (2) registrieren, (3) echtes KUDOS-Wire auslösen, (4) zurück zu HEIMAT → [Aktualisieren] → Balance zeigt via Bank-Wire gebuchten Live-Wert. Demo-KUDOS-Option "25 Demo-KUDOS erhalten" wurde komplett entfernt (kein Mock-Bypass, kein Fake-Geld-Pfad).

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
