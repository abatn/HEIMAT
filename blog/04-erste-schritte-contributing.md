---
title: "Erste Schritte zum Contributieren"
date: 2024-02-05
author: HEIMAT Team
tags: [contributing, open-source, anleitung]
---

# Erste Schritte zum Contributieren

## So kannst du bei HEIMAT 2.0 mithelfen

HEIMAT 2.0 lebt von seiner Community. Egal ob du Entwickler, Designer, Tester oder einfach nur begeisterter Nutzer bist – es gibt viele Möglichkeiten, mitzumachen.

## Für Entwickler

### 1. Repository forken
```bash
# GitHub öffnen: https://github.com/abatn/HEIMAT
# Auf "Fork" klicken
# Repository klonen
git clone https://github.com/<dein-username>/HEIMAT.git
cd HEIMAT
```

### 2. Good-First-Issues finden
Schau dir unsere [Good-First-Issues](https://github.com/abatn/HEIMAT/labels/good-first-issue) an:
- #6: Flutter-Projektstruktur einrichten
- #7: Node.js Backend-Grundstruktur
- #8: Docker-Grundkonfiguration
- #9: OpenStreetMap-Komponente
- #10: Dokumentation: Architektur

### 3. Branch erstellen
```bash
git checkout -b feature/dein-feature-name
```

### 4. Code schreiben
- Folge dem Code-Style
- Schreibe Tests
- Aktualisiere die Dokumentation

### 5. Pull Request erstellen
- PR-Template ausfüllen
- Issue verlinken (#123)
- Auf Review warten

## Für Nicht-Entwickler

### Tester
- Installiere die App (sobald verfügbar)
- Teste alle Funktionen
- Melde Bugs über GitHub Issues

### Dokumentation
- Hilf bei der Übersetzung
- Erstelle Tutorials
- Verbessere die Dokumentation

### Community
- Tritt unserem Matrix-Room bei
- Helfe bei Fragen
- Teile HEIMAT mit anderen

### Design
- Erstelle Mockups
- Verbessere die UI/UX
- teste Barrierefreiheit

## Der Entwicklungsprozess

### Schritt 1: Issue finden
```bash
# GitHub Issues durchsuchen
# Good-First-Issues filtern
```

### Schritt 2: Fork & Clone
```bash
git clone https://github.com/<dein-username>/HEIMAT.git
```

### Schritt 3: Branch erstellen
```bash
git checkout -b fix/bug-behebung
```

### Schritt 4: Änderungen vornehmen
```bash
# Code ändern
# Tests schreiben
# Linting ausführen
```

### Schritt 5: Commit erstellen
```bash
git add .
git commit -m "fix: Bug in der Kartenanzeige behoben"
```

### Schritt 6: Push & PR
```bash
git push origin fix/bug-behebung
# Auf GitHub Pull Request erstellen
```

## Code-Style

### Flutter (Dart)
- `dart format` vor dem Commit
- Keine Analyzer-Warnings
- Named Parameters für lesbareren Code

### Node.js (TypeScript)
- ESLint + Prettier
- Keine `any`-Typen
- JSDoc für öffentliche Funktionen

### Git
- Conventional Commits: `feat:`, `fix:`, `docs:`
- Kurze, beschreibende Nachrichten
- Ein Commit pro logische Änderung

## Kommunikation

### Matrix-Room
- **#heimat:matrix.org** – Allgemeine Fragen
- **#heimat-entwicklung:matrix.org** – Technische Diskussionen

### GitHub
- **Issues** – Bug-Reports, Feature-Requests
- **Discussions** – Allgemeine Fragen, Ideen
- **PRs** – Code-Reviews

### Mastodon
- **@heimat@social.heimat-app.de** – Updates, Ankündigungen

## Häufige Fragen

### "Ich bin Anfänger – kann ich trotzdem mithelfen?"
Ja! Schau dir die Good-First-Issues an. Dort stehen Aufgaben, die speziell für Einsteiger geeignet sind.

### "Was ist, wenn ich einen Bug finde?"
Erstelle ein GitHub Issue mit:
- Beschreibung des Fehlers
- Schritte zum Nachstellen
- Screenshots (falls möglich)

### "Wie bekomme ich Feedback?"
Erstelle einen Pull Request. Die Community wird dein Reviewen und Feedback geben.

### "Gibt es ein Slack/Discord?"
Wir nutzen Matrix – ein Open-Source-Messenger. Tritt unserem [Room](https://matrix.to/#/heimat:matrix.org) bei.

## Nächste Schritte

1. **Repository forken** und klonen
2. **Good-First-Issue** auswählen
3. **Ersten Commit** machen
4. **Pull Request** erstellen

**Willkommen in der Community!**

---

*Fragen? Tretet unserem [Matrix-Room](https://matrix.to/#/heimat:matrix.org) bei oder schreibt ein [GitHub Issue](https://github.com/abatn/HEIMAT/issues).*
