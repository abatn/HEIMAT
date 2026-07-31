# HEIMAT 2.0 – AI-Implementierungsplan

> **Stand:** 2026-07-31 | **Letztes Update:** DEGAM-RAG implementiert (Commit 2537e48) + FHIR-Decision NOT NOW + 5 Appointment-Verbesserungen (Commit 01f91a4 + d1d0a58)
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
| RAG mit DEGAM-Leitlinien | Neu: `ragService.ts` | ✅ **Fertig** (Commit 2537e48) | healthTriage 6 |

**Meilenstein:** AI versteht Zusammenhänge: "Morgen 10 Uhr Arzt in Berlin" → Route + Wetter + Parken.

---

## 🟢 Phase AI-Health-5: DEGAM-RAG + Terminbuchung (umgesetzt statt FHIR)

**Ziel:** Faktenbasierte medizinische Antworten + Terminbuchung.

| Aufgabe | Tool | Status | Tests |
|---------|------|--------|-------|
| DEGAM-Leitlinien RAG (statt Vektordatenbank) | `ragService.ts` + PostgreSQL tsvector | ✅ **Fertig** (Commit 2537e48) | 5 |
| FHIR-Scheduling-Integration | ❌ **NOT NOW** (2026-07-31) | – | – |
| **5 Appointment-Verbesserungen statt FHIR** | `healthService.ts` + Flutter-UI | ✅ **Fertig** (Commit 01f91a4 + d1d0a58) | 23 |
| Medizinische Haftungsstrategie | Legal | ⏳ Vision | – |

**FHIR-Decision (2026-07-31):** HAPI FHIR (~500MB), Medplum (~200MB), Firely (.NET) zu schwer für Render Free (512MB) + kein Interop-Benefit (OSM-Ärzte haben keine FHIR-Endpunkte). HEIMAT-Äquivalent existiert: `doctor_slots` ≈ Schedule, `getAvailableSlots()` ≈ Slot, `appointments` ≈ Appointment.

**Stattdessen implementiert:**
1. Status-Pipeline: pending → confirmed → completed → no-show (`PUT /appointments/:id/complete` + `/no-show`)
2. Recurring Slots: Serien-Termine 1-12 Wochen (`POST /appointments/recurring`)
3. Warteliste: `appointment_waitlist` + Auto-Promotion bei Stornierung (`POST /appointments/waitlist`)
4. Notiz-Feld: `notes` in Buchung
5. Termin-Erinnerung: `GET /appointments/reminders` + Flutter-Reminder-Banner (Commit d1d0a58)

**Meilenstein:** AI kann mit klinischen Leitlinien antworten und Termine buchen (inkl. Warteliste + Erinnerung).

---

## 📊 Zeitplan

| Phase | Fokus | Zeit | Abhängigkeit |
|-------|-------|------|-------------|
| **AI-Health-1** | Symptom + Triage + Arzt | 🟢 **Live seit 2026-07-29** | Ollama läuft |
| **AI-Health-2** | Lebenszeichen Check-in | 🟡 2-3 Tage | Timer-Service Backend |
| **AI-Health-3** | On-Device TFLite | 🟢 **Phase AI-5 fertig** | TFLite-Modell |
| **AI-Health-4** | Cross-Service Assistant | 🟢 **Phase AI-4 fertig** | – |
| **AI-Health-5** | DEGAM-RAG + Terminbuchung | 🟢 **Fertig 2026-07-31** | tsvector + 5 Appointment-Verbesserungen |

---

## Open-Source-Tools Übersicht

| Kategorie | Tool | Lizenz | On-Device | Status |
|-----------|------|--------|-----------|--------|
| **LLM** | Ollama (llama3.1:8b) | Llama 3 Community | ❌ Backend | ✅ **Aktiv** |
| **On-Device ML** | TFLite LiteRT | Apache 2.0 | ✅ | ⏳ Geplant |
| **NLP** | spaCy | MIT | ✅ | ⏳ Optional |
| **Vektordatenbank** | Qdrant/Chroma | Apache 2.0 | ❌ | ⏳ Vision |
| **Symptom-Checker** | MedPrompt | MIT | ❌ | ⏳ Forschung |
| **FHIR-Scheduling** | Open Reception | AGPL | ❌ | ❌ **NOT NOW** (Decision 2026-07-31) |
