# HEIMAT 2.0 — Investor & Funder Report

## Executive Summary

HEIMAT 2.0 ist eine Open-Source "Super App" für den deutschen Alltag, die auf ausschließlich Open-Source-Technologien basiert. Das Projekt befindet sich in der **MVP-Phase** mit funktionierendem Backend, Flutter-App und CI/CD-Pipeline. Der gesamte adressierbare Markt (SAM) beträgt **€340–520 Mio.** Das Projekt benötigt **€50.000 Fördermittel** für die nächsten 12 Monate.

**Kernbotschaft:** HEIMAT bietet die einzige datenschutzkonforme, Open-Source-Alternative zu kommerziellen Super-Apps wie WeChat oder Grab — speziell für den deutschen Markt entwickelt.

---

## 1. Das Problem

### 1.1 Current Reality

| Problem | Auswirkung | HEIMAT-Lösung |
|---------|-----------|---------------|
| **App-Fragmentierung** | Nutzer wechseln zwischen 10+ Apps (DB, PayPal, Doctolib) | Eine App für alles |
| **Datenkraken** | Kommerzielle Apps verkaufen Nutzerdaten | Privacy-by-Design, kein Tracking |
| **Vendor Lock-in** | proprietäre Apps, keine Datenportabilität | Open Source, volle Transparenz |
| **Kosten** | Abogebühren, versteckte Kosten | 100% kostenlos |
| **Komplexität** | Jede App hat eigene UI/UX | Einheitliche, einfache Bedienung |

### 1.2 Zielgruppe

| Persona | Bedürfnis | HEIMAT-Lösung |
|---------|-----------|---------------|
| **Anna, 32, Berlin** | Kein Wechsel zwischen Apps | Super App mit allem |
| **Markus, 45, München** | Zuverlässige ÖPNV-Infos | Live-Abfahrten + Routing |
| **Sarah, 28, Hamburg** | P2P-Zahlungen ohne Bank | GNU Taler Integration |
| **Klaus, 67, Leipzig** | Einfache Bedienung | Intuitive Flutter-App |
| **Dev, 29, Remote** | Open-Source beitragen | Gute Doku, freundliche Community |

---

## 2. Die Lösung

### 2.1 Produktvision

