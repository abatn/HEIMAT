---
name: heimat-health-ai-ui-mockups
description: "UI-Mockups für den Health AI Agent — Wireframes, Flows, Komponenten. Nur Design, keine Implementierung."
---

# Health AI Agent — UI-Mockups

> **STATUS:** 📋 Design-Phase — Nur Wireframes, keine Implementierung!
> **Letzte Aktualisierung:** 2026-08-03

---

## 📱 Screen-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    HEALTH AI AGENT SCREENS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. HealthScreen (bestehend, erweitert)                          │
│     ├── AI Health Chat (collapsible)                             │
│     ├── Termin-Erinnerung Banner                                 │
│     ├── Lebenszeichen Status                                     │
│     ├── Specialty-Filter                                         │
│     └── Doctor-Liste                                             │
│                                                                  │
│  2. HealthChatScreen (NEU)                                       │
│     ├── Vollbild-Gespräch                                        │
│     ├── Gedächtnis-Historie                                      │
│     ├── Medikamenten-Schnellzugriff                              │
│     └── Triage-Ergebnis                                          │
│                                                                  │
│  3. MedicationsScreen (NEU)                                      │
│     ├── Meine Medikamente                                        │
│     ├── Interaktions-Check                                       │
│     └── Hinzufügen/Entfernen                                     │
│                                                                  │
│  4. HealthProfileScreen (NEU)                                    │
│     ├── Persönliche Daten                                        │
│     ├── Vorerkrankungen                                          │
│     ├── Allergien                                                │
│     ├── Familienanamnese                                         │
│     └── Präventions-Empfehlungen                                 │
│                                                                  │
│  5. MemoryScreen (NEU)                                           │
│     ├── Symptom-Zeitstrahl                                       │
│     ├── Chronische Muster                                        │
│     └── Gelöste Symptome                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. HealthScreen (ERWEITERT)

### Aktueller Stand
```
┌─────────────────────────────────┐
│ ≡  Gesundheit            🔍 ⚙️  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🤖 Health AI Assistent      │ │
│ │ Symptome erfragen · Triage  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📅 Termin in 2 Stunden      │ │
│ │ Dr. Schmidt · 14:00 Uhr     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ✅ Lebenszeichen: Aktiv     │ │
│ │ Stufe 0 · Alle 24h          │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Alle] [Hausarzt] [Zahn] [HNO] │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🩺 Dr. Anna Schmidt         │ │
│ │ Allgemeinmedizin             │ │
│ │ Hauptstraße 10, 10115 Berlin│ │
│ │                   [1.2 km]  │ │
│ │ [📞] [📧] [Termin buchen]   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🩺 Dr. Müller               │ │
│ │ Zahnarzt                     │ │
│ │ ...                          │ │
│ └─────────────────────────────┘ │
│                                 │
│                        [+] Arzt │
└─────────────────────────────────┘
```

### Erweiterter Stand (NEU)
```
┌─────────────────────────────────┐
│ ≡  Gesundheit            🔍 ⚙️  │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🤖 Health AI Assistent      │ │
│ │ Symptome erfragen · Triage  │ │
│ │                   [Öffnen →]│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📅 Termin in 2 Stunden      │ │
│ │ Dr. Schmidt · 14:00 Uhr     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ✅ Lebenszeichen: Aktiv     │ │
│ │ Stufe 0 · Alle 24h          │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💊 Meine Medikamente (3)    │ │
│ │ Aspirin · Ibuprofen · ...   │ │
│ │                   [Verwalten]│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📊 Symptom-Verlauf          │ │
│ │ Letzte 30 Tage: 5 Einträge  │ │
│ │ ⚠️ 2 chronische Muster      │ │
│ │                   [Ansehen →]│ │
│ └─────────────────────────────┘ │
│                                 │
│ [Alle] [Hausarzt] [Zahn] [HNO] │
│                                 │
│ 🩺 Dr. Anna Schmidt             │
│ ...                             │
│                                 │
│                        [+] Arzt │
└─────────────────────────────────┘
```

---

## 2. HealthChatScreen (NEU — Vollbild)

