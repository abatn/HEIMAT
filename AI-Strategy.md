# HEIMAT 2.0 – AI-Strategie

## Executive Summary

HEIMAT 2.0 integriert KI-gestützte Funktionen in alle Kernbereiche – **vollständig Open Source, kostenlos und datenschutzkonform**. Der Fokus liegt auf On-Device AI, um personenbezogene Daten lokal zu verarbeiten und DSGVO-Anforderungen zu erfüllen.

**Kernprinzipien der AI-Strategie:**
- 100% Open Source (TensorFlow Lite, Vosk, spaCy, Code Llama)
- On-Device AI bevorzugt (keine Daten in der Cloud)
- Keine kommerziellen APIs (kein OpenAI, Google, etc.)
- DSGVO-konform (Art. 5, 7, 17 DSGVO)
- Kosten: <€100/Jahr (Hosting + Domain)

---

## AI-Anwendungsfälle nach Bereich

### 1. Mobilität

| Anwendungsfall | Tool | Implementierung | Kosten |
|----------------|------|-----------------|--------|
| **Verspätungsvorhersage** | LightGBM | Cloud (GPU-Server) | €20-50/Monat |
| **Personalisierte Routen** | TensorFlow Lite | On-Device | €0 |
| **Barrierefreie Routen** | OpenRouteService + ML | Cloud | €0 (nur Hosting) |

**Datenschutz:** Routendaten werden anonymisiert verarbeitet. Keine Zuordnung zu einzelnen Nutzern.

### 2. Finanzen

| Anwendungsfall | Tool | Implementierung | Kosten |
|----------------|------|-----------------|--------|
| **Ausgabenkategorisierung** | spaCy + BERT | On-Device | €0 |
| **Budget-Vorschläge** | Surprise (Recommender) | Cloud | €0 (nur Hosting) |
| **Spar-Tipps** | LightGBM | Cloud | €0 (nur Hosting) |

**Datenschutz:** Finanzdaten verlassen das Gerät nie. Modelle werden lokal trainiert.

### 3. Gesundheit

| Anwendungsfall | Tool | Implementierung | Kosten |
|----------------|------|-----------------|--------|
| **Termin-Empfehlungen** | Surprise (Recommender) | Cloud | €0 (nur Hosting) |
| **Symptom-Checker** | spaCy + BERT | On-Device | €0 |

**Haftungsausschluss:** "Dieser Service ersetzt keine ärztliche Beratung. Bei akuten Beschwerden wenden Sie sich bitte an Ihren Arzt."

### 4. Alltag

| Anwendungsfall | Tool | Implementierung | Kosten |
|----------------|------|-----------------|--------|
| **Sprachsteuerung** | Vosk | On-Device | €0 |
| **Text-to-Speech** | Coqui TTS | On-Device | €0 |
| **Übersetzung** | MarianMT (Hugging Face) | On-Device | €0 |

**Datenschutz:** Sprachdaten werden lokal verarbeitet und sofort gelöscht.

### 5. Entwicklung

| Anwendungsfall | Tool | Implementierung | Kosten |
|----------------|------|-----------------|--------|
| **Code-Generierung** | Code Llama / StarCoder | Cloud (GPU) | €20-50/Monat |
| **Automatische Dokumentation** | spaCy + BERT | On-Device | €0 |
| **Bug-Fixing** | Code Llama | Cloud | €0 (nur Hosting) |

**Datenschutz:** Code wird nur lokal verarbeitet. Keine Übertragung an externe Server.

---

## On-Device vs. Cloud

| Komponente | On-Device | Cloud |
|------------|-----------|-------|
| TensorFlow Lite | ✅ | ❌ |
| Vosk (Speech) | ✅ | ❌ |
| Coqui TTS | ✅ | ❌ |
| spaCy (NLP) | ✅ | ❌ |
| LightGBM (Training) | ❌ | ✅ |
| Code Llama (Groß) | ❌ | ✅ |
| MLflow (Management) | ❌ | ✅ |

**Regel:** So viel wie möglich On-Device, nur Training und große Modelle in der Cloud.

---

## Erfolgskriterien

1. **Open-Source-Nutzung:** 100% der AI-Tools sind Open Source
2. **Datenschutz:** On-Device AI bevorzugt
3. **Rechtliche Unbedenklichkeit:** Keine BaFin-Lizenz, keine DSGVO-Verstöße
4. **Kostenfreiheit:** Maximale Kosten <€100/Jahr
5. **Community:** 3-5 Contributors für AI-Bereich nach 12 Monaten
