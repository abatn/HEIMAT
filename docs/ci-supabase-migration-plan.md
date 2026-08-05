# HEIMAT CI/CD — Supabase Test-DB Migration Plan

**Erstellt:** 2026-08-05 | **Status:** Planung

---

## Problem

Die CI-Tests schlagen fehl weil:
1. Lokaler PostgreSQL-Container startet langsam
2. Health-Check `pg_isready` meldet "fertig" zu früh
3. Tests starten BEVOR Postgres Verbindungen annehmen kann

**Symptom:** `connect ECONNREFUSED 127.0.0.1:5432`

---

## Lösung: Supabase Test-DB

### Warum Supabase?

| Aspekt | Lokaler Postgres | Supabase Test-DB |
|--------|------------------|------------------|
| **Startzeit** | 10-30s | Instant |
| **Timing-Problem** | Ja | Nein |
| **Produktionsgleichheit** | Nein | Ja |
| **Kosten** | €0 | €0 (Free-Tier) |
| **Wartung** | Manuell | Automatisch |

---

## Implementierungsplan

### Schritt 1: Supabase Test-DB erstellen

1. Supabase Dashboard öffnen
2. Neues Projekt erstellen: `heimat-test`
3. Connection-String notieren:
   ```
   Host: aws-0-eu-west-1.pooler.supabase.com
   Port: 5432
   Database: postgres
   User: postgres.<project-ref>
   Password: (aus Dashboard)
   SSL: true
   ```

### Schritt 2: GitHub Secrets hinzufügen

In GitHub Repository → Settings → Secrets → Actions:

| Secret | Wert |
|--------|------|
| `SUPABASE_TEST_HOST` | `aws-0-eu-west-1.pooler.supabase.com` |
| `SUPABASE_TEST_PORT` | `5432` |
| `SUPABASE_TEST_DB` | `postgres` |
| `SUPABASE_TEST_USER` | `postgres.<project-ref>` |
| `SUPABASE_TEST_PASSWORD` | (aus Dashboard) |

### Schritt 3: CI-Konfiguration anpassen

**Vorher:**
```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - 5432:5432
```

**Nachher:**
```yaml
# KEIN lokaler Postgres mehr nötig!
jobs:
  test:
    steps:
      - name: Initialize database
        env:
          DB_HOST: ${{ secrets.SUPABASE_TEST_HOST }}
          DB_PORT: ${{ secrets.SUPABASE_TEST_PORT }}
          DB_NAME: ${{ secrets.SUPABASE_TEST_DB }}
          DB_USER: ${{ secrets.SUPABASE_TEST_USER }}
          DB_PASSWORD: ${{ secrets.SUPABASE_TEST_PASSWORD }}
          DB_SSL: true
        run: psql -f src/database/schema.sql postgresql://${{ secrets.SUPABASE_TEST_USER }}:${{ secrets.SUPABASE_TEST_PASSWORD }}@${{ secrets.SUPABASE_TEST_HOST }}:${{ secrets.SUPABASE_TEST_PORT }}/${{ secrets.SUPABASE_TEST_DB }}
      
      - name: Run tests
        env:
          DB_HOST: ${{ secrets.SUPABASE_TEST_HOST }}
          DB_PORT: ${{ secrets.SUPABASE_TEST_PORT }}
          DB_NAME: ${{ secrets.SUPABASE_TEST_DB }}
          DB_USER: ${{ secrets.SUPABASE_TEST_USER }}
          DB_PASSWORD: ${{ secrets.SUPABASE_TEST_PASSWORD }}
          DB_SSL: true
        run: npm test
```

### Schritt 4: Supabase Schema initialisieren

```bash
# Schema laden
psql -f src/database/schema.sql postgresql://user:pass@host:5432/postgres

# Tabellen prüfen
psql -c "\dt" postgresql://user:pass@host:5432/postgres
```

### Schritt 5: Tests verifizieren

```bash
# Lokal gegen Supabase testen
DB_HOST=aws-0-eu-west-1.pooler.supabase.com \
DB_PORT=5432 \
DB_NAME=postgres \
DB_USER=postgres.<ref> \
DB_PASSWORD=xxx \
DB_SSL=true \
npm test
```

---

## Dateien die geändert werden müssen

| Datei | Änderung |
|-------|----------|
| `.github/workflows/backend.yml` | Lokalen Postgres entfernen, Supabase Secrets nutzen |
| `src/backend/jest.config.js` | globalSetup anpassen |
| `src/backend/src/__tests__/globalSetup.ts` | Supabase-Connection testen |
| `README.md` | CI-Hinweis aktualisieren |

---

## Risiken

| Risiko | Impact | Lösung |
|--------|--------|--------|
| Supabase Free-Tier Limit | Niedrig | Test-DB ist low-traffic |
| SSL-Probleme | Mittel | `DB_SSL=true` in allen Umgebungen |
| Schema-Drift | Niedrig | CI lädt Schema bei jedem Lauf |
| Kosten | Niedrig | Supabase Free-Tier reicht |

---

## Zeitaufwand

| Schritt | Aufwand |
|---------|---------|
| Supabase Test-DB erstellen | 10 Min |
| GitHub Secrets hinzufügen | 5 Min |
| CI-Konfiguration anpassen | 30 Min |
| Schema initialisieren | 5 Min |
| Tests verifizieren | 15 Min |
| **Gesamt** | **~65 Min** |

---

## Nächste Schritte

1. Supabase Test-DB erstellen
2. GitHub Secrets konfigurieren
3. CI-Konfiguration aktualisieren
4. Tests gegen Supabase laufen lassen
5. Alten lokalen Postgres aus CI entfernen