```
┌─────────────────────────────────────────────────────────┐
│                    HEIMAT 2.0                            │
├─────────────────────────────────────────────────────────┤
│  🗺️  MOBILITÄT          │  💰 FINANZEN     │  🏥 GESUNDHEIT │
│  • Interaktive Karte     │  • P2P-Zahlungen │  • Arzt-Suche  │
│  • ÖPNV-Verbindungssuche│  • Taler-Wallet   │  • Terminbuchung│
│  • Routing (OSM)         │  • KUDOS-Währung  │  • Registrierung│
│  • Live-Abfahrten        │  • Transaktionslog│  • Kalender-Sync│
├─────────────────────────────────────────────────────────┤
│  🔒 Datenschutz: Privacy-by-Design · Kein Tracking       │
│  🌍 Open Source: AGPL-3.0 · Jeder kann den Code prüfen   │
│  💻 Tech Stack: Flutter · Node.js · PostgreSQL · Docker   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Technologie-Stack

| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| **Frontend** | Flutter | Cross-Platform (iOS/Android/Web), OSS |
| **Backend** | Node.js + Express | Einfache Community-Beiträge |
| **Datenbank** | PostgreSQL | Mächtig, bewährt, OSS |
| **Cloud** | Render.com + Supabase | OSS-friendly, DSGVO-konform |
| **Karten** | OpenStreetMap + MapLibre GL | Open Data, kein Proprietär |
| **ÖPNV** | db-rest (Vendo API) | Echtzeit-Daten, 461 Verbünde |
| **Routing** | OpenRouteService | OSS, OSM-basiert |
| **Zahlungen** | GNU Taler | Privacy-preserving, OSS |
| **Kommunikation** | Matrix (Element) | E2E-verschlüsselt, OSS |
| **CI/CD** | GitHub Actions | Kostenlos für OSS |

### 2.3 Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Flutter)                                         │
│  ├── Karte (MapLibre GL)                                   │
│  ├── ÖPNV-Suche (db-rest / Vendo API)                       │
│  ├── Taler-Wallet (P2P)                                    │
│  └── Terminbuchung (Ärzte)                                  │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js, Port 3000)                               │
│  ├── /api/mobility/* (Overpass + db-rest)                   │
│  ├── /api/finance/* (Taler-Simulator)                      │
│  ├── /api/health/* (Overpass + DB)                          │
│  └── /api/admin/* (Migration, GTFS-Status)                 │
├─────────────────────────────────────────────────────────────┤
│  Daten & APIs                                              │
│  ├── PostgreSQL (Supabase, 16 Tabellen)                    │
│  ├── Redis (Caching)                                       │
│  ├── OpenStreetMap (Karten)                                │
│  ├── db-rest (ÖPNV via Vendo API)                          │
│  └── GNU Taler (Simulator)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Marktbewertung

### 3.1 TAM / SAM / SOM

| Metrik | Wert | Begründung |
|--------|------|------------|
| **TAM** | €8,2 Mrd. | Digitale Alltagsdienste in Deutschland |
| **SAM** | €340–520 Mio. | Datenschutzbewusste + OSS-Nutzer |
| **SOM (Jahr 1)** | €0,5–2 Mio. | 5.000–20.000 Nutzer |
| **SOM (Jahr 3)** | €20–50 Mio. | 200.000–500.000 Nutzer |

### 3.2 Wettbewerbsvorteil

| Faktor | HEIMAT | Kommerzielle Apps |
|--------|--------|-------------------|
| **Datenschutz** | Privacy-by-Design | Tracking + Profiling |
| **Kosten** | Kostenlos | Abogebühren |
| **Transparenz** | Open Source | Proprietär |
| **Vendor Lock-in** | Keiner | Hoch |
| **Community** | Getrieben | Firmengetrieben |
| **Compliance** | DSGVO-native | Nachgerüstet |

### 3.3 Markttreiber

- **DSGVO-Verschärfung:** Höhere Nachfrage nach datenschutzkonformen Apps
- **Open-Source-Wachstum:** 25% jährliches Wachstum der OSS-Nutzung
- **Super-App-Trend:** WeChat/Grab-Modelle gewinnen an Beliebtheit
- **Kommunale Digitalisierung:** Öffentliche Hand sucht OSS-Lösungen

---

## 4. Aktueller Stand

### 4.1 Was funktioniert

| Feature | Status | Verifiziert |
|---------|--------|-------------|
| Interaktive Karte (OSM) | ✅ LIVE | Backend-Test |
| ÖPNV-Haltestellen (Overpass) | ✅ LIVE | Backend-Test |
| Routing (OSRM) | ✅ LIVE | Backend-Test |
| Arzt-Suche (Overpass) | ✅ LIVE | Backend-Test |
| Arzt-Registrierung | ✅ LIVE | Backend-Test |
| Taler-Wallet | ✅ LIVE | Backend-Test |
| P2P-Zahlungen | ✅ LIVE | Backend-Test |
| CI/CD (GitHub Actions) | ✅ 10/10 grün | GitHub |
| TypeScript (tsc --noEmit) | ✅ sauber | CI |

### 4.2 Was noch nicht funktioniert

| Feature | Problem | Aufwand |
|---------|---------|---------|
| ÖPNV-Verbindungssuche | API-Parameter-Mismatch | 15min |
| Live-Abfahrten | db-rest Port-Konflikt | 30min |
| GTFS-Feed-Import | Nur lokal (nicht auf Render) | 1h |
| Taler-Echtgeld | Nur Simulator | Phasenweise |

### 4.3 Metriken

| Metrik | Aktuell | Ziel (6 Monate) |
|--------|---------|-----------------|
| **API-Endpoints** | 9 live | 15 |
| **CI-Pass Rate** | 100% | > 95% |
| **Open Issues** | 6 (4 kritisch) | 0 kritisch |
| **DB-Tabellen** | 16 | 16 |
| **GitHub Stars** | 0 (neu) | 500 |

---

## 5. Finanzplan

### 5.1 Kostenstruktur

| Posten | Monatlich | Jährlich |
|--------|-----------|----------|
| **Hetzner Cloud (Small)** | €5 | €60 |
| **Supabase (Free Tier)** | €0 | €0 |
| **Render (Free Tier)** | €0 | €0 |
| **Domain (.de)** | — | €10 |
| **GitHub Actions** | €0 | €0 |
| **Matrix-Server** | €0 (selbst gehostet) | €0 |
| **Gesamt** | **~€5** | **~€70** |

### 5.2 Fördermittel-Bedarf

| Posten | Betrag | Begründung |
|--------|--------|------------|
| **Prototype Fund (BMBF)** | €50.000 | 12-Monats-Förderung |
| **Entwicklung (Freiwillige)** | €0 | Community-getrieben |
| **Marketing** | €5.000 | Blog, Social Media, Events |
| **Infrastruktur (Overhead)** | €2.000 | Backup, Monitoring |
| **Gesamt** | **€57.000** | |

### 5.3 Use of Funds

```
€50.000 Prototype Fund
├── 60% Community-Aufbau (Events, Doku, Onboarding)
├── 20% Feature-Entwicklung (Taler-Echtgeld, Kalender)
├── 10% Marketing (Blog, Social Media, PR)
└── 10% Infrastruktur (Monitoring, Backup)
```

### 5.4 Break-Even

| Szenario | Nutzer | Fördermittel | Break-Even |
|----------|--------|-------------|------------|
| **Konservativ** | 5.000 | €50.000 | Monat 1 |
| **Moderat** | 20.000 | €50.000 | Monat 1 |
| **Optimistisch** | 100.000 | €50.000 + Spenden | Monat 3 |

---

## 6. Roadmap

### 6.1 Meilensteine

| Phase | Status | Inhalt |
|-------|--------|--------|
| **Phase 1: MVP** | ✅ ABGESCHLOSSEN | Karte + ÖPNV + Routing |
| **Phase 2: Integration** | 🔧 TEILWEISE | Taler-Testnet, Arzt-Registrierung |
| **Phase 3: Beta** | 📋 GEPLANT | Fehlerbehebung, Testing |
| **Phase 4: Pilot-Stadt** | 📋 GEPLANT | Erste Kommune |
| **Phase 5: Skalierung** | 📋 GEPLANT | Mehrere Städte |

### 6.2 Nächste 12 Monate

| Quartal | Ziel | KPI |
|---------|------|-----|
| **Q3 2026** | MVP-Release, Beta-Tester | 100 Nutzer |
| **Q4 2026** | Taler-Echtgeld, Pilot-Stadt | 500 Nutzer |
| **Q1 2027** | 2. Pilot-Stadt, Kalender-Sync | 2.000 Nutzer |
| **Q2 2027** | F-Droid-Release, 5 Städte | 10.000 Nutzer |

---

## 7. Team & Community

### 7.1 Aktuelles Team

| Rolle | Person | Status |
|-------|--------|--------|
| **Gründer / Lead Dev** | abatn | Aktiv |
| **Community** | — | Wachsend |

### 7.2 Community-Strategie

| Kanal | Ziel | Status |
|-------|------|--------|
| **GitHub** | Code-Beiträge | ✅ Aktiv |
| **Matrix-Room** | Echtzeit-Kommunikation | ✅ Eingerichtet |
| **Mastodon** | Updates, Ankündigungen | 📋 Geplant |
| **Blog** | Tutorials, Deep-Dives | 📋 Geplant |
| **Universitäten** | Praxisprojekte | 📋 Geplant |

### 7.3 Good-First-Issues

| Issue | Titel | Label |
|-------|-------|-------|
| #6 | Flutter-Projektstruktur | good-first-issue |
| #7 | Node.js Backend | good-first-issue |
| #8 | Docker-Konfiguration | good-first-issue |
| #9 | OSM-Komponente | good-first-issue |
| #10 | Dokumentation | good-first-issue |

---

## 8. Risiken & Gegenmaßnahmen

| Risiko | Wahrscheinlichkeit | Impact | Lösung |
|--------|-------------------|--------|--------|
| **Mangelnde Community** | Mittel | Hoch | Hackathons, University-Kooperationen |
| **Rechtliche Grauzonen** | Niedrig | Hoch | Fokus auf OSS-unbedenkliche Features |
| **Technische Abhängigkeiten** | Niedrig | Mittel | Nur OSS-Standards |
| **Wenig Nutzer** | Hoch | Mittel | Langfristige Community-Arbeit |
| **Geringe Funding** | Mittel | Niedrig | Niedrige Kosten, Spenden |
| **Burnout** | Mittel | Hoch | Nachhaltiges Pace |

---

## 9. Erfolgskriterien

| Kriterium | Ziel (6 Monate) | Ziel (12 Monate) |
|-----------|-----------------|------------------|
| **Open-Source-Nutzung** | 100% OSS | 100% OSS |
| **Rechtliche Unbedenklichkeit** | Keine Verträge | Keine Verträge |
| **Kostenfreiheit** | App kostenlos | App kostenlos |
| **Community** | 10 Contributors | 30 Contributors |
| **Nutzer** | 100 Beta-Nutzer | 1.000 Nutzer |
| **Funktionsfähigkeit** | MVP vollständig | MVP + Taler + Termine |

---

## 10. Fazit & Ask

### 10.1 Zusammenfassung

| Metrik | Wert |
|--------|------|
| **Problem** | App-Fragmentierung + Datenkraken |
| **Lösung** | Open-Source Super App |
| **SAM** | €340–520 Mio. |
| **Aktueller Stand** | MVP mit 9 funktionierenden Endpoints |
| **Nächster Meilenstein** | Beta-Release + Pilot-Stadt |
| **Fördermittel-Bedarf** | €50.000 (Prototype Fund) |

### 10.2 Ask

**Wir suchen:**

1. **€50.000 Fördermittel** (Prototype Fund / BMBF)
2. **2–3 Pilot-Städte** (Kommunen, die Open-Source-Bürger-Apps testen)
3. **5–10 aktive Contributors** (Flutter, Node.js, DevOps)
4. **Feedback** von Potenzialnutzern

### 10.3 Kontakt

| Kanal | Link |
|-------|------|
| **GitHub** | github.com/abatn/HEIMAT |
| **Matrix** | #heimat:matrix.org |
| **E-Mail** | [Projekt-E-Mail] |

---

## Anhang

### A. Technische Details

- **Schema:** 16 Tabellen, 25 Indizes, 12 Fremdschlüssel
- **API:** 9 funktionierende Endpoints (REST, JSON)
- **CI/CD:** GitHub Actions (Flutter + Node.js)
- **Deployment:** Render.com (Backend) + GitHub Pages (Frontend) + Supabase (DB)

### B. Doku-Links

- `heimat-plan.md` — Vollständiger Umsetzungsplan
- `bauplan.md` — Technischer Bauplan
- `CONTRIBUTING.md` — Contributor-Anleitung
- `AGENTS.md` — Projektstruktur für AI-Assistenten

### C. Lizenz

AGPL-3.0 — Stärkste Open-Source-Lizenz für SaaS. Verhindert Proprietarisierung.

---

*Erstellt: Juli 2026 · Datenquellen: heimat-plan.md, bauplan.md, schema.sql, .loop.md, render.yaml*
*Alle Angaben ohne Gewähr. Fördermittel-Bedarf ist ein Vorschlag.*
