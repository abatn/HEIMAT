# HEIMAT 2.0 – AI-Implementierungsplan

## Zeitplan (relativ)

### Phase 1: On-Device AI

| Aufgabe | Tool | Verantwortlich | Status |
|---------|------|----------------|--------|
| TensorFlow Lite Integration | tflite_flutter | 2 ML-Engineers | ⏳ |
| Vosk Setup (Speech-to-Text) | vosk_flutter | 1 ML-Engineer | ⏳ |
| Coqui TTS Integration | coqui_tts | 1 ML-Engineer | ⏳ |
| Lokale NLP-Klassifikation | spaCy | 1 ML-Engineer | ⏳ |
| UI für AI-Funktionen | Flutter | 2 Frontend-Devs | ⏳ |

**Meilenstein:** Sprachsteuerung und lokale Kategorisierung funktionieren offline.

**Benötigte Contributors:**
- 2 ML-Engineers (TensorFlow, Vosk)
- 2 Frontend-Devs (Flutter UI)

**Open-Source-Tools:**
- TensorFlow Lite
- Vosk
- Coqui TTS
- spaCy

---

### Phase 2: Cloud AI

| Aufgabe | Tool | Verantwortlich | Status |
|---------|------|----------------|--------|
| MLflow Setup | MLflow | 1 Backend-Dev | ⏳ |
| FastAPI ML-Services | FastAPI | 2 Backend-Devs | ⏳ |
| LightGBM Training | LightGBM | 1 ML-Engineer | ⏳ |
| Verspätungsvorhersage | LightGBM | 1 ML-Engineer | ⏳ |
| Termin-Empfehlungen | Surprise | 1 ML-Engineer | ⏳ |
| Redis Caching | Redis | 1 Backend-Dev | ⏳ |

**Meilenstein:** Cloud-basierte AI-Services für Verspätung und Termine verfügbar.

**Benötigte Contributors:**
- 2 Backend-Devs (FastAPI, MLflow)
- 1 ML-Engineer (Training)

**Open-Source-Tools:**
- MLflow
- FastAPI
- LightGBM
- Surprise
- Redis

---

### Phase 3: Generative AI

| Aufgabe | Tool | Verantwortlich | Status |
|---------|------|----------------|--------|
| Code Llama Setup | Code Llama | 1 ML-Engineer | ⏳ |
| StarCoder Integration | StarCoder | 1 ML-Engineer | ⏳ |
| GPU-Server Konfiguration | Hetzner | 1 DevOps | ⏳ |
| Code-Generierung für Mini-Apps | Code Llama | 1 ML-Engineer | ⏳ |
| Automatische Dokumentation | spaCy + BERT | 1 Dev | ⏳ |

**Meilenstein:** Code-Generierung für Mini-Apps funktioniert.

**Benötigte Contributors:**
- 1 ML-Engineer (Code Llama)
- 1 Dev (Integration)
- 1 DevOps (GPU-Server)

**Open-Source-Tools:**
- Code Llama
- StarCoder
- spaCy
- BERT

---

### Phase 4: Vollintegration

| Aufgabe | Tool | Verantwortlich | Status |
|---------|------|----------------|--------|
| Alle Systeme verbinden | Alle | 3 Developers | ⏳ |
| Performance-Optimierung | Alle | 2 Developers | ⏳ |
| DSGVO-Audit | Alle | 1 Legal | ⏳ |
| Dokumentation | Alle | 1 Dev | ⏳ |
| Community-Training | Alle | 1 Community | ⏳ |

**Meilenstein:** Vollständige AI-Integration in alle HEIMAT-Bereiche.

**Benötigte Contributors:**
- 3 Developers
- 1 Legal (DSGVO)
- 1 Community Manager

---

## Meilensteine

| Meilenstein | Status |
|-------------|--------|
| On-Device AI Setup | ⏳ Geplant |
| Sprachsteuerung funktioniert | ⏳ Geplant |
| Cloud AI Services verfügbar | ⏳ Geplant |
| Code-Generierung funktioniert | ⏳ Geplant |
| Vollständige AI-Integration | ⏳ Geplant |

---

## Open-Source-Tools Übersicht

| Kategorie | Tool | Lizenz | On-Device |
|-----------|------|--------|-----------|
| **ML-Framework** | TensorFlow Lite | Apache 2.0 | ✅ |
| **Speech-to-Text** | Vosk | Apache 2.0 | ✅ |
| **Text-to-Speech** | Coqui TTS | MPL 2.0 | ✅ |
| **NLP** | spaCy | MIT | ✅ |
| **Gradient Boosting** | LightGBM | MIT | ❌ |
| **Recommender** | Surprise | BSD | ❌ |
| **Code-Generierung** | Code Llama | Llama 2 | ❌ |
| **Modell-Management** | MLflow | Apache 2.0 | ❌ |
| **API-Framework** | FastAPI | MIT | ❌ |

---

## Tester und Validierung

Für jede Phase:
1. **Unit Tests** (Flutter/Jest)
2. **Integration Tests** (API + ML)
3. **Performance Tests** (Latenz, Genauigkeit)
4. **DSGVO-Audit** (Datenschutzprüfung)
5. **Community-Feedback** (Beta-Tester)
