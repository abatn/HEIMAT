# HEIMAT 2.0

<p align="center">
  <img src="foto/logo.jpg" alt="HEIMAT 2.0 Logo" width="200">
</p>

<h3 align="center">Die erste Open-Source Super App für Deutschland</h3>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0">
    <img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License: AGPL v3">
  </a>
  <a href="https://github.com/abatn/HEIMAT">
    <img src="https://img.shields.io/github/stars/abatn/HEIMAT.svg?style=social" alt="GitHub Stars">
  </a>
</p>

---

## Was ist HEIMAT 2.0?

HEIMAT 2.0 ist eine datenschutzkonforme, kostenfreie Super App für den deutschen Alltag. Die Plattform basiert ausschließlich auf Open-Source-Technologien und öffentlich zugänglichen Daten – ohne Verträge mit Banken, ohne staatliche Genehmigungen, ohne kommerzielle Partner.

### Kernprinzipien

- **100% Open Source** – Jeder Code ist öffentlich einsehbar und veränderbar
- **100% Kostenfrei** – Keine Lizenzgebühren, keine Abos, keine versteckten Kosten
- **100% Legal** – Nutzung nur von Diensten, die rechtlich unbedenklich sind
- **100% Datenschutzkonform** – DSGVO als Feature, nicht als Hindernis
- **100% Community-getrieben** – Entwicklung durch Freiwillige, nicht durch Unternehmen

---

## Features

### Mobilität
- Interaktive Karte mit OpenStreetMap
- ÖPNV-Verbindungssuche (GTFS)
- Routing für Fuß, Rad und Auto (OpenRouteService)
- Städtische Informationen (Wikipedia/Wikidata)

### Finanzen
- P2P-Zahlungen über GNU Taler
- Keine BaFin-Lizenz nötig
- Privacy-by-Design

### Gesundheit
- Arzt-Terminbuchung (Cal.com)
- Keine TI-Anbindung
- Keine Patientendaten

---

## Technologie

| Komponente | Technologie |
|------------|-------------|
| Frontend | Flutter |
| Backend | Node.js + Express |
| Datenbank | PostgreSQL |
| Cloud | Hetzner Cloud |
| Karten | OpenStreetMap + MapLibre GL |
| Routing | OpenRouteService |
| Zahlungen | GNU Taler |
| Kommunikation | Matrix |
| CI/CD | GitHub Actions |

---

## Quick Start

### Voraussetzungen

- Flutter SDK
- Node.js
- PostgreSQL
- Docker (optional)

### Entwicklung

```bash
# Repository klonen
git clone https://github.com/abatn/HEIMAT.git
cd HEIMAT

# Frontend
cd src/mobile
flutter pub get
flutter run

# Backend
cd src/backend
npm install
npm run dev
```

---

## Contributing

Wir freuen uns über jeden Beitrag! Bitte lies zuerst die [CONTRIBUTING.md](CONTRIBUTING.md).

### Good First Issues

Schau dir unsere [Good First Issues](https://github.com/abatn/HEIMAT/labels/good-first-issue) an, wenn du einsteigen möchtest.

---

## Community

- **Matrix:** [HEIMAT Room](https://matrix.to/#/heimat:matrix.org)
- **GitHub Discussions:** [Discussions](https://github.com/abatn/HEIMAT/discussions)

---

## Roadmap

| Phase | Zeitraum | Meilenstein |
|-------|----------|-------------|
| Repository + Community | Monat 1-3 | GitHub-Repo, CONTRIBUTING.md, Matrix-Room |
| MVP Demo | Monat 4-6 | Karte + ÖPNV-Suche + Routing |
| Integration | Monat 7-9 | Taler + Arzt-Termine |
| Pilot-Stadt | Monat 10-12 | Erste bereitgestellte Stadt |

der Plan: [heimat-plan.md](heimat-plan.md)

---

## Lizenz

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](LICENSE).

---

## Danksagung

- [OpenStreetMap](https://www.openstreetmap.org/) – Karten
- [GNU Taler](https://taler.net/) – Zahlungen
- [Cal.com](https://cal.com/) – Terminbuchung
- [Matrix](https://matrix.org/) – Kommunikation

---

*Gemeinsam gestalten wir die digitale Zukunft Deutschlands.*
