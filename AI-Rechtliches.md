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

### 3. Gesundheit (Symptom-Checker)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** – keine Finanzdienstleistung |
| Brauche ich eine TI-Anbindung? | **Nein** – keine Patientendaten |
| Brauche ich eine DSGVO-Folgenabschätzung? | **Nein** – keine besonderen Kategorien |
| Brauche ich einen Haftungsausschluss? | **Ja** – "Keine medizinische Beratung" |

**Haftungsausschluss:**
> "Dieser Service ersetzt keine ärztliche Beratung. Bei akuten Beschwerden wenden Sie sich bitte umgehend an Ihren Arzt oder eine Notaufnahme."

**Zusätzliche Maßnahmen:**
- Klare Warnung in der UI
- Keine Diagnosen, nur allgemeine Informationen
- Verweis auf professionelle Hilfe

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
