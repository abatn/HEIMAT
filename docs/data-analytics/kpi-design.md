# HEIMAT 2.0 — KPI-Design für das MVP

## Executive Summary

Für das HEIMAT MVP (Release 0.1: Mobilität, Release 0.2: Taler, Release 0.3: Gesundheit) werden **3 primäre KPIs**, **6 Treiber-KPIs** und **4 Guardrail-KPIs** definiert. Die KPIs messen Produktnutzung, Funktionsqualität und Community-Wachstum.

---

## 1. Entscheidungsrahmen

### 1.1 Was soll gemessen werden?

| Frage | KPI-Typ |
|-------|---------|
| Wird HEIMAT von Menschen genutzt? | Outcome: Aktive Nutzer |
| Funktionieren die Kernfeatures? | Treiber: Feature-Status |
| Ist die Datenqualität gut? | Guardrail: API-Fehlerquote |
| Wächst die Community? | Treiber: GitHub-Engagement |

### 1.2 Zielgruppe der KPIs

- **Entwicklerteam:** Tägliche Entscheidungen über Feature-Priorisierung
- **Fördergeber:** Monatliche Fortschrittsberichte
- **Community:** Wöchentliche Transparenz (Roadmap, Status)

---

## 2. Primäre KPIs (Outcome)

### 2.1 Aktive Nutzer (Wöchentlich / Monatlich)

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Weekly Active Users (WAU) / Monthly Active Users (MAU) |
| **Formel** | Eindeutige Nutzer, die mindestens 1 Feature pro Woche/Monat nutzen |
| **Einheit** | Nutzer (absolute Zahl) |
| **Granularität** | Täglich aggregiert, wöchentlich berichtet |
| **Quelle** | Backend-Logs (optional: Nutzer-Tracking nach Opt-in) |
| **Ziel (Jahr 1)** | 5.000 WAU / 15.000 MAU |
| **Warum wichtig** | Grundlegende Produktnutzung; Hauptindikator für Product-Market-Fit |

**Berechnung:**
```sql
SELECT COUNT(DISTINCT user_id) AS wau
FROM (
  SELECT user_id, DATE_TRUNC('week', created_at) AS week
  FROM mobility_usage  -- oder alternative Tracking-Tabelle
  WHERE created_at >= NOW() - INTERVAL '7 days'
) sub
GROUP BY week;
```

### 2.2 Feature-Nutzungsrate

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Feature Adoption Rate |
| **Formel** | (Nutzer die Feature X nutzen / Gesamtnutzer) × 100 |
| **Einheit** | Prozent |
| **Granularität** | Täglich |
| **Quelle** | API-Endpoint-Aufrufe |
| **Ziel (Jahr 1)** | Mobilität: 60%, Finanzen: 30%, Gesundheit: 20% |
| **Warum wichtig** | Welche Features werden tatsächlich genutzt? |

**Berechnung:**
```sql
-- Mobilität: Nutzer die /api/mobility/* aufrufen
SELECT
  COUNT(DISTINCT CASE WHEN endpoint LIKE '/api/mobility%' THEN user_id END) * 100.0 /
  NULLIF(COUNT(DISTINCT user_id), 0) AS mobility_adoption
FROM api_logs
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### 2.3 Nutzerzufriedenheit (NPS)

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Net Promoter Score |
| **Formel** | % Promotoren (9-10) - % Kritiker (0-6) |
| **Einheit** | Score (-100 bis +100) |
| **Quelle** | In-App-Umfrage (quartalsweise) |
| **Ziel (Jahr 1)** | > 30 (gut für OSS-Projekt) |
| **Warum wichtig** | Mundpropaganda ist der wichtigste Kanal für OSS |

---

## 3. Treiber-KPIs

### 3.1 Mobilität: ÖPNV-Verbindungssuche

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Journey Success Rate |
| **Formel** | (Erfolgreiche Verbindungssuchen / Gesamtsuchen) × 100 |
| **Einheit** | Prozent |
| **Quelle** | `/api/mobility/journey` Response-Status |
| **Ziel** | > 80% (nach GTFS-Import) |
| **Warum wichtig** | Kernfeature muss funktionieren |

**Berechnung:**
```sql
SELECT
  COUNT(CASE WHEN response_status = 200 AND journey_count > 0 THEN 1 END) * 100.0 /
  NULLIF(COUNT(*), 0) AS journey_success_rate
