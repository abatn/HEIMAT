# HEIMAT 2.0 — Data Analytics Übersicht

## Executive Summary

Dieses Verzeichnis enthält 6 umfassende Datenanalysen für das HEIMAT 2.0 Projekt. Die Analysen decken Marktbewertung, KPI-Design, Datenqualität, Metrik-Diagnose, Dashboard und Investor-Report ab.

---

## Dateien

| Datei | Typ | Beschreibung |
|-------|-----|--------------|
| `market-sizing.md` | Markdown (~3 KB) | TAM/SAM/SOM Marktbewertung mit Sensitivitätsanalyse |
| `kpi-design.md` | Markdown (~4 KB) | 3 primäre, 6 Treiber-, 4 Guardrail-KPIs mit SQL-Berechnungen |
| `data-quality-audit.md` | Markdown (~5 KB) | 16 Tabellen analysiert, 3 kritische + 4 hohe + 5 mittlere Probleme |
| `metric-diagnostics.md` | Markdown (~6 KB) | 8 dokumentierte Bugs mit Root-Cause-Analyse und Fix-Plänen |
| `dashboard.html` | HTML (~8 KB) | Selbstständiges Dark-Theme Dashboard (kein Framework nötig) |
| `investor-report.md` | Markdown (~7 KB) | Executive Summary, Finanzplan, Roadmap, Ask (€50K) |
| `AGENT-PROMPT.md` | Markdown | Vollständiger Agent-Prompt für die Analyse-Durchführung |

**Gesamt:** ~33 KB analytischer Inhalt

---

## Key Findings

### Markt (market-sizing.md)
- **TAM:** €8,2 Mrd. (digitale Alltagsdienste in Deutschland)
- **SAM:** €340–520 Mio. (datenschutzbewusste + OSS-Nutzer)
- **SOM Jahr 1:** €0,5–2 Mio. (5.000–20.000 Nutzer)
- **Break-Even:** Bereich bei ~5–18 Nutzern mit €150/Jahr-Wert

### KPIs (kpi-design.md)
- **Primäre KPIs:** WAU (Ziel: 5.000), Feature Adoption (60/30/20%), NPS (>30)
- **Treiber:** Journey Success Rate (>80%), Route P95 (<2.000ms), Taler Volume (>50/Tag)
- **Guardrails:** API Error Rate (<1%), Uptime (>99%), Latency P95 (<1.000ms)

### Datenqualität (data-quality-audit.md)
- **3 kritische Probleme:** Fehlende CHECK-Constraints, inkonsistente DECIMAL/VARCHAR-Typen, fehlende ON DELETE-Strategien
- **4 hohe Probleme:** Fehlende Updated-At-Trigger, fehlende Indexe, redundante Timestamps, kein Soft-Delete
- **Gesamtbewertung:** Solide, mit Verbesserungspotenzial

### Bugs (metric-diagnostics.md)
- **4 kritische Bugs:** Journey-Parameter-Mismatch, db-rest Port-Konflikt, DB_REST_URL nicht injected, Route-Konflikt
- **2 mittlere Bugs:** ISO-Datum Parsing, kein GPS-Start
- **2 niedrige Bugs:** Graue Linienbadges, fragiles Stop-Mapping
- **Lösungsaufwand:** ~2 Stunden gesamt
- **Erwartete Verbesserung:** 0% → 80%+ Feature-Funktionalität

### Deployment
- **Backend:** heimat-backend.onrender.com (Render.com, Free Tier)
- **Frontend:** abatn.github.io/HEIMAT (GitHub Pages)
- **Datenbank:** Supabase (PostgreSQL, 16 Tabellen)
- **CI/CD:** 10/10 GitHub Actions grün

### Finanzplan (investor-report.md)
- **Jahreskosten:** ~€70 (Hosting + Domain)
- **Fördermittel-Bedarf:** €50.000 (Prototype Fund, BMBF)
- **Use of Funds:** 60% Community, 20% Features, 10% Marketing, 10% Infra

---

## Nächste Schritte (priorisiert)

| # | Aktion | Aufwand | Impact |
|---|--------|---------|--------|
| 1 | db-rest Port + URL fixen | 30min | KRITISCH |
| 2 | Route-Reihenfolge fixen | 5min | KRITISCH |
| 3 | Journey-Parameter fixen | 15min | KRITISCH |
| 4 | GTFS-Feed lokal importieren | 1h | HOCH |
| 5 | CHECK-Constraints hinzufügen | 1h | HOCH |
| 6 | ISO-Datum Parsing fixen | 15min | HOCH |

---

## Datenquellen

Alle Analysen basieren auf:
- `heimat-plan.md` — Vollständiger Umsetzungsplan
- `src/backend/src/database/schema.sql` — Datenbankstruktur (16 Tabellen)
- `src/backend/src/routes/mobility.ts` — Backend-Routen-Definitionen
- `src/backend/src/index.ts` — Server-Konfiguration
- `.loop.md` — Aktueller Projekt-Status

---

*Erstellt: Juli 2026 · Alle Angaben ohne Gewähr.*
