---
name: heimat-deploy
description: "Deployment & CI/CD für HEIMAT. Trigger bei Änderungen an render.yaml, docker-compose.yml, .github/workflows/ oder Dockerfile."
---

# HEIMAT Deployment Skill

## Deployment-Ziele

| Komponente | Ziel | URL |
|---|---|---|
| Backend | Render.com | https://heimat-backend.onrender.com |
| Frontend (Web) | GitHub Pages | https://abatn.github.io/HEIMAT/ |
| DB | Supabase | sqbiqzwkcryhcyvftumb.supabase.co |
| Redis | Render | Free-Tier |

## Render.com (Backend)

- **Plan:** Free (512MB RAM, Cold-Start)
- **Region:** Frankfurt
- **Build:** `cd src/backend && npm install --include=dev && npm run build`
- **Start:** `cd src/backend && node dist/index.js`
- **DB_HOST:** `db.sqbiqzwkcryhcyvftumb.supabase.co`
- **Redis:** via Render internal service

## GitHub Pages (Frontend)

- Trigger: Push `src/mobile/**` zu `main`
- Build: `flutter build web --base-href "/HEIMAT/"`
- Deploy: GitHub Actions → `actions/deploy-pages`

## Docker Compose (lokal)

```bash
docker-compose up
# Services: db (Postgres 15), redis, backend, db-rest, ml-service, frontend
```

## CI Workflows

| Workflow | Trigger | Reihenfolge |
|---|---|---|
| `flutter.yml` | Push src/mobile/** | dart format → analyze → test |
| `backend.yml` | Push src/backend/** | lint → test → tsc |
| `deploy-web.yml` | Push src/mobile/** zu main | flutter build → deploy |
| `dependabot-auto-merge.yml` | Dependabot PRs | Auto-merge minor/patch |

## Bekannte Deploy-Probleme

### Cold-Start (Render Free-Tier)
Backend braucht 30-60s beim ersten Request. Overpass-Calls verlängern das.

### GTFS-Import nicht auf Render
Free-Tier hat zu wenig Memory/Timeout für 244MB GTFS-Download.
→ Import läuft lokal via `src/backend/scripts/import-gtfs-local.ts`.