FROM api_logs
WHERE endpoint LIKE '/api/mobility/journey%'
  AND created_at >= NOW() - INTERVAL '7 days';
```

### 3.2 Mobilität: Routing-Qualität

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Route Response Time |
| **Formel** | P95 der Antwortzeit für /api/mobility/route |
| **Einheit** | Millisekunden |
| **Quelle** | API-Logs / Monitoring |
| **Ziel** | < 2.000ms (P95) |
| **Warum wichtig** | Langsame Routen vergraulen Nutzer |

### 3.3 Finanzen: Taler-Transaktionsrate

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Taler Transaction Volume |
| **Formel** | Anzahl P2P-Transaktionen pro Tag |
| **Einheit** | Transaktionen/Tag |
| **Quelle** | `taler_transactions` Tabelle |
| **Ziel** | > 50/Tag (nach Beta-Release) |
| **Warum wichtig** | Kernfeature der Finanz-Integration |

### 3.4 Gesundheit: Terminbuchungsrate

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Appointment Booking Rate |
| **Formel** | (Erfolgreiche Buchungen / Gesuche nach Ärzten) × 100 |
| **Einheit** | Prozent |
| **Quelle** | `appointments` Tabelle vs. `/api/health/doctors` Aufrufe |
| **Ziel** | > 5% (niedrig, da manuelle Bestätigung durch Praxis) |
| **Warum wichtig** | Misst ob Nutzer das Feature tatsächlich nutzen |

### 3.5 CI/CD: Build-Gesundheit

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | CI Pass Rate |
| **Formel** | (Erfolgreiche CI-Runs / Gesamt-Runs) × 100 |
| **Einheit** | Prozent |
| **Quelle** | GitHub Actions |
| **Ziel** | > 95% |
| **Warum wichtig** | Verlässliche Deployments |

### 3.6 Community: GitHub-Engagement

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Community Growth Rate |
| **Formel** | Monatliche Änderung bei Stars, Contributors, Issues |
| **Einheit** | Prozent (Monat über Monat) |
| **Quelle** | GitHub API |
| **Ziel** | > 10% MoM-Wachstum |
| **Warum wichtig** | Community ist das Lebenselixier von OSS |

---

## 4. Guardrail-KPIs

### 4.1 API-Fehlerquote

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | API Error Rate |
| **Formel** | (5xx-Responses / Gesamt-Responses) × 100 |
| **Einheit** | Prozent |
| **Ziel** | < 1% |
| **Schwellenwert** | > 5% → Alert |
| **Warum wichtig** | Zu viele Fehler zerstören Nutzervertrauen |

### 4.2 Datenqualität: DB-Konsistenz

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Data Integrity Score |
| **Formel** | (Erfolgreiche DB-Operationen / Gesamt-Operationen) × 100 |
| **Einheit** | Prozent |
| **Ziel** | > 99,5% |
| **Warum wichtig** | Datenfehler sind schwer zu beheben |

### 4.3 Performance: Antwortzeit

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | API Latency P95 |
| **Formel** | 95. Perzentil der Antwortzeit |
| **Einheit** | Millisekunden |
| **Ziel** | < 1.000ms (P95) |
| **Warum wichtig** | Langsame Apps werden nicht genutzt |

### 4.4 Verfügbarkeit: Uptime

| Eigenschaft | Definition |
|-------------|------------|
| **Name** | Service Uptime |
| **Formel** | (Verfügbare Minuten / Gesamt-Minuten) × 100 |
| **Einheit** | Prozent |
| **Ziel** | > 99% (Free-Tier-bedingt begrenzt) |
| **Warum wichtig** | Nicht-verfügbare Apps verlieren Nutzer |

---

## 5. Messplan

### 5.1 Datenerfassung

| Methode | Implementierung | Priorität |
|---------|----------------|-----------|
| **API-Logs** | Morgan/Custom Middleware in Express | Hoch |
| **DB-Tracking** | Trigger auf `taler_transactions`, `appointments` | Mittel |
| **GitHub API** | Wöchentlicher Cron-Job | Niedrig |
| **In-App-Umfrage** | Quartalsweise via Matrix-Room | Niedrig |

### 5.2 Reporting-Kadenz

| KPI | Frequenz | Format |
|-----|----------|--------|
| WAU/MAU | Wöchentlich | Dashboard (HTML) |
| Feature-Adoption | Monatlich | Report (Markdown) |
| API-Fehler | Täglich | Alert (nur bei Schwellenwert) |
| CI-Pass Rate | Nach jedem Commit | GitHub Badge |
| Community Growth | Monatlich | Report (Markdown) |

### 5.3 Dashboard-Spezifikation

```
┌─────────────────────────────────────────────────┐
│ HEIMAT MVP Dashboard                            │
├─────────────────────────────────────────────────┤
│ [WAU: 1,234] [MAU: 4,567] [NPS: +42]          │
├─────────────────────────────────────────────────┤
│ Feature-Adoption          │ API Health          │
│ ████████████░░░ 60% Mob   │ ████████████ 99.2%  │
│ █████░░░░░░░░░░ 30% Fin   │ P95: 340ms          │
│ ███░░░░░░░░░░░░ 20% Health│ Errors: 0.8%        │
├─────────────────────────────────────────────────┤
│ CI/CD Status               │ Community           │
│ ██████████████ ✅ 98%      │ ⭐ 523 Stars        │
│ Last deploy: 2h ago        │ 👥 12 Contributors  │
│                            │ 📋 8 Open Issues    │
└─────────────────────────────────────────────────┘
```

---

## 6. KPI-Mapping zu Geschäftszielen

| Geschäftsziel | KPI | Zielwert | Messmethode |
|--------------|-----|----------|-------------|
| **Product-Market-Fit** | WAU/MAU | 5.000/15.000 | API-Logs |
| **Feature-Qualität** | Journey Success Rate | > 80% | API-Response-Tracking |
| **Community-Aufbau** | GitHub Stars | > 1.000 | GitHub API |
| **Finanzielle Nachhaltigkeit** | Fördermittel-Summe | > €50.000 | Manuell |
| **Nutzerzufriedenheit** | NPS | > 30 | Umfrage |

---

## 7. Risiken und Einschränkungen

| Risiko | Auswirkung | Mildierung |
|--------|-----------|------------|
| **Kein Nutzer-Tracking** | KPIs schwer messbar | Opt-in Tracking, API-Logs als Proxy |
| **Free-Tier-Limits** | Uptime < 99% | Monitoring, Alerting |
| **Geringe Nutzerbasis** | Statistische Signifikanz niedrig | Qualitative Feedback via Matrix |
| **Kein A/B-Testing** | Feature-Wirkung schwer messbar | Vorher/Nachher-Vergleiche |

---

## 8. Nächste Schritte

1. **Sofort:** API-Logging-Middleware implementieren
2. **Woche 1-2:** GitHub-API-Integration für Community-Metriken
3. **Monat 1:** Erstes Dashboard (HTML) veröffentlichen
4. **Monat 3:** Erste NPS-Umfrage durchführen
5. **Monat 6:** KPI-Review und Anpassung

---

*Definitionen basieren auf HEIMAT-Spezifikation (heimat-plan.md, bauplan.md). Alle Zielwerte sind Richtwerte und werden nach Beta-Feedback angepasst.*
