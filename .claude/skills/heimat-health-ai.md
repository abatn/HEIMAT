---
name: heimat-health-ai
description: "Health AI Agent Architektur für HEIMAT. Ollama + WHO ICD-11 + Gedächtnis + Differentialdiagnose. Diskussion-basiert, keine Code-Änderungen ohne Absprache."
---

# HEIMAT Health AI Agent — Erweiterte Architektur

> **STATUS:** 📋 Diskussionsphase — KEINE Code-Änderungen ohne explizite Freigabe!
> **Letzte Aktualisierung:** 2026-08-03

## 🎯 Vision

Ein intelligenter Health AI Agent, der:
- **Gespräche führt** (nicht nur Keywords matcht)
- **Differentialdiagnosen** liefert (nicht nur eine Antwort)
- **Gedächtnis hat** (Symptom-Verlauf über Tage/Wochen)
- **Kontext versteht** (Uhrzeit, Alter, Vorerkrankungen, Saison)
- **Prävention** empfiehlt (nicht nur akute Behandlung)

## 📋 Features (nach User-Freigabe)

| # | Feature | Priorität | Phase | Status |
|---|---------|-----------|-------|--------|
| 1 | **Gedächtnis** — Symptome über Tage/Wochen speichern | 🔴 Muss | Phase 1 | ✅ Backend + DTOs + Provider |
| 2 | **Voice-Input** — Spracheingabe für Symptome | 🔴 Muss | Phase 1 | 📋 Geplant |
| 3 | **Foto-Analyse** — Hautausschlag, Rötung fotografieren | 🟡 Nice-to-have | Nach Anfrage | 📋 Geplant |
| 4 | **Medikamente** — User gibt Medikamente ein → Interaktionscheck | 🔴 Muss | Phase 1 | ✅ Backend + DTOs + Provider |
| 5 | **Mental Health** — Depressions-Screening einbauen | 🔴 Muss | Phase 2 | 📋 Geplant |
| 6 | **Prävention** — Alters-/Risiko-basierte Vorsorge | 🔴 Muss | Phase 2 | 📋 Geplant |
| 7 | **Nachsorge** — Post-Termin-Follow-up | 🔴 Muss | Phase 2 | 📋 Geplant |
| 8 | **Notfall-Kontext** — Uhrzeit/Allein-sein berücksichtigen | 🔴 Muss | Phase 1 | 📋 Geplant |

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    HEIMAT Health AI Agent                        │
├─────────────────────────────────────────────────────────────────┤
│  INPUT                                                          │
│  ├── Text (Chat)                                                │
│  ├── Voice (Speech-to-Text) — Phase 1                           │
│  ├── Foto (Hautausschlag) — Nach Anfrage                        │
│  └── Kontext (GPS, Uhrzeit, Profil, Verlauf)                   │
├─────────────────────────────────────────────────────────────────┤
│  OLLAMA GESPRÄCHS-MANAGER                                       │
│  ├── Multi-Turn Dialogue (Gedächtnis)                           │
│  ├── Nachfragen-Engine (Wo? Seit wann? Begleitsymptome?)        │
│  ├── Differentialdiagnose (nicht nur eine Antwort)              │
│  └── Kontext-Switch (Notfall? Routine? Prävention?)            │
├─────────────────────────────────────────────────────────────────┤
│  WHO ICD-11 VALIDIERUNG                                         │
│  ├── Symptom → ICD-Code Mapping                                 │
│  ├── ICD-Code → Fachrichtung Mapping                            │
│  ├── ICD-Code → Schweregrad (NOTFALL/BEREITSCHAFT/ROUTINE)     │
│  └── Differentialdiagnose (mehrere ICD-Codes möglich)          │
├─────────────────────────────────────────────────────────────────┤
│  INTELLIGENZ-SCHICHT                                            │
│  ├── Gedächtnis (Symptom-Verlauf über Zeit)                     │
│  ├── Profil-Awareness (Alter, Geschlecht, Risiken)              │
│  ├── Saisonale Awareness (Pollen, Grippe-Season)                │
│  ├── Medikamenten-Interaktion                                   │
│  └── Notfall-Kontext (Uhrzeit, Allein-sein, Vorerkrankungen)   │
├─────────────────────────────────────────────────────────────────┤
│  OUTPUT                                                         │
│  ├── Triage-Level (mit Konfidenz-Score)                         │
│  ├── Differentialdiagnose (Top 3 Möglichkeiten)                 │
│  ├── Empfohlene Fachrichtung (+ Grund)                          │
│  ├── Nächste Schritte (112? Hausarzt? Abwarten?)                │
│  ├── Arzt-Empfehlung (mit Kontakt)                              │
│  └── Präventionstipps (wenn zutreffend)                         │
└─────────────────────────────────────────────────────────────────┘
```

## 💡 Innovative Features

### 1. Intelligentes Gespräch mit Gedächtnis

```
Tag 1: "Ich habe seit 3 Tagen Kopfschmerzen"
        → Ollama: "Wo genau? Begleitsymptome?" 
        → Ergebnis: Spannungskopfschmerz, Hausarzt

