# HEIMAT 2.0 – AI-Architektur

> **Stand:** 2026-07-29 | **Letztes Update:** Health AI Agent Hybrid-Architektur (On-Device TFLite + Backend Ollama)
> **Lizenz:** AGPL v3

---

## 1. Hybrid-Architektur: On-Device + Backend AI

```
┌────────────────────────────────────────────────────────────────────┐
│                        HEIMAT 2.0 AI                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ON-DEVICE (TFLite)               BACKEND (Ollama)                │
│  ──────────────────────           ────────────────────            │
│  • Symptom-Klassifikation         • Adaptives Symptom-Gespräch    │
│  • Notfall-Keyword-Erkennung      • Triage (112/116117/Routine)   │
│  • Intent-Erkennung               • Arzt-Empfehlung via Overpass  │
│  • Einfache UI-Entscheidungen     • RAG (zukünftig: DEGAM)        │
│                                    • Cross-Service-Intelligenz     │
│                                                                    │
│  Hybrid-Entscheidungslogik:                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. On-Device: Ist es ein Notfall-Keyword?  → Lokale Aktion │  │
│  │  2. On-Device: Welche Symptom-Kategorie?    → + Kontext      │  │
│  │  3. Backend: Adaptives Gespräch + Triage    → Antwort        │  │
│  │  4. Backend: Overpass-Arzt-Suche            → Empfehlung     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  Frontend (Flutter)                                                │
│  ├── TFLite LiteRT (On-Device ML, 15-60MB Modelle)               │
│  ├── Ollama-Client (HTTP POST an Backend /api/ai/chat)           │
│  ├── LocationService (Geolokation für Kontext)                   │
│  └── Ui-Komponenten (ChatScreen, Check-in Widget, Health-Card)   │
├────────────────────────────────────────────────────────────────────┤
│  Backend (Node.js Express + Ollama remote)                        │
│  ├── ollamaService.ts (Ollama-Client über HTTP/OLLAMA_BASE_URL)   │
│  ├── promptService.ts (Service-Prompts + Cross-Service-Context)   │
│  ├── ai.ts Route (POST /api/ai/chat + GET /api/ai/status)       │
│  ├── Ollama Server (llama3.1:8b, eigenständig auf VPS)           │
│  └── RAG Service (zukünftig: Vektordatenbank für DEGAM)          │
├────────────────────────────────────────────────────────────────────┤
│  AI-Modelle                                                       │
│  ├── llama3.1:8b (Ollama, Backend) – Konversation + Reasoning    │
│  ├── MobileBERT/DistilBERT (TFLite, On-Device) – Klassifikation  │
│  └── spaCy (On-Device) – Intent-Erkennung (optional)             │
├────────────────────────────────────────────────────────────────────┤
│  Infrastruktur                                                    │
│  ├── Ollama Server: 158.180.18.110:11434 (eigenständiger VPS)   │
│  ├── Render Backend: heimat-backend.onrender.com                 │
│  └── GitHub Pages: abatn.github.io/HEIMAT/                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Health AI Agent – Datenfluss

```
User: "Ich habe Rückenschmerzen"
    │
    ▼
┌─────────────────────────────────────────────────┐
│ ON-DEVICE (TFLite, <10ms)                      │
│                                                 │
│ 1. Keyword-Detection: "Rückenschmerzen"         │
│    → KEIN Notfall-Keyword (kein "Brustschmerz") │
│    → Symptom-Kategorie: Orthopädie              │
│                                                 │
│ 2. Intent: "Health Symptom"                     │
│    → Nicht: Routenanfrage, Wetter, etc.         │
└──────────────────────┬──────────────────────────┘
                       │ POST /api/ai/chat
                       ▼
┌─────────────────────────────────────────────────┐
│ BACKEND (Ollama, 500-2000ms)                    │
│                                                 │
│ 3. ollamaService.ts → llama3.1:8b              │
│    "Führe adaptives Symptom-Gespräch:           │
│     - Seit wann?                                │
│     - Schmerzskala 1-10?                        │
│     - Ausstrahlung?                             │
│     - Begleitsymptome?"                         │
│                                                 │
│ 4. User antwortet → erneuter API-Call          │
│                                                 │
│ 5. Triage durch llama3.1:8b:                   │
│    - Notfall (112): Brustschmerz + Atemnot      │
│    - Bereitschaft (116117): Fieber + starke     │
│      Schmerzen, kein Termin frei                │
│    - Routine: Seit Tagen, Schmerz 4/10          │
│                                                 │
│ 6. promptService.ts: fetchHealthData()          │
│    → healthService.getNearbyDoctors(lat, lng)   │
│    → Overpass API: Orthopäden in der Nähe       │
│    → 3 Orthopäden gefunden                      │
│                                                 │
│ 7. Ollama generiert Antwort:                    │
│    "Bei Rückenschmerzen ist ein Orthopäde       │
│     die richtige Wahl. 3 Orthopäden in Ihrer    │
│     Nähe: Dr. Müller (1.2km)... Soll ich        │
│     die Adresse zeigen?"                        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
           Haftungsausschluss eingeblendet:
           "Keine medizinische Diagnose. Dies ist eine KI-basierte
           Orientierungshilfe ohne Gewähr. Bei akuten Beschwerden
           wählen Sie 112 oder den ärztlichen Bereitschaftsdienst 116117."
```

---

## 3. TFLite On-Device Integration (Flutter)

```yaml
# pubspec.yaml (für Phase AI-5 On-Device Classifier)
dependencies:
  tflite_flutter: ^0.10.0