### Gesprächs-Flow

```
┌─────────────────────────────────┐
│ ←  Health AI Assistent    📋 ⚙️ │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⚠️  WICHTIG: Bei akuten     │ │
│ │ Beschwerden wählen Sie      │ │
│ │ immer die 112!              │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🤖 Hallo! Ich bin Ihr       │ │
│ │ Health AI Assistent.        │ │
│ │                             │ │
│ │ Was beschreibt Ihr Anliegen?│ │
│ └─────────────────────────────┘ │
│                                 │
│              ┌─────────────────┐│
│              │ Ich habe seit   ││
│              │ 3 Tagen         ││
│              │ Kopfschmerzen   ││
│              └─────────────────┘│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🤖 Ich verstehe. Wo genau   │ │
│ │ sind die Schmerzen?         │ │
│ │                             │ │
│ │ 📍 Stirn                    │ │
│ │ 📍 Schläfe (links/rechts)   │ │
│ │ 📍 Hinterkopf               │ │
│ │ 📍 Über den ganzen Kopf     │ │
│ └─────────────────────────────┘ │
│                                 │
│        [📍 Stirn] [📍 Schläfe]  │
│     [📍 Hinterkopf] [📍 Ganz]   │
│                                 │
│              ┌─────────────────┐│
│              │ Rechte Seite    ││
│              └─────────────────┘│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🤖 Danke. Haben Sie weitere │ │
│ │ Beschwerden?                │ │
│ │                             │ │
│ │ Mehrfachauswahl möglich:    │ │
│ │ ☐ Übelkeit                  │ │
│ │ ☐ Sehstörungen              │ │
│ │ ☐ Lichtempfindlichkeit      │ │
│ │ ☐ Fieber                    │ │
│ │ ☐ Nackensteifigkeit         │ │
│ │ ☐ Keine weiteren            │ │
│ └─────────────────────────────┘ │
│                                 │
│ [☑️ Übelkeit] [☑️ Licht] [...]  │
│                                 │
│              ┌─────────────────┐│
│              │ Ja, Übelkeit    ││
│              │ und Licht stört ││
│              └─────────────────┘│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🤖 Vielen Dank für die      │ │
│ │ Informationen.              │ │
│ │                             │ │
│ │ Basierend auf Ihren         │ │
│ │ Beschwerden:                │ │
│ │                             │ │
│ │ 🟡 BEREITSCHAFT             │ │
│ │                             │ │
│ │ Mögliche Ursachen:          │ │
│ │ • Migräne (60%)             │ │
│ │ • Spannungskopfschmerz (30%)│ │
│ │ • Cluster (10%)             │ │
│ │                             │ │
│ │ Empfohlene Fachrichtung:    │ │
│ │ 🩺 Neurologe                │ │
│ │                             │ │
│ │ Nächste Schritte:           │ │
│ │ 1. Beobachten Sie 2-3 Tage  │ │
│ │ 2. Bei Verschlechterung:    │ │
│ │    116117 anrufen           │ │
│ │ 3. Neurologe in Ihrer Nähe  │ │
│ │                             │ │
│ │ [Neurologen suchen]         │ │
│ │ [Termin buchen]             │ │
│ │ [In Gedächtnis speichern]   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📋 Zusammenfassung          │ │
│ │ • Symptom: Kopfschmerzen    │ │
│ │ • Dauer: 3 Tage             │ │
│ │ • Lokalisation: Rechts      │ │
│ │ • Begleitsymptome: Übelkeit │ │
│ │ • Triage: BEREITSCHAFT      │ │
│ │ • Fachrichtung: Neurologe   │ │
│ │                             │ │
│ │ ✅ In Gedächtnis gespeichert│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💡 Tipp: Führen Sie ein    │ │
│ │ Schmerztagebuch:            │ │
│ │ • Wann beginnen die         │ │
│ │   Schmerzen?                │ │
│ │ • Gibt es Auslöser?         │ │
│ │ • Hilft etwas dagegen?      │ │
│ └─────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│ [💊] [📋] [📷]                  │
│ ┌─────────────────────────────┐ │
│ │ Nachricht eingeben...    ➤  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Schnellaktionen (unter Chat)

```
┌─────────────────────────────────┐
│ [💊 Medikamente] [📋 Verlauf]   │
│ [📷 Foto] [📍 Standort]         │
└─────────────────────────────────┘
```

---

## 3. MedicationsScreen (NEU)

### Hauptansicht
```
┌─────────────────────────────────┐
│ ←  Meine Medikamente      ➕   │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Medikament suchen...     │ │
│ └─────────────────────────────┘ │
│                                 │
│ AKTIVE MEDIKAMENTE              │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💊 Aspirin                  │ │
│ │ ASS · 500mg · täglich       │ │
│ │ Seit: 15.01.2026            │ │
│ │ "Nur nach dem Essen"        │ │
│ │                    [✏️] [🗑️] │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💊 Ibuprofen                │ │
│ │ Ibuprofen · 400mg           │ │
│ │ Bei Bedarf                   │ │
│ │                    [✏️] [🗑️] │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💊 Ramipril                 │ │
│ │ Ramipril · 5mg · morgens    │ │
│ │ Seit: 01.03.2025            │ │
│ │                    [✏️] [🗑️] │ │
│ └─────────────────────────────┘ │
│                                 │
│ ⚠️ INTERAKTIONEN                │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⚠️ Aspirin + Ibuprofen      │ │
│ │                             │ │
│ │ ⛔ Schwerwiegend            │ │
│ │ Erhöhtes Blutungsrisiko     │ │
│ │                             │ │
│ │ Empfehlung:                 │ │
│ │ Vermeiden Sie die           │ │
│ │ Kombination. Sprechen Sie   │ │
│ │ mit Ihrem Arzt.             │ │
│ │                             │ │
│ │ [Mehr erfahren]             │ │
│ └─────────────────────────────┘ │
│                                 │
│ BEENDETE MEDIKAMENTE            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💊 Amoxicillin              │ │
│ │ Antibiotikum · 1g           │ │
│ │ Beendet: 15.02.2026         │ │
│ │ (3-Woche Kur)               │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### Hinzufügen-Dialog
```
┌─────────────────────────────────┐
│ ←  Medikament hinzufügen  💾   │
├─────────────────────────────────┤
│                                 │
│ Name *                          │
│ ┌─────────────────────────────┐ │
│ │ z.B. Aspirin                │ │
│ └─────────────────────────────┘ │
│                                 │
│ Wirkstoff                       │
│ ┌─────────────────────────────┐ │
│ │ z.B. ASS (Acetylsalicylsäure)│ │
│ └─────────────────────────────┘ │
│                                 │
│ Dosierung                       │
│ ┌─────────────────────────────┐ │
│ │ z.B. 500mg                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Einnahmefrequenz                │
│ [täglich ▼]                     │
│                                 │
│ Kategorie                       │
│ [Schmerzmittel ▼]               │
│                                 │
│ ☐ Rezeptpflichtig               │
│                                 │
│ Beginn-Datum                    │
│ ┌─────────────────────────────┐ │
│ │ 03.08.2026                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Notizen                         │
│ ┌─────────────────────────────┐ │
│ │ z.B. Nur nach dem Essen     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💾 Speichern                │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ℹ️ Nach dem Speichern wird  │ │
│ │ automatisch auf             │ │
│ │ Interaktionen geprüft.      │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### Interaktions-Check
```
┌─────────────────────────────────┐
│ ←  Interaktions-Check    🔄    │
├─────────────────────────────────┤
│                                 │
│ Welche Medikamente möchten      │
│ Sie vergleichen?                │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ☑️ Aspirin                  │ │
│ │ ☑️ Ibuprofen                │ │
│ │ ☐ Ramipril                  │ │
│ │ ☐ Paracetamol               │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Prüfen                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ERGEBNIS                        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⛔ 1 schwerwiegende         │ │
│ │    Interaktion gefunden     │ │
│ │                             │ │
│ │ Aspirin ↔ Ibuprofen        │ │
│ │                             │ │
│ │ ⚠️  Schweregrad: Schwer-    │ │
│ │    wiegend                  │ │
│ │                             │ │
│ │ 📝 Erhöhtes Blutungsrisiko │ │
│ │    durch kombinierte        │ │
│ │    Hemmung der              │ │
│ │    Thrombozytenfunktion.    │ │
│ │                             │ │
│ │ 💡 Empfehlung:              │ │
│ │ Vermeiden Sie die           │ │
│ │ Kombination. Nutzen Sie    │ │
│ │ entweder Aspirin ODER       │ │
│ │ Ibuprofen, nicht beide.    │ │
│ │ Sprechen Sie mit Ihrem     │ │
│ │ Arzt über Alternativen.    │ │
│ │                             │ │
│ │ [Ärzte in meiner Nähe]      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ✅ Keine weiteren Interaktionen │
│    zwischen anderen Medikamenten│
│                                 │
└─────────────────────────────────┘
```

---

## 4. HealthProfileScreen (NEU)

```
┌─────────────────────────────────┐
│ ←  Gesundheitsprofil      💾   │
├─────────────────────────────────┤
│                                 │
│ PERSÖNLICHE DATEN               │
│                                 │
│ Geburtsdatum                    │
│ ┌─────────────────────────────┐ │
│ │ 15.03.1974                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Geschlecht                      │
│ [männlich ▼]                    │
│                                 │
│ Gewicht (kg)                    │
│ ┌─────────────────────────────┐ │
│ │ 82                          │ │
│ └─────────────────────────────┘ │
│                                 │
│ Größe (cm)                      │
│ ┌─────────────────────────────┐ │
│ │ 178                         │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ RISIKOFAKTOREN                  │
│                                 │
│ ☑️ Raucher                      │
│ ☐ Schwanger                     │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ VORERKRANKUNGEN                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ☑️ Bluthochdruck            │ │
│ │ ☑️ Diabetes Typ 2           │ │
│ │ ☐ Asthma                    │ │
│ │ ☐ Herzinfarkt               │ │
│ │ ☐ Schlaganfall              │ │
│ │ + Eigene hinzufügen         │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ ALLERGIEN                       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ☑️ Penicillin               │ │
│ │ ☑️ Nüsse                    │ │
│ │ ☐ Pollen                    │ │
│ │ + Eigene hinzufügen         │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ FAMILIENANAMNESE                │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 👨 Vater: Herzinfarkt (58)  │ │
│ │ 👩 Mutter: Diabetes Typ 2   │ │
│ │ + Weiteres hinzufügen       │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ VERSICHERUNG                    │
│ [gesetzlich ▼]                  │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ PRÄFERENZEN                     │
│                                 │
│ Sprache                         │
│ [Deutsch ▼]                     │
│                                 │
│ Arzt-Präferenz                  │
│ [egal ▼]                        │
│                                 │
│ ☐ Barrierefreiheit benötigt     │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 💾 Profil speichern         │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 💡 PRÄVENTIONS-EMPFEHLUNGEN     │
│ (basierend auf Ihrem Profil)    │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🩺 Kardiologischer Check    │ │
│ │ 🔴 Hoch                     │ │
│ │ Alter 52, Raucher,          │ │
│ │ Familiäre Vorbelastung      │ │
│ │ Fällig: Dezember 2026       │ │
│ │ [Termin suchen]             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔬 Prostatavorsorge         │ │
│ │ 🟡 Mittel                   │ │
│ │ Ab 50 Jahren empfohlen      │ │
│ │ Fällig: März 2027           │ │
│ │ [Termin suchen]             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🫁 Lungenfunktion           │ │
│ │ 🟡 Mittel                   │ │
│ │ Raucher + Husten            │ │
│ │ Jährlich empfohlen          │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

