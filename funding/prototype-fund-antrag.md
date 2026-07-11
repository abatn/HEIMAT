# HEIMAT 2.0 – Förderantrag: Prototype Fund

## Antragstellung beim Prototype Fund (BMBF)

### Überblick
- **Förderer:** Bundesministerium für Bildung und Forschung (BMBF)
- **Programm:** Prototype Fund
- **Fördersumme:** Bis zu €50.000
- **Förderzeitraum:** 6 Monate
- **Anlaufstelle:** https://prototypefund.de
- **Deadline:** Nächste Runde prüfen (meist halbjährlich)

---

## Antragsvorlage

### 1. Projekttitel
**HEIMAT 2.0 – Die erste Open-Source Super App für Deutschland**

### 2. Kurzbeschreibung (300 Zeichen)
HEIMAT 2.0 ist eine Open-Source Plattform für den deutschen Alltag, die Mobilität, Finanzen und Gesundheit in einer datenschutzkonformen App vereint. Basierend auf Open-Source-Technologien und ohne kommerzielle Abhängigkeiten.

### 3. Problemstellung
- **Viele Apps** für verschiedene Alltagsdienste (ÖPNV, Zahlungen, Termine)
- **Datenschutzprobleme** bei kommerziellen Apps
- **Abhängigkeit** von proprietären Systemen
- **Kosten** für Nutzer (Abos, In-App-Käufe)

### 4. Lösungsansatz
- **Zentrale Plattform** für Mobilität, Finanzen, Gesundheit
- **100% Open Source** – vollständig transparent
- **DSGVO-konform** – Privacy by Design
- **On-Device AI** – lokale Verarbeitung
- **Kostenfrei** – keine versteckten Kosten

### 5. Technologie
| Komponente | Technologie |
|------------|-------------|
| Frontend | Flutter |
| Backend | Node.js + Express |
| Datenbank | PostgreSQL |
| Cloud | Hetzner Cloud |
| Karten | OpenStreetMap |
| Zahlungen | GNU Taler |
| Kommunikation | Matrix |
| AI | TensorFlow Lite, Vosk |

### 6. Zielgruppe
- **Endnutzer:** Alle Deutschen, die Wert auf Datenschutz legen
- **Entwickler:** Open-Source-Community
- **Organisationen:** Kommunen, Universitäten

### 7. Projektziele
| Ziel | Beschreibung |
|------|--------------|
| **MVP** | Funktionierende App mit Mobilität, Finanzen, Gesundheit |
| **Community** | 10 aktive Contributors nach 6 Monaten |
| **Dokumentation** | Vollständige technische und nutzerorientierte Dokumentation |
| **Pilot** | Erste Pilot-Stadt (kostenlose Bereitstellung) |

### 8. Zeitplan (6 Monate)

| Monat | Meilenstein |
|-------|-------------|
| **1** | Repository-Setup, CI/CD, erste Flutter-Komponenten |
| **2** | Backend-Grundstruktur, PostgreSQL-Schema |
| **3** | MVP Mobilität (OSM, GTFS, Routing) |
| **4** | MVP Finanzen (GNU Taler P2P) |
| **5** | MVP Gesundheit (Cal.com Termine) |
| **6** | Testing, Dokumentation, Pilot-Vorbereitung |

### 9. Budget

| Posten | Kosten |
|--------|--------|
| **Entwicklung** (0,5 FTE) | €25.000 |
| **Infrastruktur** (Hetzner) | €500 |
| **Domain** | €50 |
| **Tools** (Figma, etc.) | €500 |
| **Reisekosten** (Meetups) | €1.000 |
| **Gesamt** | **~€27.050** |

### 10. Team
- **Projektleitung:** [Name]
- **Entwicklung:** [Name], [Name]
- **Design:** [Name]
- **Dokumentation:** [Name]

### 11. Nachhaltigkeit
- **Community-getrieben** – Weiterentwicklung nach Förderung
- **Open Source** – Fork möglich
- **Niedrige Kosten** – Hosting €5-10/Monat
- **Kein Lock-in** – alle Standards

### 12. Veröffentlichung
- **Code:** GitHub (AGPL-3.0)
- **Dokumentation:** GitHub Wiki
- **Blog:** Regelmäßige Updates
- **Social Media:** Mastodon, Reddit

---

## Ausfüllhilfe

### Projektbeschreibung (max. 5.000 Zeichen)
```
HEIMAT 2.0 ist eine Open-Source Super App für den deutschen Alltag, 
die Mobilität, Finanzen und Gesundheit in einer Plattform vereint.

PROBLEM:
Deutsche nutzen durchschnittlich 10+ Apps für verschiedene 
Alltagsdienste. Dies führt zu Fragmentierung, Datenschutzproblemen 
und Abhängigkeit von proprietären Systemen.

LÖSUNG:
HEIMAT 2.0 bietet eine zentrale, datenschutzkonforme Plattform 
mit 100% Open-Source-Technologien. On-Device AI stellt sicher, 
dass personenbezogene Daten das Gerät nicht verlassen.

FEATURES:
- Mobilität: ÖPNV-Suche, Routing (OpenStreetMap, GTFS)
- Finanzen: P2P-Zahlungen (GNU Taler, keine BaFin-Lizenz)
- Gesundheit: Terminverwaltung (Cal.com, keine TI-Anbindung)
- AI: Sprachsteuerung, Verspätungsvorhersage (On-Device)

ZIELGRUPPE:
Alle Deutschen, die Wert auf Datenschutz, Transparenz und 
Kostenfreiheit legen. Zusätzlich: Open-Source-Community und 
Kommunen.

NACHHALTIGKEIT:
Community-getrieben, niedrige Kosten, kein Lock-in. 
Nach der Förderung wird das Projekt durch Spenden und 
Freiwillige weiterentwickelt.
```

---

## Nächste Schritte

1. **Antrag ausfüllen** (Vorlage nutzen)
2. **Team zusammenstellen**
3. **Budget kalkulieren**
4. **Deadline prüfen** (prototypefund.de)
5. **Absenden**