Tag 7: "Die Kopfschmerzen sind jetzt seit einer Woche da"
        → Ollama erinnert sich: "Letzte Woche Spannungskopfschmerz. 
           Hat sich etwas verändert?"
        → Erkennt: Chronisch → neurologische Abklärung empfohlen
```

### 2. Differentialdiagnose mit Konfidenz

```
User: "Brustschmerzen, Atemnot, Schwitzen"
  ↓
Ollama + ICD-11:
  - 85%: Akutes Koronarsyndrom (I21) → NOTFALL 112
  - 10%: Lungenembolie (I26) → NOTFALL
  - 5%: Panikattacke (F41) → BEREITSCHAFT
  
→ App: "Basierend auf Ihren Beschwerden gibt es mehrere Möglichkeiten. 
        WICHTIG: Bei Brustschmerzen + Atemnot → sofort 112!"
```

### 3. Kontext-Aware Triage

```
User: "Mir ist schwindelig"
  ↓
Context (automatisch erkannt):
  - Uhrzeit: 03:00 Uhr nachts
  - Allein zu Hause
  - Kein Partner erreichbar
  - Letzter Check-in: gestern
  
→ Ollama: "Schwindel um 3 Uhr nachts allein → höheres Risiko.
           Rufen Sie den Notarzt (112) oder einen Nachbarn an."
```

### 4. Präventive Gesundheit

```
User-Profil: 
  - Alter: 52
  - Geschlecht: männlich
  - Raucher: ja
  - Familiäre Vorbelastung: Herzinfarkt (Vater mit 58)
  ↓
Ollama: "Basierend auf Ihrem Profil empfehle ich:
         1. Jahrescheck beim Kardiologen
         2. Blutdruck-Messung (App kann helfen!)
         3. Rauchentwett-Programm?
         4. Nächster Termin: Prostatavorsorge (ab 50)"
```

### 5. Medikamenten-Interaktion

```
User: "Ich nehme Aspirin und Ibuprofen"
  ↓
Ollama: "ACHTUNG: Aspirin + Ibuprofen zusammen können 
         Magenblutungen verursachen. Sprechen Sie mit Ihrem Arzt."
  ↓
+ WHO ICD: Mögliche Wechselwirkung documented
```

### 6. Saisonale & Umwelt-Awareness

```
User: "Ich habe gereizte Augen und niesen"
  ↓
Context: April, Pollenflug-Hochphase, Berlin
  ↓
Ollama: "Im April ist Heuschnupfen-Hochphase. 
         Typische Symptome: gereizte Augen, Niesen, Schnupfen.
         Tipp: Antihistaminika aus der Apotheke, Pollenflug-App nutzen."
