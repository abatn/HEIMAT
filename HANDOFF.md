# HANDOFF-PROMPT für nächsten Agenten

## Projekt
HEIMAT 2.0 — Open-Source Super App für Deutschland (Flutter + Node.js + Python ML)

## aktueller Stand

**19 von 20 Tasks abgeschlossen.** Nur noch 1 Task offen.

### Was bereits implementiert ist
- Mobilität: Overpass, Nominatim, OSRM, transitous.org, RAPTOR, GTFS Stop-Matching
- Gesundheit: Overpass-Ärzte, Registrierung, Slots, Terminbuchung
- Finanzen: Echter GNU-Taler-Exchange-Client (Ed25519-Identity, /keys + /reserves/<pub> gegen exchange.demo.taler.net)
- AI: Intent-Klassifikation (BayesClassifier), Disruption-Analyse, Personal Routing
- ML-Service: LightGBM Delay Predictor + Naive Bayes Budget Classifier (mit Training-Endpoints)
- Auth: JWT + bcryptjs (Register/Login/Profile/Password)
- Validierung: Zod für alle Routes
- API-Docs: Swagger/OpenAPI 3.0 auf `/docs`
- Tests: 80+ Tests (Backend + Flutter)
- Sicherheit: Admin-Key geschützt, CORS eingeschränkt, Health-Checks mit DB/Ping

### Dateien die du kennen musst
- `bauplan.md` — alle Tasks mit Status ✅/🔲
- `heimat-plan.md` — Gesamtplanung, Task 18 ist offen
- `.claude/CLAUDE.md` — Projekt-Regeln, Tech-Stack, Befehle
- `src/backend/src/` — Node.js Express API
- `src/mobile/lib/` — Flutter App
- `src/ml-service/` — Python FastAPI ML-Service

## OFFENER TASK

### Phase 18: Echte Taler-Exchange

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
