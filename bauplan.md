# HEIMAT 2.0 – Bauplan: Echte Live-Daten statt Seed-Daten

> **Ziel:** Alle „statischen" Seed-Daten durch **echte Live-Daten** ersetzen.
> **Kein Mock, kein Fake im Code.**
> Abgeleitet aus: `project-prompt.md`, `heimat-plan.md`, `.loop.md`, `AI-Strategy.md`, `docs/abschlussdokumentation.md`.

---

## 1. Grundprinzip (Quellen)

- **100% Open Source, öffentliche Daten, keine Verträge/Lizenzen/Genehmigungen** (`project-prompt.md:14-21`, `heimat-plan.md:5`).
- MVP = Mobilität + Finanzen (P2P) + Gesundheit (Termine) (`project-prompt.md:191`, `heimat-plan.md:192-204`).
- Der DECIMAL-als-String-Bug ist bekannt (`heimat-plan.md:981-1005`, `.loop.md`): PostgreSQL DECIMAL → pg String → Flutter `.toDouble()` scheitert. Fix bleibt: `_toDouble()`-Helfer im Frontend.

---

## 2. Ausgangslage (im Code verifiziert)

| Bereich | Heute | Status | Fundstelle |
|---|---|---|---|
| Geocoding | Nominatim (`nominatim.openstreetmap.org`) | ✅ echt, live, kein Token | `mobilityService.ts:32` |
| Routing | OSRM (`router.project-osrm.org`) | ✅ echt, live, kein Token | `mobilityService.ts:39` |
| Haltestellen | `SELECT FROM stops` (5 Seed-Zeilen) | ❌ statisch | `mobilityService.ts:12`; `schema.sql:142` |
| Ärzte | `SELECT FROM doctors` (5 Seed-Zeilen) | ❌ statisch | `healthService.ts:36`; `schema.sql:150` |
| Wallet-Guthaben | Seed 150/75/200 € | ❌ Fake | `financeService.ts:22`; `schema.sql:158` |
| Termine buchen | `INSERT INTO appointments` | ✅ dynamisch | `healthService.ts:104` |
| P2P-Transaktion | `INSERT INTO transactions` + Balance-Update | ✅ dynamisch (aber Fake-Guthaben) | `financeService.ts:40` |

**Fazit:** Das Backend ist zur Hälfte schon echt. Der „Müll" = 3 statische Seed-Quellen: `stops`, `doctors`, `wallets`.

---

## 3. Deployment-Realität (`.loop.md`)

- Backend: https://heimat-backend.onrender.com (Render.com, Free-Tier → Cold-Start)
- PostgreSQL: Supabase (`sqbiqzwkcryhcyvftumb.supabase.co`)
- Frontend: https://abatn.github.io/HEIMAT/ (GitHub Pages)
- **Keine lokale GPU/Umgebung** → App läuft nur über Render + Supabase. Alle „echten Daten" müssen aus öffentlichen APIs oder der Supabase-DB kommen.
- **Kein API-Token nötig** (im Backend verifiziert: keine Auth-Middleware, keine kommerziellen API-Keys).

---

## 4. Phase 1 — Mobilität: echte OSM-Haltestellen

**Priorität 1** (`heimat-plan.md:170,186` – höchster Nutzen, geringster Aufwand).

- `mobilityService.getNearbyStops(lat,lng,radius)` → **Overpass API** (`https://overpass-api.de/api/interpreter`), kein Token.
  - Query: `node[public_transport=platform]` / `[highway=bus_stop]` / `[railway=station]` im Radius.
- `mobilityService.searchStops(text)` → Overpass/Nominatim statt DB-`ILIKE`.
- DB-Tabelle `stops` wird **Cache mit TTL** (nicht mehr Primärquelle) → Overpass-Rate-Limits abfedern.
- `User-Agent: HEIMAT-App/1.0`-Header (wie Nominatim schon nutzt); bei Overpass-Fehler Fallback auf Cache.
- Frontend `mobility_provider.dart`: echte GPS-Position → echte Stops in der Nähe. `_toDouble()` bleibt zwingend.

**Betroffene Dateien:** `src/backend/src/services/mobilityService.ts`, `src/mobile/lib/features/mobility/presentation/mobility_provider.dart`.

---

