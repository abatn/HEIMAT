# HEIMAT 2.0 – AI-Architektur

## Systemarchitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        HEIMAT 2.0 AI                            │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Flutter)                                             │
│  ├── TensorFlow Lite (On-Device ML)                            │
│  ├── Vosk (Speech-to-Text)                                     │
│  ├── Coqui TTS (Text-to-Speech)                                │
│  └── ML-UI-Komponenten                                         │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Node.js + FastAPI)                                    │
│  ├── API Gateway                                               │
│  ├── MLflow (Modell-Management)                                │
│  ├── FastAPI ML-Services                                       │
│  └── Redis (Modell-Cache)                                      │
├─────────────────────────────────────────────────────────────────┤
│  ML-Modelle                                                    │
│  ├── LightGBM / XGBoost (Verspätung, Budget)                  │
│  ├── spaCy / BERT (NLP, Textklassifikation)                   │
│  ├── Code Llama / StarCoder (Code-Generierung)                │
│  └── Surprise (Recommender-System)                             │
├─────────────────────────────────────────────────────────────────┤
│  Infrastruktur (Hetzner Cloud)                                  │
│  ├── GPU-Server (ML-Training)                                  │
│  ├── Docker + Kubernetes                                       │
│  └── Grafana + Prometheus                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend-Architektur (Flutter)

### TensorFlow Lite Integration

```yaml
# pubspec.yaml
dependencies:
  tflite_flutter: ^0.10.0
  image: ^4.0.0
```

```dart
// Beispiel: Lokale Textklassifikation
import 'package:tflite_flutter/tflite_flutter.dart';

class LocalClassifier {
  late Interpreter _interpreter;
  
  Future<void> loadModel() async {
    _interpreter = await Interpreter.fromAsset('model.tflite');
  }
  
  Future<String> classify(String text) async {
    // Text → Vektor → Vorhersage
    var input = preprocessText(text);
    var output = List.filled(1, 0.0).reshape([1, 1]);
    _interpreter.run(input, output);
    return decodeOutput(output);
  }
}
```

### Vosk Integration

```yaml
# pubspec.yaml
dependencies:
  vosk_flutter: ^0.3.0
```

```dart
// Beispiel: Offline-Spracherkennung
import 'package:vosk_flutter/vosk_flutter.dart';

class SpeechRecognizer {
  late Model _model;
  
  Future<void> loadModel(String modelPath) async {
    _model = await Model.create(modelPath);
  }
  
  Future<String> recognize(Uint8List audio) async {
    var recognizer = await Recognizer.create(_model);
    var result = await recognizer.acceptWaveformBytes(audio);
    return result.text;
  }
}
```

### Coqui TTS Integration

```yaml
# pubspec.yaml
dependencies:
  coqui_tts: ^0.1.0
```

```dart
// Beispiel: Offline Text-to-Speech
import 'package:coqui_tts/coqui_tts.dart';

class TextToSpeech {
  late TtsEngine _engine;
  
  Future<void> loadModel(String modelPath) async {
    _engine = await TtsEngine.create(modelPath);
  }
  
  Future<void> speak(String text) async {
    await _engine.synthesize(text);
  }
}
```

---

## Backend-Architektur

### MLflow Setup

```yaml
# docker-compose.yml
services:
  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.8.0
    ports:
      - "5000:5000"
    volumes:
      - mlflow-data:/mlflow
    command: mlflow server --host 0.0.0.0
```

```python
# mlflow_tracking.py
import mlflow

mlflow.set_tracking_uri("http://mlflow:5000")

with mlflow.start_run():
    mlflow.log_param("model_type", "lightgbm")
    mlflow.log_metric("accuracy", 0.85)
    mlflow.sklearn.log_model(model, "model")
```

### FastAPI ML-Service

```python
# api/ml_service.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib

app = FastAPI()

class PredictionRequest(BaseModel):
    features: list[float]

class PredictionResponse(BaseModel):
    prediction: float
    confidence: float

@app.post("/predict/delay", response_model=PredictionResponse)
async def predict_delay(request: PredictionRequest):
    model = joblib.load("models/delay_model.pkl")
    prediction = model.predict([request.features])
    return PredictionResponse(
        prediction=prediction[0],
        confidence=0.85
    )
```

---

## ML-Modelle

### LightGBM (Verspätungsvorhersage)

```python
import lightgbm as lgb

# Training
train_data = lgb.Dataset(X_train, label=y_train)
params = {
    'objective': 'regression',
    'metric': 'rmse',
    'boosting_type': 'gbdt'
}
model = lgb.train(params, train_data)

# Vorhersage
prediction = model.predict(X_new)
```

### spaCy (NLP)

```python
import spacy

# Deutsches Modell laden
nlp = spacy.load("de_core_news_lg")

# Text klassifizieren
doc = nlp("Ich möchte von Berlin nach München reisen")
entities = [(ent.text, ent.label_) for ent in doc.ents]
```

### Code Llama (Code-Generierung)

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("codellama/CodeLlama-7b-hf")
model = AutoModelForCausalLM.from_pretrained("codellama/CodeLlama-7b-hf")

# Code generieren
prompt = "Erstelle eine Flutter-Funktion für Geolocation:"
inputs = tokenizer(prompt, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=200)
code = tokenizer.decode(outputs[0])
```

---

## On-Device vs. Cloud Entscheidung

| Entscheidungskriterium | On-Device | Cloud |
|------------------------|-----------|-------|
| **Datenschutz** | ✅ Keine Datenübertragung | ❌ Daten verlassen das Gerät |
| **Performance** | ✅ Keine Latenz | ❌ Netzwerk-Latenz |
| **Kosten** | ✅ €0 | ❌ Hosting-Kosten |
| **Modellgröße** | ❌ Begrenzt | ✅ Unbegrenzt |
| **Training** | ❌ Schwierig | ✅ Einfach |

**Empfehlung:**
- **On-Device:** Sprachsteuerung, TTS, einfache Klassifikation
- **Cloud:** Training, große Modelle (Code Llama), Recommender-Systeme