```

### 7. Notfall-Erkennung mit Kontext

```
Szenario A: User(25, w) "Ich habe starke Bauchschmerzen"
  → Allein, nachts, keine Vorerkrankungen
  → BEREITSCHAFT: "Beobachten Sie die Schmerzen. 
                   Bei Verschlechterung → 112"

Szenario B: User(78, m) "Ich habe starke Bauchschmerzen"
  → Allein, nachts, Diabetes, Blutverdünner
  → NOTFALL: "Bei Ihrem Alter und Medikamenten → sofort 112!
             Möglicherweise Blinddarm oder Herzinfarkt."
```

### 8. Arzt-Matching intelligent

```
User: "Ich brauche einen Neurologen"
  ↓
Ollama fragt:
  - "Haben Sie eine Karte (gesetzlich/privat)?"
  - "Bevorzugen Sie männlich/weiblich?"
  - "Ist Barrierefreiheit wichtig?"
  - "Sprechen Sie auch Englisch/Türkisch?"
  ↓
Suche: Neurologe + Kassenarzt + weiblich + rollstuhlgerecht + Englisch
```

### 9. Nachsorge-Loop

```
Tag 1: Termin beim Orthopäden
Tag 3: App fragt: "Wie geht es Ihnen nach dem Termin?"
  ↓
User: "Besser, aber immer noch Schmerzen"
  ↓
Ollama: "Gut dass es besser geht. Bei anhaltenden Schmerzen 
         nach 7 Tagen → bitten Sie um Kontrolltermin."
  ↓
+ Speichert für zukünftige Referenz
```

### 10. Mentale Gesundheit screening

```
User: "Ich schlafe schlecht, habe keine Energie, Interesse verloren"
  ↓
Ollama: "Diese Symptome können auf eine depressive Episode hindeuten.
         Wichtig: Das ist NICHT Ihre Schuld und behandelbar.
         
         Möchten Sie:
         1. Psychologischen Therapeuten suchen?
         2. Telefonseelsorge anrufen (0800 111 0 111)?
         3. Erst zum Hausarzt?"
```

## 🔧 Technische Architektur

### Komponenten

| Komponente | Technologie | Zweck |
|------------|-------------|-------|
| **Gesprächs-Manager** | Ollama (qwen2.5:3b) | Multi-Turn Dialogue |
| **ICD-Validierung** | WHO ICD-API v2 (OAuth2) | Symptom → ICD-Code |
| **Triage-Regeln** | Deterministische Rules | NOTFALL/BEREITSCHAFT/ROUTINE |
| **Gedächtnis** | PostgreSQL + Redis | Symptom-Verlauf |
| **Profil** | PostgreSQL | Alter, Geschlecht, Risiken |
| **Medikamente** | PostgreSQL + Drug-DB | Interaktionscheck |
| **Voice** | Web Speech API (Phase 1) | Spracheingabe |

### Datenfluss

```
User Input (Text/Voice)
    ↓
Gesprächs-Manager (Ollama)
    ├── Nachfragen stellen
    ├── Kontext sammeln
    └── Differentialdiagnose vorschlagen
    ↓
WHO ICD-11 Validierung
    ├── ICD-Code bestätigen
    └── Schweregrad bestimmen
    ↓
Intelligenz-Schicht
    ├── Gedächtnis (Verlauf)
    ├── Profil (Alter/Risiken)
    ├── Medikamente (Interaktion)
    └── Notfall-Kontext
    ↓
Output
    ├── Triage-Level + Konfidenz
    ├── Differentialdiagnose (Top 3)
    ├── Fachrichtung + Arzt
    └── Präventionstipps