---

## 5. MemoryScreen (NEU)

### Zeitstrahl-Ansicht
```
┌─────────────────────────────────┐
│ ←  Symptom-Verlauf       📊    │
├─────────────────────────────────┤
│                                 │
│ [Alle] [Aktiv] [Gelöst] [Chronisch]│
│                                 │
│ HEUTE                           │
│ ┌─────────────────────────────┐ │
│ │ 🟡 Kopfschmerzen            │ │
│ │ BEREITSCHAFT · 6/10          │ │
│ │ Seit 3 Tagen · Rechte Seite │ │
│ │ Begleit: Übelkeit, Licht    │ │
│ │ ICD: G43 (Migräne)          │ │
│ │                             │ │
│ │ [Details] [Ändern] [Löschen]│ │
│ └─────────────────────────────┘ │
│                                 │
│ GESTERN                         │
│ ┌─────────────────────────────┐ │
│ │ 🟢 Erkältung                │ │
│ │ ROUTINE · 3/10               │ │
│ │ Halsschmerzen, Schnupfen    │ │
│ │ Gelöst nach 5 Tagen         │ │
│ │                             │ │
│ │ [Details]                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ LETZTE WOCHE                    │
│ ┌─────────────────────────────┐ │
│ │ 🟡 Rückenschmerzen          │ │
│ │ ROUTINE · 5/10               │ │
│ │ LWS · 2 Wochen andauernd    │ │
│ │ ⚠️ Chronisches Muster       │ │
│ │                             │ │
│ │ [Details] [Ändern]          │ │
│ └─────────────────────────────┘ │
│                                 │
│ LETZTER MONAT                   │
│ ┌─────────────────────────────┐ │
│ │ 🟢 Kopfschmerzen            │ │
│ │ ROUTINE · 4/10               │ │
│ │ Einmalig · Spannung         │ │
│ │ Gelöst nach 1 Tag           │ │
│ │                             │ │
│ │ [Details]                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 📊 STATISTIKEN                  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Gesamte Einträge: 12        │ │
│ │ Aktive Symptome: 2          │ │
│ │ Gelöste Symptome: 10        │ │
│ │                             │ │
│ │ Häufigste Kategorien:       │ │
│ │ 1. Kopfschmerzen (4x)       │ │
│ │ 2. Rückenschmerzen (3x)     │ │
│ │ 3. Erkältung (2x)           │ │
│ │                             │ │
│ │ ⚠️ Chronische Muster:       │ │
│ │ • Kopfschmerzen >14 Tage    │ │
│ │ • Rückenschmerzen >21 Tage  │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

---

## 🎨 Design-Spezifikationen

### Farben

| Element | Farbe | Hex |
|---------|-------|-----|
| NOTFALL | Rot | `#FF5252` |
| BEREITSCHAFT | Orange | `#FFB74D` |
| ROUTINE | Grün | `#66BB6A` |
| Chronisch | Gelb | `#FFCA28` |
| Gelöst | Grau | `#9E9E9E` |
| Primary | Blau | `#2196F3` |

