---
name: heimat-backend
description: "Backend-Entwicklung für HEIMAT. Trigger bei Änderungen an src/backend/. Enthält TypeScript-Befehle, Test-Anleitung und bekannte Bugs."
---

# HEIMAT Backend Skill

## Befehle (in `src/backend/` ausführen)

```bash
npm run dev          # Dev-Server (ts-node-dev)
npm run lint         # ESLint
npm test             # Jest (braucht Postgres)
npx jest src/__tests__/mobility.test.ts   # Einzeltest
npx tsc --noEmit     # Typecheck (CI macht das)
```

## CI-Reihenfolge

lint → test → `tsc --noEmit`

## Bekannte Bugs

### CORS/helmet blockiert Responses
**Fix in `src/backend/src/index.ts`:**
```typescript
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
```

### Route-Konflikt `/stops/search` vs `/stops/:id`
Express matcht `/stops/search` als `:id` mit `id="search"`.
**Fix:** `/stops/search` VOR `/stops/:id` in `mobility.ts` definieren.

### db-rest Port-Mismatch (Render)
Docker Default `ENV PORT 3000`, Render routet auf 3001.
**Fix:** `ENV PORT=3000` in Dockerfile oder render.yaml anpassen.

## Datei-Struktur

```
src/backend/src/
├── index.ts              # Express App Setup
├── routes/               # API-Endpunkte
│   ├── mobility.ts       # ÖPNV, Haltestellen, Routing
│   ├── finance.ts        # Taler P2P
│   ├── health.ts         # Arzt-Suche, Termine
│   └── admin.ts          # Admin-Endpoints
├── services/             # Business-Logik
│   ├── mobilityService.ts
│   ├── financeService.ts
│   ├── healthService.ts
│   ├── raptorService.ts  # GTFS RAPTOR-Engine
│   ├── talerService.ts   # GNU Taler
│   └── aiService.ts      # ML-Services
├── database/
│   └── schema.sql        # DB-Schema (einzige Quelle)
├── __tests__/            # Jest-Tests
└── middleware/           # Error-Handler
```

## Wichtig

- Schema-Quelle: `src/database/schema.sql` — CI lädt via `psql`
- GTFS-Import: `src/backend/scripts/import-gtfs-local.ts` (lokal, nicht auf Render)
- Kein `npm run migrate` oder `npm run seed` — diese Scripts existieren nicht
