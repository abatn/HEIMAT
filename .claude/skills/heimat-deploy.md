---
name: heimat-deploy
description: "Deployment & CI/CD für HEIMAT. Trigger bei Änderungen an render.yaml, .github/workflows/ oder Dockerfile."
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
- **Build:** `cd src/backend && npm install --include=dev && npm run build && mkdir -p dist/database && cp src/database/schema.sql dist/database/`
- **Start:** `cd src/backend && node dist/index.js`
- **DB_HOST:** `aws-0-eu-west-1.pooler.supabase.com` (Supavisor-Pooler — IPv4-von Render Free Tier erreichbar; der direkte `db.<ref>.supabase.co` Hostname ist IPv6-only und von Render Free nicht erreichbar)
- **DB_SSL:** `true`
- **DB_USER:** `postgres.sqbiqzwkcryhcyvftumb` (Session-Pooler-Format: `user.<project_ref>`)
- **DB_PASSWORD:** sync:false (manuell im Render-Dashboard setzen — nicht im Repo committen!)
- **AUTO_MIGRATE:** Default aktiv (Migrations-Startup-Hook in `src/backend/src/index.ts` vor `app.listen`; mit `AUTO_MIGRATE=false` explizit deaktivierbar). `render.yaml` enthält zusätzlich `healthCheckPath: /health`.
- **ADMIN_KEY:** sync:false (manuell im Render-Dashboard setzen — schützt `/api/admin/migrate` vor unauth Aufrufen)
- **Redis:** via Render internal service

## GitHub Pages (Frontend)

- Trigger: Push `src/mobile/**` zu `main`
- Build: `flutter build web --base-href "/HEIMAT/"`
- Deploy: GitHub Actions → `actions/deploy-pages`

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
→ Import via `src/backend/scripts/import-gtfs-local.ts` (manuell ausgeführt).