```

## 📊 Real-Life Szenarien

| Szenario | Konventionell (HEUTE) | Innovativ (ZIEL) |
|----------|----------------------|------------------|
| **Mutter(35) mit krankem Kind(4)** | "Gehen Sie zum Kinderarzt" | "Fieber über 39°C bei Kind → beobachten. Bei Krämpfen sofort 112. Kinderarzt: morgen 8 Uhr frei." |
| **Rentner(78) mit Schwindel** | "Hausarzt" | "Schwindel + Alter 78 + Blutdruckmedikamente → mögliche Hypotonie. Heute noch Arzt aufsuchen!" |
| **Student(22) mit Bauchschmerzen** | "Gastroenteritis" | "Stress + schlechte Ernährung + Bauchschmerzen → Reizdarm? Tipp: Ernährungsstagebuch führen." |
| **Berlinerin(45) mit Hautausschlag** | "Hautarzt" | "Hautausschlag + April + Pollen → möglicherweise Kontaktallergie. Foto-Tipp: Rötung dokumentieren." |
| **Nacht(3 Uhr) + Brustschmerzen** | "Hausarzt morgen" | "NOTFALL: Brustschmerzen nachts → Herzkreislauf-Event ausschließen. JETZT 112 rufen!" |

## ⚠️ Wichtige Regeln

1. **KEINE Pseudowissenschaft** — Jede Funktion muss auf publizierter Forschung basieren
2. **KEINE kommerziellen AI-APIs** — Nur Open Source (Ollama, TFLite)
3. **Haftungsausschluss** — "Keine medizinische Diagnose. Bei Unsicherheit 112."
4. **Privacy-first** — On-Device für sensible Tasks, Backend nur anonymisiert
5. **Diskussion vor Code** — Änderungen nur nach expliziter Freigabe

## 📅 Phasen

| Phase | Features | Tage | Status |
|-------|----------|------|--------|
| **Phase 1** | Gedächtnis, Voice-Input, Medikamente, Notfall-Kontext | 5-7 | 📋 Geplant |
| **Phase 2** | Mental Health, Prävention, Nachsorge | 5-7 | 📋 Geplant |
| **Phase 3** | Foto-Analyse, Erweiterte Differentialdiagnose | 3-5 | 📋 Geplant |

## 🎨 UI-Mockups

**Skill-Datei:** `.claude/skills/heimat-health-ai-ui-mockups.md`

Enthält:
- Wireframes für alle 5 Screens (HealthScreen, HealthChatScreen, MedicationsScreen, HealthProfileScreen, MemoryScreen)
- Gesprächs-Flow mit Triage-Ergebnis
- Design-Spezifikationen (Farben, Typografie, Icons)
- Navigation-Struktur

## 🗄️ Datenbank-Migration

**Datei:** `src/backend/src/database/migrations/001_health_ai_agent.sql`

Enthält:
- `health_memory` — Symptom-Verlauf (Gedächtnis)
- `user_medications` — Medikamentenliste
- `medication_interactions` — Bekannte Interaktionen (Referenz)
- `user_health_profile` — Gesundheitsprofil
- Seed-Daten für Interaktionen (ASS+Ibuprofen, Marcumar+ASS, etc.)

## 📚 Forschungsquellen

| Quelle | Relevanz | Status |
|--------|----------|--------|
| WHO ICD-API v2 | Symptom → ICD-11 Mapping | ✅ Integriert |
| TriageBench | Open-Source Triage-Benchmark | 📋 Zu evaluieren |
| Ada Health (JAMA 2021) | 70-85% Übereinstimmung | 📋 Referenz |
| DEGAM Leitlinien | Deutsche Gesellschaft für Allgemeinmedizin | 📋 RAG-Quelle |
| Ollama + qwen2.5:3b | Lokales LLM | ✅ Integriert |

## 🔄 Nächste Schritte

1. **Diskussion abschließen** — User bestätigt Architektur
2. **Detailliertes Design** — API-Schemas, DB-Tabellen, UI-Mockups
3. **Proof of Concept** — Einzelne Features testen
4. **Phasenweise Implementierung** — Phase 1 → Phase 2 → Phase 3

---

*Erstellt: 2026-08-03*
*Status: Diskussionsphase — KEINE Code-Änderungen ohne Freigabe!*
