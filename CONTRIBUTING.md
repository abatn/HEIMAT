<p align="center">
  <img src="foto/logo.jpg" alt="HEIMAT 2.0 Logo" width="150">
</p>

<h1 align="center">Contributing to HEIMAT 2.0</h1>

<p align="center">Vielen Dank für dein Interesse an HEIMAT 2.0! Wir freuen uns über jeden Beitrag.</p>

---

## Code of Conduct

Wir folgen dem [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Sei respektvoll, konstruktiv und hilfsbereit.

---

## Erste Schritte

### 1. Repository forken

Klicke auf "Fork" oben rechts im [HEIMAT-Repository](https://github.com/abatn/HEIMAT).

### 2. Repository klonen

```bash
git clone https://github.com/<dein-username>/HEIMAT.git
cd HEIMAT
```

### 3. Remote hinzufügen

```bash
git remote add upstream https://github.com/abatn/HEIMAT.git
```

### 4. Branch erstellen

```bash
git checkout -b feature/dein-feature-name
```

**Branch-Nomenklatur:**
- `feature/` – Neue Features
- `fix/` – Bugfixes
- `docs/` – Dokumentation
- `refactor/` – Code-Verbesserungen ohne Funktionsänderung
- `test/` – Tests

---

## Entwicklungsumgebung

HEIMAT 2.0 wird production-first entwickelt: Code wird committed, CI/CD deployt auf Render + GitHub Pages.

### Voraussetzungen

- **Node.js** (18.x oder neuer)
- **Git**
- **IDE:** VS Code mit Flutter-Extensions empfohlen

### Frontend (Flutter)

```bash
cd src/mobile
src/mobile/flutter/bin/flutter pub get
```

### Backend (Node.js)

```bash
cd src/backend
npm install
```

### Tests

Tests laufen in GitHub Actions CI mit eigenem Postgres-Service-Container:

```bash
cd src/backend
npm test
```

---

## Code-Style

### Flutter (Dart)

- Folge dem [Effective Dart](https://dart.dev/guides/language/effective-dart/style) Guide
- Verwende `dart format` vor dem Commit
- Namenskonventionen:
  - `camelCase` für Variablen und Funktionen
  - `PascalCase` für Klassen
  - `snake_case` für Dateinamen

### Node.js (TypeScript)

- Folge dem [Airbnb Style Guide](https://github.com/airbnb/javascript)
- Verwende ESLint + Prettier
- Namenskonventionen:
  - `camelCase` für Variablen und Funktionen
  - `PascalCase` für Klassen
  - `UPPER_SNAKE_CASE` für Konstanten

---

## Testing

### Flutter

```bash
cd src/mobile
flutter test
```

### Node.js

```bash
cd src/backend
npm test
```

**Schreiben Sie Tests für:**
- Neue Features
- Bugfixes (Regression-Tests)
- Kritische Pfade

---

## Pull Request Prozess

### 1. Code schreiben

- Folge dem Code-Style
- Schreibe Tests
- Aktualisiere die Dokumentation (falls nötig)

### 2. Code prüfen

```bash
# Flutter
cd src/mobile
dart analyze
flutter test

# Node.js
cd src/backend
npm run lint
npm test
```

### 3. Commit erstellen

**Conventional Commits:**
```
typ(beschreibung): kurze beschreibung

beispiel:
feat(mobilitaet): oepnv-verbindungssuche hinzugefuegt
fix(taler): fehler bei p2p-zahlung behoben
docs(readme): quick-start aktualisiert
```

**Typen:**
- `feat` – Neues Feature
- `fix` – Bugfix
- `docs` – Dokumentation
- `style` – Formatierung (keine Änderung am Code)
- `refactor` – Code-Verbesserung
- `test` – Tests
- `chore` – Build-Prozess, Abhängigkeiten

### 4. PR erstellen

- Titel: `feat: Kurze Beschreibung`
- Beschreibung: Was wurde geändert? Warum?
- Verlinke relevante Issues (#123)
- Füge Screenshots hinzu (falls UI-Änderungen)

### 5. Review abwarten

- Mindestens 1 Approval erforderlich
- CI muss grün sein
- Änderungen nach Review einarbeiten

---

## Issue-Labels

| Label | Beschreibung |
|-------|--------------|
| `good-first-issue` | Einfache Aufgaben für Einsteiger |
| `bug` | Fehler |
| `feature` | Neues Feature |
| `enhancement` | Verbesserung eines bestehenden Features |
| `documentation` | Dokumentation |
| `help-wanted` | Hilfe benötigt |
| `question` | Frage |

---

## Kommunikation

### Matrix-Room

Trete unserem [Matrix-Room](https://matrix.to/#/heimat:matrix.org) bei:
- Allgemeine Fragen
- Ideen diskutieren
- Hilfe bekommen

### GitHub Discussions

Nutze [GitHub Discussions](https://github.com/abatn/HEIMAT/discussions) für:
- Feature-Ideen
- Architektur-Entscheidungen
- Allgemeine Fragen

---

## Erste Beiträge

### Good First Issues

Schau dir unsere [Good First Issues](https://github.com/abatn/HEIMAT/labels/good-first-issue) an, wenn du einsteigen möchtest.

### Beispiele für erste Beiträge

- Dokumentation verbessern
- Tests schreiben
- UI-Verbesserungen
- Bugfixes
- Code-Reviews

---

## Lizenz

Durch deinen Beitrag stimmst du zu, dass dein Code unter der [AGPL-3.0](LICENSE) Lizenz veröffentlicht wird.

---

## Danke!

Jeder Beitrag zählt. Danke, dass du HEIMAT 2.0 unterstützt!
