# HEIMAT 2.0 – AI-Implementierungsplan

> **Stand:** 2026-07-29 | **Letztes Update:** Health AI Agent Phasen (Symptom-Assessment, Triage, Lebenszeichen)
> **Forschung:** Wissenschaftlich fundierte Health-AI-Punkte aus Recherche (Ada Health, TriageBench, DEGAM, Ollama, On-Device TFLite)

---

## 🔴 Phase AI-Health-1: Symptom-Assessment + Triage + Arztsuche (JETZT)

**Ziel:** AI führt adaptives Symptom-Gespräch, bestimmt Dringlichkeit, findet passenden Arzt via Overpass.

| Aufgabe | Datei | Status | Tests |
|---------|-------|--------|-------|
| `fetchHealthData()` – Rohdaten statt Fertigtext | `promptService.ts` | ✅ **Fertig** | 3 |
| Symptom-Assessment im Chat | `ollamaService.ts` (System-Prompt) | ✅ **Fertig** | 1 |
| `'health'` in VALID_SERVICES | `ai.ts` | ✅ **Fertig** | Integration |
| `tsc --noEmit` typecheck | – | ✅ **Fertig** | – |
| **Post-Production:** Triage-Stufen verfeinern | `promptService.ts` | 🟡 Nächster Schritt | 3 |
| **Post-Production:** Haftungsausschluss-Check | Alle | 🟡 Nächster Schritt | – |

**Meilenstein:** Ollama kann Symptome erfragen, Dringlichkeit einschätzen und passenden Arzt empfehlen.

### Wissenschaftliche Basis
- **Symptom-Assessment:** Klinisch validiert (JAMA Network Open, 2021 – Ada Health 70-85% Übereinstimmung)
- **Triage:** `TriageBench` Open-Source-Benchmark + Manchester Triage System
- **Arztsuche:** Overpass API (OSM, ODbL) – bereits implementiert in `healthService.ts`

**Liability:** "Keine medizinische Diagnose. Dies ist eine KI-basierte Orientierungshilfe ohne Gewähr. Bei akuten Beschwerden wählen Sie 112 oder den ärztlichen Bereitschaftsdienst 116117."

---

## 🟡 Phase AI-Health-2: "Lebenszeichen" – Adaptives Check-in

**Ziel:** Timer-basiertes Sicherheitsnetz für alleinlebende Menschen. Keine Sensoren, kein Tracking – nur Check-in via Chat.

| Aufgabe | Datei | Status | Tests |
|---------|-------|--------|-------|
| Backend: Check-in-Timer-Logik | Neu: `checkinService.ts` | ⏳ Geplant | 5 |
| Backend: Eskalationskette (Push→SMS→112) | Neu: `checkinRoutes.ts` | ⏳ Geplant | 3 |
| Mobile: Check-in-Provider | `lib/features/checkin/` | ⏳ Geplant | 8 |
| Mobile: UI (Aktivierung + Status) | `lib/features/checkin/` | ⏳ Geplant | – |
| Mobile: Timer-Background-Service | `lib/core/services/` | ⏳ Geplant | – |

**Meilenstein:** Alleinlebende User können Check-in aktivieren. Bei ausbleibender Antwort → Familie → Rettungsdienst.

### Architektur-Prinzipien
- **KEINE Sensoren** – nur Timer + Chat-Interaktion
- **KEIN Accelerometer** – kein Hintergrund-Tracking
- **KEINE Kamera, kein Mikrofon** – reine App-Interaktion
- **Privacy-first** – User aktiviert bewusst, nichts läuft im Hintergrund
- **Eskalation nur bei ausbleibender Antwort** – keine permanente Überwachung

---

## 🟢 Phase AI-Health-3: On-Device TFLite Klassifikation (Phase 2)

**Ziel:** Erstklassifizierung von Symptomen on-device (15-60ms) bevor Backend-Ollama angefragt wird.