```

```dart
// OnDeviceSymptomClassifier – läuft 100% lokal, kein Netzwerk
// Modell: ~15-60MB (MobileBERT, DistilBERT)
// Output: Symptom-Kategorie (20+ Klassen) + Notfall-Boolean

class OnDeviceSymptomClassifier {
  late Interpreter _interpreter;

  Future<void> loadModel() async {
    _interpreter = await Interpreter.fromAsset('symptom_model.tflite');
  }

  Future<SymptomResult> classify(String text) async {
    final input = preprocessText(text);
    final output = List.filled(22, 0.0).reshape([1, 22]);
    _interpreter.run(input, output);

    final category = decodeCategory(output);
    final isEmergency = category == 'emergency'; // Brustschmerz, Schlaganfall, etc.

    return SymptomResult(category: category, isEmergency: isEmergency);
  }
}

class SymptomResult {
  final String category; // orthopedics, cardiology, neurology, ...
  final bool isEmergency;
}
```

### Entscheidungslogik (Hybrid)

```dart
class HybridDecisionEngine {
  final OnDeviceSymptomClassifier _local = OnDeviceSymptomClassifier();
  final ApiClient _api = ApiClient();

  Future<HealthResponse> processSymptom(String symptomText) async {
    // Schritt 1: On-Device – sofortige Notfall-Erkennung
    final localResult = await _local.classify(symptomText);
    if (localResult.isEmergency) {
      return HealthResponse.emergency(
        message: "Wählen Sie SOFORT 112! Bei Brustschmerz + Atemnot "
                "handelt es sich um einen medizinischen Notfall.",
        emergencyPhone: "112"
      );
    }

    // Schritt 2: Backend – adaptives Gespräch + Triage
    return await _api.post('/api/ai/chat', {
      'message': symptomText,
      'category': localResult.category,
      'services': {'health': {'lat': lat, 'lng': lng}}
    });
  }
}
```

---

## 4. Lebenszeichen – Adaptive Check-in Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│               "Lebenszeichen" – Adaptives Check-in               │
│                                                                  │
│  User aktiviert einmalig: "Ja, ich möchte Check-in"             │
│  → KEINE Sensoren im Hintergrund                                │
│  → KEIN Accelerometer-Tracking                                  │
│  → KEINE Kamera, kein Mikrofon                                  │
│  → Nur Timer-basiert (App-interne Erinnerung)                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NORMALMODUS:                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 08:00 AI: "Guten Morgen! Alles okay bei dir? 👋"        │    │
│  │ 08:01 User: "👍"                                        │    │
│  │ → Reset Timer (nächster Check-in morgen)                 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  KEINE ANTWORT (Stufe 1):                                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 08:00 AI: "Guten Morgen!"                                │    │
│  │ 10:00 Keine Antwort → Push: "Hey, alles klar?"           │    │
│  │ 12:00 Keine Antwort → SMS an Notfallkontakt:             │    │
│  │   "Max Mustermann hat sich seit 4h nicht gemeldet.       │    │
│  │    Bitte ruf ihn an."                                    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  GESUNDHEITSKONTEXT (adaptiv):                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ User meldete gestern "Brustschmerzen" im Chat            │    │
│  │ → Timer von 24h auf 6h verkürzt                          │    │
│  │ → 1h ohne Antwort: SMS an Notfallkontakt + 112-Empfehlung│    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Timer-Konfiguration (SharedPreferences, änderbar):              │
│  - Normal: 24h zwischen Check-ins                               │
│  - Gesundheits-Kontext: 6h (wenn Symptome gemeldet)             │
│  - Check-in im Chat: Reset Timer                                │
│  - App öffnen (beliebiger Tab): Reset Timer                     │
│  - Eskalation Stufe 1: Push + Sound (2h nach Timer-Ablauf)      │
│  - Eskalation Stufe 2: SMS Notfallkontakt (6h nach Timer)       │
│  - Eskalation Stufe 3: 112 (nur bei vorherigen Symptomen)       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. API-Endpoints (AI)

| Methode | Pfad | Middleware | Service | Beschreibung |
|---------|------|-----------|---------|-------------|
| `GET` | `/api/ai/status` | – | – | Ollama-Verbindungsstatus |
| `POST` | `/api/ai/chat` | – | ollamaService | Chat mit Service-Kontext |
| `GET` | `/api/ai/service-prompt` | – | promptService | Service-Prompts (Wetter, Luft, Abfall, Gesundheit) |
| `GET` | `/api/ai/home` | – | aiHomeService | Dashboard-Kontext |
| `POST` | `/api/ai/home/personalized` | – | aiHomeService | Personalisierte Dashboard-Daten |

---

## 6. On-Device vs. Backend Entscheidungsmatrix

| Entscheidungskriterium | On-Device (TFLite) | Backend (Ollama) |
|------------------------|-------------------|------------------|
| **Datenschutz** | ✅ Keine Datenübertragung | ⚠️ Daten verlassen Gerät (anonymisiert) |
| **Latenz** | ✅ <10ms | ❌ 500-2000ms |
| **Kosten** | ✅ €0 | ⚠️ €5-10/Monat Server |
| **Modellgröße** | ❌ 15-60 MB (MobileBERT) | ✅ 4-8 GB (llama3.1:8b) |
| **Komplexität** | ❌ Einfache Klassifikation | ✅ Komplexes Reasoning |
| **Offline-Fähig** | ✅ Ja | ❌ Nein |

**Empfehlung (wissenschaftlich fundiert):**
- **On-Device:** Notfall-Keyword-Detection, Symptom-Kategorie, einfache UI-Entscheidungen
- **Backend:** Adaptives Gespräch, Triage, Arzt-Empfehlung, Cross-Service-Intelligenz
