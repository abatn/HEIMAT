# HEIMAT 2.0 – AI-Strategie

> **Stand:** 2026-07-29 | **Letztes Update:** Research-basierte Health AI Agent Strategie
> **Lizenz:** AGPL v3
> **Kernprinzip:** 100% Open Source, keine kommerziellen APIs, Privacy-by-Design

---

## Executive Summary

HEIMAT 2.0 integriert KI-gestützte Funktionen in **alle Kernbereiche** – vollständig Open Source, kostenlos und datenschutzkonform. Die AI-Strategie basiert auf einer **Hybrid-Architektur**: On-Device AI (TFLite) für einfache, latenzkritische Tasks + Backend-Ollama (`llama3.1:8b`) für komplexe Reasoning-Aufgaben.

**Forschungsergebnis (2026-07-29):** Umfassende Recherche zu Open-Source-Health-AI-Projekten, medizinischen LLMs, Symptom-Assessment-Systemen und Privacy-first-Architekturen. Die Strategie wurde auf Basis dieser Forschung wissenschaftlich fundiert und pragmatisch priorisiert.

### Kernprinzipien
- 100% Open Source (TFLite, Ollama, spaCy, ONNX)
- Hybrid-Architektur: On-Device für Speed + Backend für Intelligence
- Keine kommerziellen APIs (kein OpenAI, Google, Ada Health)
- DSGVO-konform (Art. 5, 7, 9, 17 DSGVO)
- Kosten: <€100/Jahr (Hosting + Domain + Ollama-Server)

---

## 🔬 Research-Basierte Bewertung: 7+1 Health AI Punkte

### 1. Symptom-Assessment (Ada Health-ähnlich)

| Aspekt | Bewertung |
|--------|-----------|
| **Wissenschaftlich?** | ✅ **Klinisch validiert** – Ada Health erreicht 70-85% Übereinstimmung mit Ärzten (JAMA Network Open, 2021). Open-Source-Alternativen: `HealthcareSymptomChecker-Unthinkable` (Gemini Pro), `MedicalGPT` (>1000 Stars) |
| **Mit Ollama machbar?** | ✅ `llama3.1:8b` + guter System-Prompt + kontextuelles Gespräch (seit wann? Schmerzskala 1-10? Begleitsymptome?) |
| **Privacy?** | ✅ Ollama läuft auf eigenem Server – keine Daten an Cloud-Drittanbieter |
| **Rechtlich?** | ⚠️ **Keine medizinische Diagnose** – nur Orientierungshilfe mit Haftungsausschluss |
| **Umsetzung** | `promptService.ts` → adaptives Gespräch + Triage + Arzt-Empfehlung |

### 2. Triage-Stufen (112 / 116117 / Routine)

| Aspekt | Bewertung |
|--------|-----------|
| **Wissenschaftlich?** | ✅ `TriageBench` (Open-Source-Benchmark) für medizinische LLM-Triage. Manchester Triage System (MTS) als klinischer Standard |
| **Open Source?** | ✅ `MedPrompt-Triage-Assistant` (GitHub) – LLM-basierte Triage-Klassifikation |
| **Risiko?** | 🔴 **Haftungskritisch** – Falsche Triage (AI sagt "kein Notfall", User stirbt) → Betreiber haftet |
| **Lösung** | Disclaimer + "Im Zweifel 112" + Never-allein-Entscheidung (AI schlägt vor, User entscheidet) |
| **Umsetzung** | Keywords + Ollama-Rating (1-10) + klare Handlungsempfehlung |

### 3. RAG mit DEGAM-Leitlinien

| Aspekt | Bewertung |
|--------|-----------|
| **DEGAM-Verfügbarkeit** | ❌ **Nur als PDF** – keine maschinenlesbaren XML/JSON-Leitlinien |
| **AWMF-Leitlinien** | ⚠️ ~500 Leitlinien, meist PDF, einige HTML. **Kein offener API-Zugang** |
| **RAG technisch?** | ✅ PDF → Text → Chunking → Vektordatenbank (Qdrant/Chroma). Aufwand: ~50h für alle DEGAM-Leitlinien |
| **Lizenzproblem** | ⚠️ DEGAM/AWMF-Inhalte sind urheberrechtlich geschützt – nicht frei in Vektordatenbank kopierbar |
| **Priorität** | 🥈 **Phase 2** – nach Basisfunktionen |

### 4. Medizinisches LLM via Ollama

| Aspekt | Bewertung |
|--------|-----------|
| **Auf Render?** | ❌ Render Free/Pro (max 2.5GB RAM) – zu wenig für 7B-Modelle |
| **Auf eigenem Server?** | ✅ `llama3.1:8b` läuft auf 158.180.18.110:11434 |
| **Medizinische Modelle?** | ⚠️ Meditron-7B, Med42-v2, BioMistral-7B auf HuggingFace. Aber: zu groß für parallelen Betrieb neben llama3.1 (16GB RAM). Med42-v2 ist Llama-3-8B-basiert und unterstützt Deutsch |
| **Empfehlung** | `llama3.1:8b` + medizinischer System-Prompt > separates medizinisches Modell (Ressourcen-Gründe) |

### 5. Geolokation + Overpass (Arztsuche)

| Aspekt | Bewertung |
|--------|-----------|
| **Status** | ✅ **Bereits implementiert** in `healthService.ts` – Overpass API für Echtzeit-Arztsuche |
| **DB-Statik** | ❌ **Keine DB-Abhängigkeit** – Overpass ist live (immer aktuell) |
| **AI-Matching** | ✅ Neu: Symptom → Fachrichtung → Overpass-Arzt-Matching |
| **Umsetzung** | `promptService.ts:buildHealthPrompt()` → `fetchHealthData()` (Rohdaten statt Fertigtext) |