| Aufgabe | Tool | Status | Tests |
|---------|------|--------|-------|
| TFLite-Modell exportieren (MobileBERT) | TensorFlow Lite | ⏳ Geplant | – |
| OnDeviceSymptomClassifier | Flutter | ✅ **Fertig** (Phase AI-5) | 5 |
| HybridDecisionEngine | Flutter | ⏳ Geplant | 3 |
| Modell-Optimierung für deutsche Symptome | spaCy → TFLite | ⏳ Geplant | – |

**Meilenstein:** On-Device-Erstklassifikation (Notfall erkennen, Kategorie bestimmen) in <50ms.

### Wissenschaftliche Basis
- **MobileBERT:** 25-60MB quantisiert, 90%+ BERT-Genauigkeit bei 4× Geschwindigkeit
- **Notfall-Detection:** Regex + TFLite Hybrid – sofortige 112-Empfehlung

---

## 🟢 Phase AI-Health-4: Cross-Service AI Assistant (Phase 2)

**Ziel:** Quervernetzung aller HEIMAT-Services (Gesundheit + Wetter + Mobilität + Finanzen).

| Aufgabe | Datei | Status | Tests |
|---------|-------|--------|-------|
| Service-Prompts (Job, Events, Hotels, Bürgeramt) | `promptService.ts` | ✅ **Fertig** | 5 |
| Cross-Service Chat-Kontext | `ollamaService.ts` | ✅ **Fertig** | 3 |
| RAG mit DEGAM-Leitlinien | Neu: `ragService.ts` | ⏳ Geplant | 5 |

**Meilenstein:** AI versteht Zusammenhänge: "Morgen 10 Uhr Arzt in Berlin" → Route + Wetter + Parken.

---

## ⏳ Phase AI-Health-5: DEGAM-RAG + FHIR-Terminbuchung (Vision)

**Ziel:** Faktenbasierte medizinische Antworten + Terminbuchung.

| Aufgabe | Tool | Status | Tests |
|---------|------|--------|-------|
| DEGAM-Leitlinien als Vektordatenbank | Qdrant/Chroma | ⏳ Vision | – |
| FHIR-Scheduling-Integration | Open Reception | ⏳ Vision | – |
| Medizinische Haftungsstrategie | Legal | ⏳ Vision | – |

**Meilenstein:** AI kann mit klinischen Leitlinien antworten und direkt Termine buchen.

**⚠️ Blockiert durch:**
- DEGAM-Leitlinien sind nur als PDF verfügbar (kein maschinenlesbares Format)
- Deutsche Praxen haben keine offene FHIR-Schnittstelle
- Open Reception (BMBF) muss erst Praxis-Partnerschaften aufbauen

---

## 📊 Zeitplan

| Phase | Fokus | Zeit | Abhängigkeit |
|-------|-------|------|-------------|
| **AI-Health-1** | Symptom + Triage + Arzt | 🟢 **Live seit 2026-07-29** | Ollama läuft |
| **AI-Health-2** | Lebenszeichen Check-in | 🟡 2-3 Tage | Timer-Service Backend |
| **AI-Health-3** | On-Device TFLite | 🟢 **Phase AI-5 fertig** | TFLite-Modell |
| **AI-Health-4** | Cross-Service Assistant | 🟢 **Phase AI-4 fertig** | – |
| **AI-Health-5** | DEGAM-RAG + FHIR | ⏳ Offen (extern blockiert) | Lizenz + Praxis-APIs |

---

## Open-Source-Tools Übersicht

| Kategorie | Tool | Lizenz | On-Device | Status |
|-----------|------|--------|-----------|--------|
| **LLM** | Ollama (llama3.1:8b) | Llama 3 Community | ❌ Backend | ✅ **Aktiv** |
| **On-Device ML** | TFLite LiteRT | Apache 2.0 | ✅ | ⏳ Geplant |
| **NLP** | spaCy | MIT | ✅ | ⏳ Optional |
| **Vektordatenbank** | Qdrant/Chroma | Apache 2.0 | ❌ | ⏳ Vision |
| **Symptom-Checker** | MedPrompt | MIT | ❌ | ⏳ Forschung |
| **FHIR-Scheduling** | Open Reception | AGPL | ❌ | ⏳ Vision |
