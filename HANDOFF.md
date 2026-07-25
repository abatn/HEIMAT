# HANDOFF-PROMPT für nächsten Agenten

## Projekt
HEIMAT 2.0 — Open-Source Super App für Deutschland (Flutter + Node.js + Python ML)

## aktueller Stand

**Auth-Track seit 2026-07-25 end-to-end live auf Production** (`/api/auth/{register, login, me}` gegen `heimat-backend.onrender.com`, Smoke-Test-User in Supabase-Production-DB).

### Was bereits implementiert ist
- Mobilität: Overpass, Nominatim, OSRM, transitous.org, RAPTOR, GTFS Stop-Matching
- Gesundheit: Overpass-Ärzte, Registrierung, Slots, Terminbuchung
- Finanzen: Echter GNU-Taler-Exchange-Client (Ed25519-Identity, /keys + /reserves/<pub> gegen exchange.demo.taler.net)
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

### Finance: Mobile JWT-Integration
`finance_provider.dart:45` hat `user-demo-001` hartkodiert. Backend JWT ist live auf Production, Mobile-Finance nutzt es aber noch nicht.

**Schritte:**
1. `AuthService.userId` als einziger Identifier in `FinanceProvider` durchschleifen statt Demo-User.
2. `Wallet/Balance/Transactions/Pay`-Calls mit `auth.authHeaders` (Token) statt Mock-Headers.
3. Tests gegen Live-Backend oder Mock-JWT schreiben.
4. UX: Beim ersten Login wird Wallet automatisch erstellt (Backend hat schon Auto-Create-on-First-Wallet-Request).

### Phase 18: Echte Taler-Exchange (Backend-Code fertig, E2E noch offen)

**Was ist das?**
Der `talerService.ts` (Phase 18 abgeschlossen) spricht echte GNU-Taler-Wire-Spec — Ed25519-Reserve-Identity, `GET /keys` + `GET /reserves/<pub>` Lives gegen `exchange.demo.taler.net`, Bank-Wire-Workflow über `bank.demo.taler.net/webui`.

**Was muss gemacht werden?**
1. Prüfe ob `exchange.demo.taler.net` erreichbar ist (GNU Taler Demo-Exchange)
2. Implementiere echte Taler-API-Calls in `talerService.ts`:
   - `/keys` — Exchange-Public-Keys laden
   - `/coins/TOKEN-DENOMINATION` — Coins abheben
   - `/coins/TOKEN-DENOMINATION/deposit` — Coins einzahlen
   - `/coins/TOKEN-DENOMINATION/melt` — Coins umschmelzen
   - `/coins/TOKEN-DENOMINATION/refund` — Coins zurückerstatten
3. Ersetze die lokale Balance-Verwaltung durch echte Taler-Transaktionen
4. Behalte die DB nur als Cache/Log (nicht als Primärquelle)
5. Tests schreiben für den echten Exchange
6. 503-Propagation wenn Exchange nicht erreichbar (kein Fallback — Architekturentscheidung)

**Wichtig:**
- Nutze das echte Taler-Protokoll (Production-Wire-Spec)
- Währung: KUDOS (echte GNU-Taler-Testnet-Currency)
- Kein echtes Geld, kein echtes Risiko
- Wenn der Exchange nicht erreichbar ist → 503-Propagation (kein Fallback)

**Nächste Schritte nach Taler:**
- CI/CD für ML-Service
- E2E-Tests mit echtem Backend-Deploy
- Performance-Optimierung
- DSGVO-Audit

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
