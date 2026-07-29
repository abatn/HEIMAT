# HEIMAT 2.0 – AI-Rechtliches

## DSGVO-konforme AI-Strategie

### Gesetzliche Grundlagen

| DSGVO-Artikel | Thema | Anwendung auf HEIMAT AI |
|---------------|-------|-------------------------|
| **Art. 5(1)(c)** | Datenminimierung | On-Device AI: Daten verlassen das Gerät nicht |
| **Art. 4(5)** | Anonymisierung | Keine personenbezogenen Daten in Cloud-Modellen |
| **Art. 13(2)(f)** | Transparenz | Open-Source-Modelle, jeder kann den Code prüfen |
| **Art. 7** | Einwilligung | Opt-in für AI-Funktionen erforderlich |
| **Art. 17** | Recht auf Löschung | AI-Daten werden mit Nutzerdaten gelöscht |
| **Art. 22** | Automatisierte Entscheidungen | Keine rechtlich bindenden Entscheidungen durch AI |

---

## Rechtliche Prüfung nach Bereich

### 1. Mobilität (Verspätungsvorhersage)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** – keine Finanzdienstleistung |
| Brauche ich eine TI-Anbindung? | **Nein** – keine Patientendaten |
| Brauche ich eine Datenschutz-Folgenabschätzung? | **Nein** – keine besonderen Kategorien |
| Brauche ich einen Haftungsausschluss? | **Ja** – "Verspätungsvorhersage ist kein Ersatz für aktuelle Informationen" |

**Haftungsausschluss:**
> "Die Verspätungsvorhersage basiert auf historischen Daten und ist nicht garantiert. Bitte prüfen Sie aktuelle Informationen beim jeweiligen Verkehrsverbund."

---

### 2. Finanzen (Ausgabenkategorisierung)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** – keine Finanzdienstleistung, nur Kategorisierung |
| Brauche ich eine DSGVO-Folgenabschätzung? | **Nein** – keine besonderen Kategorien |
| Brauche ich einen Haftungsausschluss? | **Ja** – "Keine Finanzberatung" |

**Haftungsausschluss:**
> "Diese Funktion dient ausschließlich der Kategorisierung und ersetzt keine professionelle Finanzberatung. Alle Entscheidungen treffen Sie eigenverantwortlich."

---

### 3. Gesundheit (Symptom-Assessment + Triage + Arztsuche) — Health AI Agent

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** – keine Finanzdienstleistung |
| Brauche ich eine TI-Anbindung? | **Nein** – keine Patientendaten, keine ePA-Anbindung |
| Brauche ich eine DSGVO-Folgenabschätzung? | **Nein** – keine besonderen Kategorien (User gibt freiwillig Symptome an) |
| Ist das ein Medizinprodukt? | **Nein** – Orientierungshilfe, keine Diagnose, keine Behandlung |
| Brauche ich einen Haftungsausschluss? | **Ja** – **zwingend erforderlich** |
| Brauche ich eine CE-Kennzeichnung? | **Nein** – keine klinische Entscheidungsunterstützung (EU MDR Art. 2) |
| Darf ich Gesundheitsdaten verarbeiten? | **Ja** – Art. 9(2)(a) DSGVO (ausdrückliche Einwilligung) |

**Haftungsausschluss (muss IMMER eingeblendet werden):**
> **WICHTIGER HINWEIS:** Dies ist eine KI-basierte **Orientierungshilfe** — keine medizinische Diagnose, keine ärztliche Beratung, keine Behandlung. Die Antworten basieren auf einem allgemeinen Sprachmodell (Ollama) und nicht auf einer individuellen medizinischen Untersuchung.
>
> **Bei akuten Beschwerden, Brustschmerz, Atemnot, Lähmungserscheinungen oder anderen Notfällen wählen Sie SOFORT 112 oder suchen Sie die nächste Notaufnahme auf.**
>
> **Bei dringenden, aber nicht lebensbedrohlichen Beschwerden wählen Sie den ärztlichen Bereitschaftsdienst unter 116117.**
>
> Die angezeigten Ärzte basieren auf OpenStreetMap-Daten (Overpass API, ODbL) und können Fehler enthalten. Bitte prüfen Sie die Erreichbarkeit und Qualifikation vor einem Besuch.

**Zusätzliche Maßnahmen:**
- 🔴 **Notfall-Keywords** (Brustschmerz, Schlaganfall, Atemnot) → sofort 112-Empfehlung, keine AI-Konversation
- 🟡 **Triage-Stufen** → AI schlägt vor, User entscheidet (nie automatisierte Entscheidung)
- ✅ **Arzt-Empfehlung** → basiert auf Overpass-Echtzeitdaten, keinem statischen DB-Listing
- 📋 **Privacy:** Symptom-Daten verlassen das Gerät NUR für die Chat-Anfrage (keine Speicherung)

**Lebenszeichen (Phase AI-Health-2, geplant):**
- Timer-basiert, **KEIN Accelerometer, KEIN GPS-Tracking**
- User aktiviert bewusst (Opt-in)
- Eskalation: Push → Notfallkontakt → 112
- Bei Gesundheits-Kontext: adaptive Timer-Verkürzung

---

### 4. Alltag (Sprachsteuerung)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** |
| Brauche ich eine DSGVO-Folgenabschätzung? | **Nein** – keine besonderen Kategorien |
| Brauche ich einen Haftungsausschluss? | **Nein** – allgemeine Funktion |

**Datenschutz:**
- Sprachdaten werden lokal verarbeitet (Vosk)
- Keine Übertragung an externe Server
- Sofortige Löschung nach Verarbeitung

---

### 5. Entwicklung (Code-Generierung)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** |
| Brauche ich eine DSGVO-Folgenabschätzung? | **Nein** |
| Brauche ich einen Haftungsausschluss? | **Ja** – "Keine Garantie für Code-Qualität" |

**Haftungsausschluss:**
> "Generierter Code dient als Vorschlag und wurde nicht vollständig geprüft. Bitte überprüfen und testen Sie den Code vor der Verwendung."

---

## Opt-in Mechanismus

Für jede AI-Funktion:
1. **Explizite Einwilligung** (Art. 7 DSGVO)
2. **Klare Beschreibung** der Funktion
3. **Hinweis** auf Datenverarbeitung
4. **Möglichkeit** der Deaktivierung jederzeit

```dart
// Beispiel: Opt-in Dialog
 showDialog(
   context: context,
   builder: (context) => AlertDialog(
     title: Text('KI-Funktion aktivieren'),
     content: Text(
       'Möchten Sie die Sprachsteuerung aktivieren? '
       'Sprachdaten werden lokal verarbeitet und nicht übertragen.'
     ),
     actions: [
       TextButton(
         onPressed: () => Navigator.pop(context),
         child: Text('Ablehnen'),
       ),
       ElevatedButton(
         onPressed: () {
           // AI-Funktion aktivieren
           Navigator.pop(context);
         },
         child: Text('Aktivieren'),
       ),
     ],
   ),
 );
```

---

## Löschkonzept

| Datenart | Speicherort | Löschung |
|----------|-------------|----------|
| Sprachdaten | Lokal (RAM) | Sofort nach Verarbeitung |
| Klassifikationsergebnisse | Lokal (SQLite) | Mit Nutzerdaten |
| ML-Modelle (On-Device) | Lokal (App) | Bei Deinstallation |
| Cloud-Logs | Hetzner | Nach 30 Tagen |

---

## Kontakt für Datenschutzfragen

Für DSGVO-Anfragen:
- E-Mail: datenschutz@heimat-app.de
- Matrix: #heimat-datenschutz:matrix.org