### Typografie

| Element | Größe | Gewicht |
|---------|-------|---------|
| Screen-Titel | 24sp | Bold |
| Section-Header | 16sp | SemiBold |
| Body | 14sp | Regular |
| Caption | 12sp | Regular |
| Triage-Level | 18sp | Bold |

### Icons

| Symbol | Bedeutung |
|--------|-----------|
| 🤖 | AI Assistent |
| 💊 | Medikament |
| 📋 | Gedächtnis/Verlauf |
| 📷 | Foto |
| 🩺 | Arzt |
| ⚠️ | Warnung |
| ⛔ | Schwerwiegend |
| ✅ | Erledigt/Gelöst |
| 🔴 | Hoch prior |
| 🟡 | Mittel prior |
| 🟢 | Niedrig prior |

---

## 📱 Navigation

```
Bottom Tab Bar:
┌─────────────────────────────────┐
│ [🏠] [🚇] [💰] [🏥] [📱]        │
│ Home  Mob  Fin  Health  Apps    │
└─────────────────────────────────┘

Health Tab → HealthScreen:
┌─────────────────────────────────┐
│ [🤖 AI Chat] [📋 Verlauf]       │
│ [💊 Medikamente] [👤 Profil]    │
└─────────────────────────────────┘
```

---

*Erstellt: 2026-08-03*
*Status: Design-Phase — Nur Wireframes, keine Implementierung!*
