# HEIMAT 2.0 – Blog-Beiträge Veröffentlichung

## Vorbereitung

### Blog-Plattform wählen

| Option | Vorteile | Nachteile |
|--------|----------|-----------|
| **GitHub Pages** | Kostenlos, einfach | Eingeschränkte Features |
| **Hugo** | Schnell, Open Source | Learning Curve |
| **Jekyll** | Einfach, GitHub-Integration | Weniger flexibel |
| **Ghost** | Modern, einfach | Hosting-Kosten |

**Empfehlung:** GitHub Pages + Hugo

---

## Schritt 1: GitHub Pages einrichten

### Repository erstellen
1. Neues Repository: `abatn/heimat-blog`
2. Public wählen
3. README hinzufügen

### Hugo installieren
```bash
# macOS
brew install hugo

# Linux
sudo snap install hugo

# Windows
choco install hugo-extended
```

### Site erstellen
```bash
hugo new site heimat-blog
cd heimat-blog
git init
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

### config.toml
```toml
baseURL = "https://abatn.github.io/heimat-blog/"
languageCode = "de"
title = "HEIMAT 2.0 Blog"

[params]
  author = "HEIMAT Team"
  description = "Blog für HEIMAT 2.0 – Open-Source Super App"
  defaultTheme = "auto"

[markup]
  [markup.highlight]
    style = "monokai"
```

---

## Schritt 2: Beiträge vorbereiten

### Datei-Struktur
```
content/
├── posts/
│   ├── 01-was-ist-heimat.md
│   ├── 02-warum-open-source.md
│   ├── 03-datenschutz-als-feature.md
│   ├── 04-erste-schritte-contributing.md
│   └── 05-ai-in-heimat.md
```

### Front Matter für jeden Beitrag
```yaml
---
title: "Was ist HEIMAT 2.0?"
date: 2024-01-15
draft: false
tags: ["projekt", "vorstellung"]
categories: ["Allgemein"]
author: "HEIMAT Team"
---
```

---

## Schritt 3: Beiträge veröffentlichen

### Reihenfolge

| Woche | Beitrag | Datum |
|-------|---------|-------|
| 1 | Was ist HEIMAT 2.0? | Mo |
| 2 | Warum Open Source? | Mo |
| 3 | Datenschutz als Feature | Mo |
| 4 | Erste Schritte zum Contributieren | Mo |
| 5 | AI in HEIMAT 2.0 | Mo |

### Für jeden Beitrag

1. **Datei erstellen** in `content/posts/`
2. **Front Matter** anpassen
3. **Lokal testen:** `hugo server`
4. **Commit erstellen**
5. **Push zu GitHub**
6. **Auf Mastodon teilen**
7. **In Reddit posten** (nach Woche 1)

---

## Schritt 4: Mastodon-Integration

### Für jeden Beitrag
```
📝 Neuer Blog-Beitrag: [Titel]

[Kurze Zusammenfassung]

👉 [Link zum Beitrag]

#Blog #OpenSource #HEIMAT
```

### Beispiel
```
📝 Neuer Blog-Beitrag: Was ist HEIMAT 2.0?

HEIMAT 2.0 ist eine Open-Source Super App für den deutschen 
Alltag – 100% kostenlos, 100% datenschutzkonform.

👉 https://abatn.github.io/heimat-blog/posts/01-was-ist-heimat/

#Blog #OpenSource #HEIMAT
```

---

## Schritt 5: Reddit-Integration

### Nach Woche 1
- r/opensource: Ersten Post erstellen
- r/de: Zweiten Post erstellen
- r/selfhosted: Dritten Post erstellen

### Template
```
[Projekt] HEIMAT 2.0 – Die erste Open-Source Super App für Deutschland

Hallo r/opensource,

ich möchte euch ein neues Projekt vorstellen: HEIMAT 2.0 – 
eine Open-Source Super App für den deutschen Alltag.

Features:
- ÖPNV-Suche (OpenStreetMap)
- P2P-Zahlungen (GNU Taler)
- Arzt-Termine (Cal.com)
- On-Device AI (TensorFlow Lite)

100% Open Source, 100% kostenlos, 100% datenschutzkonform.

GitHub: https://github.com/abatn/HEIMAT
Blog: https://abatn.github.io/heimat-blog/

Was haltet ihr davon?
```

---

## Checkliste

- [ ] GitHub Pages Repository erstellt
- [ ] Hugo installiert und konfiguriert
- [ ] 5 Beiträge vorbereitet
- [ ] Reihenfolge festgelegt
- [ ] Mastodon-Posts vorbereitet
- [ ] Reddit-Posts vorbereitet
- [ ] Erster Beitrag veröffentlichen (Woche 1)

---

## Nächste Schritte

1. **Heute:** GitHub Pages Repository erstellen
2. **Morgen:** Hugo installieren und konfigurieren
3. **Diese Woche:** Ersten Beitrag veröffentlichen
4. **Nächste Woche:** Zweiter Beitrag + erster Reddit-Post