## 5. Phase 2 — Gesundheit: OSM-Anzeige + Arzt-Registrierung

- **2a Anzeige:** `healthService.searchDoctors()` zieht zusätzlich **Overpass `amenity=doctors` / `healthcare=*`** → echte Praxen deutschlandweit.
- **2b Registrierung** (`heimat-plan.md:160` „Ärzte tragen sich selbst ein"): neuer Endpoint **`POST /api/health/doctors`** (Name, Fachrichtung, Adresse, Telefon, Koordinaten, Slots) → Ärzte-DB wächst echt.
  - Frontend: „Arzt eintragen"-Formular.
- Buchbare Slots nur für **registrierte** Ärzte. OSM-Praxen = nur Anzeige + Disclaimer (`heimat-plan.md:372`: „Terminvorschläge sind unverbindlich").

**Betroffene Dateien:** `src/backend/src/services/healthService.ts`, `src/backend/src/routes/health.ts` (neuer POST), `src/mobile/lib/features/health/...`.

---

## 6. Phase 3 — Finanzen: echtes GNU Taler / Lightning

**Größte Phase (Wochen).** Referenz: `heimat-plan.md:118-138,315-325`, `project-prompt.md:66`.

### Ehrliche Realität (wichtig)
Echtes EUR bräuchte einen **lizenzierten Exchange** → verstößt gegen „keine Verträge/Lizenzen" (`heimat-plan.md:319-325`). Daher **echtes Protokoll auf Testnet**:

- **GNU Taler (Hauptoption):** Anbindung an öffentlichen Demo-Exchange (`exchange.demo.taler.net`).
  - Währung **KUDOS** (Spielgeld), aber **echtes, dezentrales Settlement über das echte Taler-Protokoll** – kein Mock/Fake im Code.
- **Lightning (Fallback):** Testnet-Node/Faucet, echtes LN-Protokoll (kein echtes BTC).

### Umbau
- `financeService.getWallet()` / `createPayment()` rufen den echten Taler-Exchange statt eines DB-`balance`-Feldes.
- DB behält nur Transaktions-Log/Cache.
- **Seed-Wallets (`schema.sql:158-161`) entfernen** – kein Fake-Guthaben.
- Frontend `finance_provider.dart`: einmalige Wallet-Verknüpfung (`heimat-plan.md:129`), echte P2P-Sendung (QR/Username).

### Zwischenschritt
Erst Taler-Testnet-Prototyp (KUDOS) lauffähig machen, dann UI anbinden.

**Betroffene Dateien:** `src/backend/src/services/financeService.ts`, `src/backend/src/routes/finance.ts`, `src/mobile/lib/features/finance/presentation/finance_provider.dart`.

---

## 7. Phase 4 — schema.sql bereinigen

- Seed-Blöcke `stops` / `doctors` / `wallets` (`schema.sql:142-161`) entfernen bzw. als Cache-Struktur behalten. Tabellenstruktur bleibt.
- `doctor_slots`-Seed nur noch für registrierte Ärzte generieren.

---

## 8. Phase 5 — Verifikation (kein Fake-Test)

- **Live-`curl`** gegen Render: Stops für Berlin ≠ München (Beweis: echt & dynamisch).
- Backend: `npm run lint`, `npx tsc --noEmit`, `npm test`.
- Mobile (vendored SDK): `flutter analyze --no-fatal-infos`, `dart format lib/ test/`, `flutter test`.
- Deploy: Render (Backend) + GitHub Pages (Web).
- `.loop.md` aktualisieren.

---

## 9. Tradeoffs (ehrlich dokumentiert)

- **Overpass/Nominatim Rate-Limits** → Caching in DB nötig.
- **Render Free-Tier Cold-Start** → langsamere erste Antwort; externe Overpass-Calls verlängern sie.
- **Taler/Lightning „echt" = Testnet-Währung**, weil echtes Geld ohne Lizenz gegen die Projektprinzipien verstößt (`heimat-plan.md:319-325`).

---

## 10. Reihenfolge (nach `heimat-plan.md`-Priorität)

1. **Mobilität (OSM/Overpass)** — schnellster sichtbarer Effekt gegen die Statik.
2. **Gesundheit (OSM-Anzeige + Registrierung).**
3. **Finanzen (GNU Taler Testnet)** — größter Aufwand zuletzt.
