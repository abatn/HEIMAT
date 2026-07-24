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
  <a href="https://opencollective.com/heimat">
    <img src="https://img.shields.io/badge/Open%20Collective-Spenden-orange" alt="Open Collective">
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
- Arzt-Suche nach Fachrichtung und Ort
- Terminbuchung mit verfügbarer Zeitplanung
- Keine TI-Anbindung, keine Patientendaten

---

## Projektstruktur

```
HEIMAT/
├── src/
│   ├── mobile/          # Flutter App
│   │   ├── lib/
│   │   │   ├── features/
│   │   │   │   ├── mobility/    # ÖPNV, Karten, Routing
│   │   │   │   ├── finance/     # Taler P2P-Zahlungen
│   │   │   │   └── health/      # Arzt-Termine
│   │   │   └── core/            # Config, Theme, Navigation
│   │   └── pubspec.yaml
│   └── backend/         # Node.js Backend
│       ├── src/
│       │   ├── routes/          # API-Endpunkte
│       │   ├── services/        # Business-Logik
│       │   └── middleware/       # Error-Handler, etc.
│       └── package.json
├── AI-*.md              # AI-Strategie Dokumentation
├── blog/                # Blog-Beiträge
├── funding/             # Förderanträge
├── marketing/           # Marketing-Materialien
└── docs/                # Zusätzliche Dokumentation
```

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

## Mitwirken

Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

### Tests (via CI)

Tests laufen automatisch in GitHub Actions bei jedem Push/PR. Manuelle Ausführung:

```bash
# Backend Tests
cd src/backend
npm test

# Flutter Tests
cd src/mobile
src/mobile/flutter/bin/flutter test
```

---

## Contributing

Wir freuen uns über jeden Beitrag! Bitte lies zuerst die [CONTRIBUTING.md](CONTRIBUTING.md).

### Good First Issues

Schau dir unsere [Good First Issues](https://github.com/abatn/HEIMAT/labels/good-first-issue) an, wenn du einsteigen möchtest.

---

## Community

- **Matrix:** [HEIMAT Room](https://matrix.to/#/heimat:matrix.org)
- **Mastodon:** [@heimat@mastodon.social](https://mastodon.social/@heimat)
- **GitHub Discussions:** [Discussions](https://github.com/abatn/HEIMAT/discussions)

---

## Unterstützen

HEIMAT 2.0 ist ein gemeinnütziges Open-Source-Projekt. Wir sind auf Spenden angewiesen:

- **Open Collective:** [opencollective.com/heimat](https://opencollective.com/heimat)
- **GitHub Sponsors:** [github.com/sponsors/abatn](https://github.com/sponsors/abatn)

---

## Roadmap

| Phase | Status | Details |
|-------|--------|---------|
| Mobilität (OSM/Overpass/OSRM) | ✅ Abgeschlossen | Echte Haltestellen, Nominatim-Geocoding, Routing |
| Gesundheit (OSM + Registrierung) | ✅ Abgeschlossen | Echte Ärzte aus Overpass, Arzt-Registrierung |
| Finanzen (GNU Taler Testnet) | ⏳ Offen | Nächster Schritt |
| UX-Modernisierung | ✅ Abgeschlossen | Gradient-Karten, Pill-Nav, Bottom Sheets |

---

## Lizenz

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](LICENSE).

---

## Danksagung

- [OpenStreetMap](https://www.openstreetmap.org/) – Karten
- [GNU Taler](https://taler.net/) – Zahlungen
- [Cal.com](https://cal.com/) – Terminbuchung
- [Matrix](https://matrix.org/) – Kommunikation
- [OpenRouteService](https://openrouteservice.org/) – Routing

---

*Gemeinsam gestalten wir die digitale Zukunft Deutschlands.*
