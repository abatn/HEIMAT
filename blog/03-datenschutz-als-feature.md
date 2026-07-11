---
title: "Datenschutz als Feature"
date: 2024-01-29
author: HEIMAT Team
tags: [datenschutz, dsgvo, privacy]
---

# Datenschutz als Feature

## Warum Datenschutz bei HEIMAT 2.0 kein Hindernis ist

In Deutschland ist Datenschutz besonders wichtig. Bei vielen Apps ist Datenschutz ein lästiges Muss – ein Hindernis, das man umgehen muss. Bei HEIMAT 2.0 ist Datenschutz das Produkt selbst.

## Die DSGVO als Vorteil

### Was ist die DSGVO?
Die Datenschutz-Grundverordnung (DSGVO) regelt den Umgang mit personenbezogenen Daten in der EU. Für viele Unternehmen ist sie eine Belastung. Für uns ist sie eine Chance.

### Unsere DSGVO-Strategie

| Prinzip | Umsetzung bei HEIMAT |
|---------|---------------------|
| **Privacy by Design** | Datenschutz ist im Code verankert, nicht nachgerüstet |
| **Datenminimierung** | Wir sammeln nur das, was wirklich nötig ist |
| **Transparenz** | Jeder kann prüfen, was mit den Daten passiert |
| **Opt-in** | Nur aktive Einwilligung, keine versteckten Checkboxen |
| **Löschung** | Daten werden automatisch gelöscht |

## Wie wir Datenschutz umsetzen

### 1. On-Device AI
Viele AI-Funktionen laufen direkt auf dem Gerät:
- Sprachsteuerung (Vosk)
- Textklassifikation (TensorFlow Lite)
- Keine Datenübertragung an Server

**Vorteil:** Die Daten verlassen nie euer Gerät.

### 2. Lokale Datenbank
- Nutzerdaten bleiben auf dem Gerät
- Kein Cloud-Speicher für persönliche Daten
- SQLite statt externer Datenbanken

### 3. Open-Source-Transparenz
- Jeder kann den Code prüfen
- Keine versteckten Algorithmen
- Community-Reviews

### 4. Verschlüsselung
- E2E-Verschlüsselung für Nachrichten (Matrix)
- TLS für alle Verbindungen
- Verschlüsselte lokale Speicherung

## Datenschutz in den Bereichen

### Mobilität
- **Was wir speichern:** Keine Routen, keine Standorte
- **Was wir NICHT speichern:** Verlauf, Bewegungsprofile
- **Lösung:** Anonyme Abfragen, keine Zuordnung

### Finanzen
- **Was wir speichern:** Keine Transaktionsdaten
- **Was wir NICHT speichern:** Kontostände, Zahlungsverlauf
- **Lösung:** P2P-Transaktionen ohne Zwischenspeicherung

### Gesundheit
- **Was wir speichern:** Keine Patientendaten
- **Was wir NICHT speichern:** Diagnosen, Medikamente
- **Lösung:** Reine Terminverwaltung ohne Gesundheitsdaten

## Vergleich mit kommerziellen Apps

| Aspekt | Kommerzielle Apps | HEIMAT 2.0 |
|--------|-------------------|------------|
| **Datenverarbeitung** | Oft unklar | Vollständig transparent |
| **Cloud-Speicher** | Standard | Nur wo nötig |
| **Tracking** | Häufig | Keines |
| **Verkauf von Daten** | Manchmal | Niemals |
| **Quellcode** | Geschlossen | Offen |

## Häufige Fragen

### "Brauche ich eine Datenschutzerklärung?"
Ja, auch HEIMAT 2.0 braucht eine DSGVO-konforme Datenschutzerklärung. Aber da wir offen arbeiten, ist die Erklärung kurz und verständlich.

### "Was ist mit Kindern?"
HEIMAT 2.0 ist DSGVO-konform für alle Altersgruppen. Eltern können die App für ihre Kinder nutzen.

### "Kann ich meine Daten löschen?"
Ja, jederzeit. Ein Klick genügt, und alle Daten werden gelöscht.

### "Wo werden die Daten gespeichert?"
Grundsätzlich nur auf eurem Gerät. BeiHosting auf Hetzner Cloud (deutscher Anbieter, DSGVO-konform).

## Datenschutz als Wettbewerbsvorteil

Während andere Apps mit Datenschutzproblemen kämpfen:
- **Facebook** und **Google** stehen unter DSGVO-Druck
- **WhatsApp** hat Datenschutzprobleme
- **Doctolib** speichert Gesundheitsdaten

Ist HEIMAT 2.0 die datenschutzfreundliche Alternative:
- Volle Transparenz
- Keine versteckte Datenverarbeitung
- Community-kontrolliert

## Fazit

Datenschutz ist kein Hindernis – er ist das Produkt. Bei HEIMAT 2.0 ist Datenschutz ein Feature, das ihr genießen könnt, ohne Kompromisse einzugehen.

**Eure Daten gehören euch. Das versprechen wir – und ihr könnt es überprüfen.**

---

*Mehr dazu in unserer [Datenschutzerklärung](https://github.com/abatn/HEIMAT/blob/main/DATENSCHUTZ.md) (sobald verfügbar).*