### 6. SMART Scheduling / FHIR-Terminbuchung

| Aspekt | Bewertung |
|--------|-----------|
| **FHIR-Open-Source?** | ✅ HAPI FHIR, Kodjin FHIR, Open Reception (BMBF-Projekt!) |
| **Deutsche Praxen?** | ❌ **Keine offene FHIR-Schnittstelle** – CGM/medatixx-PVS sind proprietär |
| **116117-API?** | ❌ **Keine öffentliche API** – nur über Telematikinfrastruktur (TI) |
| **Open Reception?** | ✅ BMBF-gefördert, Open Source, E2E-Verschlüsselung – Zukunftspotential |
| **Realistisch?** | 🥉 **Langfrist-Vision** – nicht heute umsetzbar ohne Praxis-Partnerschaften |

### 7. Privacy-by-Design + On-Device NLP

| Aspekt | Bewertung |
|--------|-----------|
| **On-Device TFLite?** | ✅ MobileBERT/DistilBERT als `.tflite` (15-60MB) – Symptom-Klassifikation, Keyword-Detection, Notfall-Erkennung |
| **Nicht on-device?** | ❌ Komplexes medizinisches Reasoning – braucht Backend-Ollama |
| **DSGVO-konform?** | ✅ Art. 9 DSGVO (Gesundheitsdaten) → On-Device für sensible Daten, Backend nur für anonymisierte Anfragen |
| **Architektur** | Hybrid: einfache Tasks on-device (TFLite) + komplexe Tasks Backend (Ollama) |

---

## 🎯 Priorisierte AI-Phasen

### 🟢 Phase AI-Health-1: Symptom-Assessment + Triage + Arztsuche (JETZT)
- Adaptives Gespräch via Ollama (seit wann? Schmerzskala? Begleitsymptome?)
- Triage: Notfall (112) / Bereitschaftsdienst (116117) / Routinetermin
- Overpass-Arztsuche: Symptom → Fachrichtung → passender Arzt in der Nähe
- **Haftungsausschluss**: "Keine medizinische Diagnose. Dies ist eine KI-basierte Orientierungshilfe ohne Gewähr. Bei akuten Beschwerden wählen Sie 112 oder den ärztlichen Bereitschaftsdienst 116117."
- **Lieferumfang**: `promptService.ts` + `ollamaService.ts` + `ai.ts`
- **Status: ✅ Fertig**

### 🟡 Phase AI-Health-2: "Lebenszeichen" - Adaptives Check-in
- Timer-basiert (keine Sensoren, kein Accelerometer-Tracking)
- AI passt Check-in-Frequenz an Gesundheitszustand an (bei Symptom-Meldung verkürzt)
- Eskalationskette: Push → Notfallkontakt → 112 (nur bei vorherigen Symptomen)
- **Privacy-first**: nichts läuft im Hintergrund, User aktiviert bewusst
- **Status: ⏳ Geplant**

### 🟢 Phase AI-Health-3: On-Device TFLite Klassifikation
- TFLite MobileBERT (15-60MB) on-device für Notfall-Keyword-Erkennung
- Nur bei LOCAL-Notfall → sofort 112, sonst Backend-Anfrage
- **Status: ✅ Phase AI-5 fertig** (OnDeviceSentimentClassifier)

### 🟢 Phase AI-Health-4: Cross-Service AI Assistant
- Quervernetzung aller HEIMAT-Services (Gesundheit + Wetter + Mobilität)
- Service-Prompts für 8 Services in `promptService.ts`
- **Status: ✅ Phase AI-4 fertig**

### ⏳ Phase AI-Health-5: DEGAM-RAG + FHIR-Terminbuchung (Vision)
- PDF-Parsing + Vektordatenbank (Qdrant/Chroma)
- Faktenbasierte Antworten statt Halluzination
- **Blockiert durch:** DEGAM-Urheberrecht, Praxis-APIs fehlen

---

## Hybrid-Architektur: On-Device vs. Backend

| Kriterium | On-Device (TFLite) | Backend (Ollama) |
|-----------|-------------------|------------------|
| Modellgröße | 15-60 MB (MobileBERT) | ~4-8 GB (llama3.1:8b quantisiert) |
| Latenz | <10 ms | 500-2000 ms |
| Privacy | ✅ 100% lokal | ⚠️ Daten verlassen Gerät |
| Komplexität | Einfache Klassifikation | Komplexes Reasoning |
| Kosten | €0 | €5-10/Monat Server |

**Entscheidungsregel:** 
- **On-Device**: Symptom-Kategorie erkennen, Notfall-Keywords, einfache UI-Entscheidungen
- **Backend**: Adaptives Gespräch, Triage, Arzt-Empfehlung, RAG mit Leitlinien

---

## Erfolgskriterien

1. **Open-Source-Nutzung:** 100% der AI-Tools sind Open Source
2. **Datenschutz:** On-Device AI bevorzugt, keine personenbezogenen Daten in der Cloud
3. **Rechtliche Unbedenklichkeit:** Keine BaFin-Lizenz, keine DSGVO-Verstöße, klare Haftungsausschlüsse
4. **Wissenschaftlich fundiert:** Jede AI-Funktion basiert auf publizierter Forschung (keine Pseudowissenschaft)
5. **Kostenfreiheit:** Maximale Kosten <€100/Jahr (Hosting + Domain + Strom für Ollama)
