# HEIMAT 2.0 – AI-Kosten

> **Stand:** 2026-07-29 | **Letztes Update:** Health AI Agent Kosten (Ollama VPS, TFLite on-device)

## Kostenübersicht (Jahr 1, aktuelle Architektur)

| Komponente | Kosten/Monat | Kosten/Jahr | Anbieter |
|------------|--------------|-------------|----------|
| **Ollama VPS (llama3.1:8b)** | €5-10 | €60-120 | Hetzner (bestehend) |
| **Render Backend** | €0 | €0 | Render Free Tier |
| **Supabase DB** | €0 | €0 | Supabase Free Tier |
| **Domain (.de)** | - | €10 | Namecheap |
| **GitHub Actions** | €0 | €0 | GitHub (Open Source) |
| **TFLite (On-Device)** | €0 | €0 | Open Source (kein Server) |
| **Ollama (Open Source)** | €0 | €0 | Open Source |
| **spaCy (NLP, optional)** | €0 | €0 | Open Source |
| **Qdrant/Chroma (RAG)** | €0 | €0 | Selbst gehostet auf bestehendem VPS |

**Gesamtkosten (Jahr 1, aktuell):** ~€70-130

### Health AI — Keine Zusatzkosten
| Komponente | Kosten | Begründung |
|------------|--------|------------|
| Ollama llama3.1:8b | €0 | Läuft auf bestehendem VPS (158.180.18.110:11434) |
| promptService.ts | €0 | Code-Änderung, kein neuer Server |
| ollamaService.ts | €0 | Code-Änderung, kein neuer Server |
| Overpass API (Arztsuche) | €0 | Öffentliche API (OSM, ODbL) |
| TFLite On-Device | €0 | Läuft auf User-Smartphone |
| Lebenszeichen Timer | €0 | Nur App-interner Timer (kein Server) |

---

## Kostenoptimierte Alternative

| Komponente | Kosten/Monat | Kosten/Jahr | Alternative |
|------------|--------------|-------------|-------------|
| **GPU-Server** | €0 | €0 | Google Colab (kostenlos, eingeschränkt) |
| **Hetzner Cloud** | €0 | €0 | Eigenes Hosting (Raspberry Pi) |
| **Domain** | - | €0 | .ml-Domain (kostenlos) |

**Gesamtkosten (Minimal):** €10/Jahr (nur Domain)

---

## Fördermöglichkeiten

### Prototype Fund (BMBF)

| Aspekt | Details |
|--------|---------|
| **Fördersumme** | Bis zu €50.000 |
| **Förderzeitraum** | 6 Monate |
| **Voraussetzung** | Open-Source-Projekt,社会效益 |
| **Anlaufstelle** | https://prototypefund.de |

### BMWK KI-Innovationswettbewerb

| Aspekt | Details |
|--------|---------|
| **Fördersumme** | Bis zu €100.000 |
| **Förderzeitraum** | 12 Monate |
| **Voraussetzung** | KI-Projekt mit Wirtschaftsbezug |
| **Anlaufstelle** | https://www.bmwk.de |

### Stiftungen

| Stiftung | Förderschwerpunkt |
|----------|-------------------|
| **Bosch Stiftung** | Digitale Teilhabe |
| **VW Stiftung** | Mobilität der Zukunft |
| **Telekom Stiftung** | Bildung |
| **Bertelsmann Stiftung** | Digitalisierung |

---

## Kosten-Nutzen-Analyse

| Investition | Nutzen | ROI |
|-------------|--------|-----|
| **GPU-Server (€50/Monat)** | Verspätungsvorhersage, Code-Generierung | Hoch (Differenzierung) |
| **Backend (€10/Monat)** | MLflow, FastAPI | Hoch (Skalierbarkeit) |
| **Domain (€10/Jahr)** | Professioneller Auftritt | Mittel |

---

## Spendenaufruf

Für die Community:

> "Unterstützen Sie HEIMAT 2.0 mit Ihrer Spende! Bereits €5 im Monat helfen uns, die KI-Infrastruktur aufrechtzuerhalten und die App für alle kostenlos zu halten."
>
> - Open Collective: https://opencollective.com/heimat
> - GitHub Sponsors: https://github.com/sponsors/abatn

---

## Kostenerwartung nach Jahr

| Jahr | Geschätzte Kosten | Begründung |
|------|-------------------|------------|
| **Jahr 1** | €310-730 | Setup + Basis-Infrastruktur |
| **Jahr 2** | €500-1000 | Mehr Nutzer, mehr ML-Training |
| **Jahr 3** | €1000-2000 | Skalierung, weitere Features |

**Ziel:** Kosten unter €2000/Jahr halten durch:
- Open-Source-Tools
- On-Device AI (weniger Cloud-Kosten)
- Community-Beiträge
- Fördermittel
