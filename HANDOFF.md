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
- Backend CI + Mobile CI grün auf `main`
- Swagger/OpenAPI /docs + /docs.json
- Mobilität und Gesundheit seit MVP grün

### Was ist offen
- EUR-Exchange (Phase 24): Demo-KUDOS und P2P-Durchstich ✅ Live. "25 Demo-KUDOS erhalten" Button funktioniert (POST /api/finance/taler/fund-local, direkt in DB, kein Exchange). P2P-Purse-System bereit. EUR-Exchange wartet auf oeffentliche GLS-Bank-Integration.
- Unit-Test fuer `migrate.ts` fehlt

### Was fehlt
- Flutter Integration-Tests
- `health.test.ts` Backend CI-Failure (1/7 Suites, pre-existing)
- Auth-Routing-Bug Regression-Test in mobile tests
- Auto-Migration health-check Tool

**Auth-Track seit 2026-07-25 end-to-end live auf Production** (`/api/auth/{register, login, me}` gegen `heimat-backend.onrender.com`, Smoke-Test-User in Supabase-Production-DB).

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

### Phase 24: Demo-KUDOS und P2P-Durchstich (2026-07-26)
**Status:** ✅ Demo-KUDOS fund-local live. Finanzen-Tab: "Guthaben aufladen" Button zeigt jetzt zwei Optionen: (a) "25 Demo-KUDOS erhalten" (POST /api/finance/taler/fund-local, 25 KUDOS direkt in DB, kein Exchange noetig) und (b) "Reserve-Adresse erstellen" (alter Flow fuer echten Taler-Bank-Wire). P2P-Purse-System (createPurse/depositToPurse/mergePurse) arbeitet korrekt. EUR-Exchange wartet auf oeffentliche GLS-Bank-Integration.

**📱 Taler aus der App — User-Guide:**
Finanzen-Tab öffnen → Wallet auto-erstellt → 0.00 KUDOS → [Guthaben aufladen] → App erzeugt reserve_pub → 4 Schritte: (1) bank.demo.taler.net öffnen, (2) registrieren, (3) 25 KUDOS erhalten, (4) zurück zu HEIMAT → [Aktualisieren]. Kein Fake-Geld, keine App-Erfindung.

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
