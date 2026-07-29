---
name: heimat-backend
description: "Backend-Entwicklung für HEIMAT. Trigger bei Änderungen an src/backend/. Enthält TypeScript-Befehle, Test-Anleitung und bekannte Bugs."
---

# HEIMAT Backend Skill

## Befehle (in `src/backend/` ausführen)

```bash
npm run lint         # ESLint
npm test             # Jest (braucht Postgres)
npx jest src/__tests__/mobility.test.ts   # Einzeltest
npx tsc --noEmit     # Typecheck
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

## Health AI Agent (2026-07-29)

### Backend Health AI Endpoints
| Methode | Pfad | Service | Beschreibung |
|---------|------|---------|-------------|
| `POST` | `/api/ai/chat` | ollamaService | Symptom-Assessment + Triage + Arzt-Empfehlung |
| `GET` | `/api/ai/status` | ollamaService | Ollama-Verbindungsstatus (158.180.18.110:11434) |
| `GET` | `/api/ai/service-prompt` | promptService | Service-Prompts mit Health-Daten |
| `GET` | `/api/health/doctors` | healthService | Overpass-Arztsuche (Echtzeit) |

### Hybrid-Architektur
- **On-Device (TFLite):** Notfall-Erkennung (<10ms, keine Netzwerk-Latenz)
- **Backend (Ollama):** Adaptives Gespräch + Triage (500-2000ms)
- **Haftungsausschluss:** "Keine medizinische Diagnose – bei Unsicherheit 112"

### Wichtige Dateien
- `services/ollamaService.ts` – Ollama-Client (chat, chatWithContext)
- `services/promptService.ts` – Service-Prompts, fetchHealthData(), Cross-Service-Context
- `routes/ai.ts` – AI-Routen (POST /api/ai/chat, GET /api/ai/status, GET /api/ai/service-prompt)

---

## Datei-Struktur

```
src/backend/src/
├── index.ts              # Express App Setup
├── routes/               # API-Endpunkte
│   ├── mobility.ts       # ÖPNV, Haltestellen, Routing
│   ├── finance.ts        # Taler P2P
│   ├── health.ts         # Arzt-Suche, Termine
│   ├── admin.ts          # Admin-Endpoints
│   ├── ai.ts             # AI-Chat, Service-Prompts
│   └── waste.ts          # Abfallkalender
├── services/             # Business-Logik
│   ├── mobilityService.ts
│   ├── financeService.ts
│   ├── healthService.ts
│   ├── raptorService.ts  # GTFS RAPTOR-Engine
│   ├── talerService.ts   # GNU Taler
│   ├── aiService.ts      # ML-Services
│   ├── ollamaService.ts  # Ollama-Client (Health AI)
│   ├── promptService.ts  # Service-Prompts (Health, Weather, etc.)
│   └── wasteService.ts   # Abfallkalender (BSR/AWB/SRH)
├── database/
│   └── schema.sql        # DB-Schema (einzige Quelle)
├── __tests__/            # Jest-Tests
└── middleware/           # Error-Handler
```

## Wichtig

- Schema-Quelle: `src/database/schema.sql` — CI lädt via `psql`
- GTFS-Import: `src/backend/scripts/import-gtfs-local.ts` (nicht auf Render — Free-Tier Limit)
- Kein `npm run migrate` oder `npm run seed`
