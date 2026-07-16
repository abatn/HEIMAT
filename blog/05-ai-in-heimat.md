---
title: "AI in HEIMAT 2.0"
date: 2024-02-12
author: HEIMAT Team
tags: [ai, kuenstliche-intelligenz, open-source]
---


<p align="center">
  <img src="../foto/logo.jpg" alt="HEIMAT 2.0 Logo" width="150">
</p>

# AI in HEIMAT 2.0

## Künstliche Intelligenz – datenschutzkonform und open source

Künstliche Intelligenz (KI) ist in aller Munde. Bei vielen Apps ist KI eine Black Box: Daten gehen rein, Ergebnisse kommen raus – und niemand weiß, was dazwischen passiert. Bei HEIMAT 2.0 ist das anders.

## Unsere KI-Philosophie

### Drei Grundprinzipien
1. **On-Device AI** – So viel wie möglich läuft lokal auf eurem Gerät
2. **Open Source** – Jeder kann die KI-Modelle prüfen und verändern
3. **Transparent** – Keine versteckten Algorithmen, keine Überraschungen

## KI-Funktionen nach Bereich

### Mobilität

| Funktion | Technologie | Datenschutz |
|----------|-------------|-------------|
| **Verspätungsvorhersage** | LightGBM | Anonymisierte Daten |
| **Personalisierte Routen** | TensorFlow Lite | Lokal auf dem Gerät |
| **Barrierefreie Routen** | OpenRouteService + ML | Öffentliche Daten |

**Beispiel:** Die App sagt euch: "Die Bahn hat heute 15 Minuten Verspätung – hier ist eine Alternative."

### Finanzen

| Funktion | Technologie | Datenschutz |
|----------|-------------|-------------|
| **Ausgabenkategorisierung** | spaCy + BERT | Lokal, keine Cloud |
| **Budget-Vorschläge** | Surprise (Recommender) | Anonymisiert |
| **Spar-Tipps** | LightGBM | Keine persönlichen Daten |

**Beispiel:** Die App erkennt: "Du hast diesen Monat mehr für Restaurantbesuche ausgegeben als sonst."

### Gesundheit

| Funktion | Technologie | Datenschutz |
|----------|-------------|-------------|
| **Termin-Empfehlungen** | Surprise | Keine Patientendaten |
| **Symptom-Checker** | spaCy + BERT | Lokal, ohne Diagnosen |

**Beispiel:** Die App schlägt vor: "Basierend auf deinen Symptomen könnte ein Allgemeinmediziner helfen."

### Alltag

| Funktion | Technologie | Datenschutz |
|----------|-------------|-------------|
| **Sprachsteuerung** | Vosk | Komplett offline |
| **Text-to-Speech** | Coqui TTS | Lokal |
| **Übersetzung** | MarianMT | Auf dem Gerät |

**Beispiel:** Spricht "HEIMAT, zeig mir die nächste Bushaltestelle" – und die App versteht euch, ohne Daten ins Internet zu schicken.

## Technische Architektur

### On-Device (lokal)
```
┌─────────────────────────────────────┐
│  Euer Smartphone                     │
├─────────────────────────────────────┤
│  TensorFlow Lite (ML)               │
│  Vosk (Speech-to-Text)              │
│  Coqui TTS (Text-to-Speech)         │
│  spaCy (NLP)                        │
└─────────────────────────────────────┘
```

### Cloud (nur wo nötig)
```
┌─────────────────────────────────────┐
│  Hetzner Cloud (Deutschland)         │
├─────────────────────────────────────┤
│  MLflow (Modell-Management)         │
│  FastAPI (ML-Services)              │
│  LightGBM (Training)               │
└─────────────────────────────────────┘
```

## Datenschutz bei KI

### Was wir NICHT tun
- ❌ Keine personenbezogenen Daten in der Cloud
- ❌ Kein Tracking eurer KI-Nutzung
- ❌ Kein Verkauf von Trainingsdaten
- ❌ Keine versteckten Algorithmen

### Was wir TUN
- ✅ On-Device AI, wo immer möglich
- ✅ Anonymisierte Daten für Training
- ✅ Opt-in für alle KI-Funktionen
- ✅ Offene Modelle zum Prüfen

## Rechtliches

### Haftungsausschluss
> "KI-Funktionen dienen ausschließlich zur Unterstützung und ersetzen keine professionelle Beratung. Bei medizinischen oder finanziellen Entscheidungen wenden Sie sich bitte an Fachleute."

### DSGVO-Konformität
- **Art. 5(1)(c):** Datenminimierung durch On-Device AI
- **Art. 7:** Opt-in für alle KI-Funktionen
- **Art. 17:** Recht auf Löschung aller KI-Daten

## Open-Source-KI-Tools

| Tool | Lizenz | Zweck |
|------|--------|-------|
| **TensorFlow Lite** | Apache 2.0 | On-Device ML |
| **Vosk** | Apache 2.0 | Speech-to-Text |
| **Coqui TTS** | MPL 2.0 | Text-to-Speech |
| **spaCy** | MIT | NLP |
| **LightGBM** | MIT | Gradient Boosting |
| **Surprise** | BSD | Recommender |
| **MLflow** | Apache 2.0 | Modell-Management |

## Zukunftspläne

### Phase 1: On-Device AI
- Sprachsteuerung (Vosk)
- Lokale Textklassifikation (TensorFlow Lite)

### Phase 2: Cloud AI
- Verspätungsvorhersage (LightGBM)
- Termin-Empfehlungen (Surprise)

### Phase 3: Generative AI
- Code-Generierung für Mini-Apps (Code Llama)

### Phase 4: Vollintegration
- Vollständige KI-Integration

## Fazit

KI muss nicht kompliziert und intransparent sein. Bei HEIMAT 2.0 ist KI ein Werkzeug, das euch hilft – ohne eure Daten zu kompromittieren.

**Eure Daten, eure KI. Open source, transparent, datenschutzkonform.**

---

*Mehr technische Details in unserer [AI-Architektur](https://github.com/abatn/HEIMAT/blob/main/AI-Architektur.md).*
