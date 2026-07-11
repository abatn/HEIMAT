# HEIMAT 2.0 – Förderantrag: BMWK KI-Innovationswettbewerb

## Antragstellung beim BMWK

### Überblick
- **Förderer:** Bundesministerium für Wirtschaft und Klimaschutz (BMWK)
- **Programm:** KI-Innovationswettbewerb / KMU-innovativ
- **Fördersumme:** Bis zu €100.000
- **Förderzeitraum:** 12 Monate
- **Anlaufstelle:** https://www.bmwk.de
- **Voraussetzung:** KI-Aspekt muss im Vordergrund stehen

---

## Antragsvorlage

### 1. Projekttitel
**HEIMAT 2.0 – KI-gestützte Open-Source Super App für den deutschen Alltag**

### 2. Kurzbeschreibung (500 Zeichen)
HEIMAT 2.0 integriert Künstliche Intelligenz in eine Open-Source Plattform für Mobilität, Finanzen und Gesundheit. On-Device AI (TensorFlow Lite, Vosk) stellt datenschutzkonforme Sprachsteuerung und personalisierte Dienste bereit. Das Projekt demonstriert, wie KI ohne kommerzielle Abhängigkeiten und DSGVO-konform implementiert werden kann.

### 3. KI-Aspekte

| KI-Komponente | Technologie | Anwendung |
|---------------|-------------|-----------|
| **Sprachsteuerung** | Vosk (On-Device) | Offline-Steuereingaben |
| **Textklassifikation** | TensorFlow Lite | Automatische Kategorisierung |
| **Verspätungsvorhersage** | LightGBM | ÖPNV-Prognose |
| **Recommender** | Surprise | Termin-Empfehlungen |
| **Code-Generierung** | Code Llama | Mini-App-Entwicklung |

### 4. Problemstellung
- **KI-Blackbox:** Kommerzielle KI-Anwendungen sind intransparent
- **Datenschutz:** KI-Nutzung erfordert oft Datenübertragung
- **Abhängigkeit:** Vendor Lock-in bei KI-Diensten
- **Kosten:** KI-Infrastruktur ist teuer

### 5. Lösungsansatz
- **On-Device AI:** KI-Modelle laufen lokal auf dem Gerät
- **Open Source:** Jeder kann die KI-Modelle prüfen und verändern
- **DSGVO-konform:** Privacy by Design für KI
- **Kostenfrei:** Keine Lizenzgebühren für KI-Tools

### 6. Technische Architektur

```
┌─────────────────────────────────────────────────────┐
│  HEIMAT 2.0 – KI-Architektur                        │
├─────────────────────────────────────────────────────┤
│  On-Device (Smartphone)                              │
│  ├── TensorFlow Lite (Textklassifikation)           │
│  ├── Vosk (Speech-to-Text)                          │
│  ├── Coqui TTS (Text-to-Speech)                     │
│  └── Lokale Modelle (kein Cloud-Zugriff)            │
├─────────────────────────────────────────────────────┤
│  Cloud (Hetzner, Deutschland)                        │
│  ├── MLflow (Modell-Management)                     │
│  ├── FastAPI (KI-Services)                          │
│  ├── LightGBM (Training)                            │
│  └── Redis (Modell-Cache)                           │
└─────────────────────────────────────────────────────┘
```

### 7. Zielgruppe
- **Endnutzer:** Deutsche Bürger, die KI-Dienste datenschutzkonform nutzen wollen
- **Entwickler:** KI-Entwickler, die Open-Source-Modelle beitragen
- **Unternehmen:** KMU, die KI-Integration ohne Abhängigkeiten suchen

### 8. Projektziele
| Ziel | Beschreibung |
|------|--------------|
| **KI-Sprachsteuerung** | Offline-fähige Sprachsteuerung für die App |
| **KI-Vorhersagen** | Verspätungsvorhersage und Termin-Empfehlungen |
| **Open-Source-KI** | Veröffentlichung aller KI-Modelle unter AGPL-3.0 |
| **DSGVO-Nachweis** | Dokumentation der DSGVO-Konformität für KI |

### 9. Zeitplan (12 Monate)

| Monat | Meilenstein |
|-------|-------------|
| **1-3** | KI-Infrastruktur aufbauen (MLflow, FastAPI) |
| **4-6** | On-Device AI implementieren (Vosk, TensorFlow Lite) |
| **7-9** | Cloud-KI entwickeln (LightGBM, Surprise) |
| **10-12** | Integration, Testing, Dokumentation |

### 10. Budget

| Posten | Kosten |
|--------|--------|
| **KI-Entwicklung** (1 FTE) | €50.000 |
| **GPU-Server** (12 Monate) | €600 |
| **Infrastruktur** (Hetzner) | €1.200 |
| **Tools** (MLflow, etc.) | €500 |
| **Gesamt** | **~€52.300** |

### 11. Innovation
- **On-Device KI:** Vollständig offline-fähig
- **Open-Source KI:** Kein proprietärer Lock-in
- **DSGVO für KI:** Referenzimplementierung
- **Community-KI:** Beiträge von ML-Entwicklern willkommen

### 12. Nachhaltigkeit
- **Community-getrieben** – KI-Modelle werden weiterentwickelt
- **Open Source** – Fork und Weiterentwicklung möglich
- **Niedrige Kosten** – GPU-Server nur für Training nötig
- **Standards** – Nutzung von Open-Source-KI-Standards

---

## Ausfüllhilfe

### KI-Projektbeschreibung (max. 10.000 Zeichen)
```
HEIMAT 2.0 integriert Künstliche Intelligenz in eine Open-Source 
Super App für den deutschen Alltag. Das Projekt zeigt, wie KI 
datenschutzkonform und ohne kommerzielle Abhängigkeiten 
implementiert werden kann.

KI-KOMPONENTEN:

1. On-Device AI (Smartphone):
   - Vosk für Offline-Spracherkennung
   - TensorFlow Lite für lokale Textklassifikation
   - Coqui TTS für Text-to-Speech
   - Vorteil: Keine Datenübertragung, volle Privatsphäre

2. Cloud-KI (Hetzner Cloud):
   - MLflow für Modellversionierung
   - FastAPI für KI-Services
   - LightGBM für Verspätungsvorhersage
   - Surprise für Recommender-Systeme

INNOVATION:
- Erste Open-Source Super App mit On-Device KI
- DSGVO-konforme KI-Implementierung
- Community-getriebene KI-Entwicklung
- Kein Vendor Lock-in

NUTZEN:
- Sprachsteuerung ohne Internet
- Personalisierte Dienste ohne Tracking
- KI für alle – kostenlos und transparent
- Referenzprojekt für DSGVO-konforme KI
```

---

## Nächste Schritte

1. **Antrag ausfüllen** (Vorlage nutzen)
2. **KI-Expertise nachweisen** (Team, Kooperationen)
3. **Budget kalkulieren**
4. **Deadline prüfen** (bmwk.de)
5. **Absenden**
