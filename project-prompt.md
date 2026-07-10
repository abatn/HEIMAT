# 🏠 HEIMAT 2.0 – Open-Source Super App für Deutschland

## 📋 Überarbeiteter Projekt-Prompt für den KI-Agenten

---

### 🎯 **PROJEKT-TITEL**
**"HEIMAT 2.0 – Die erste Open-Source-Super-App für Deutschland"**

---

### 📌 **PROJEKTZIEL**

Entwicklung einer digitalen Plattform (Super App), die als zentrale Anlaufstelle für den deutschen Alltag dient. **HEIMAT 2.0 basiert ausschließlich auf Open-Source-Technologien und öffentlich zugänglichen Daten** – ohne Verträge mit Banken, ohne staatliche Genehmigungen, ohne kommerzielle Partner.

**Kernprinzipien:**
- **100% Open Source** – Jeder Code ist öffentlich einsehbar und veränderbar
- **100% Kostenfrei** – Keine Lizenzgebühren, keine Abos, keine versteckten Kosten
- **100% Legal** – Nutzung nur von Diensten, die rechtlich unbedenklich sind
- **100% Datenschutzkonform** – DSGVO als Feature, nicht als Hindernis
- **100% Community-getrieben** – Entwicklung durch Freiwillige, nicht durch Unternehmen

---

### 🧠 **AUFGABE FÜR DEN AGENTEN**

Du bist der leitende Projektstratege für HEIMAT 2.0. Deine Aufgabe ist es, einen **Open-Source-Umsetzungsplan** zu erstellen, der alle relevanten Aspekte abdeckt. 

**Die wichtigste Änderung:** Alle Services müssen **ohne Verträge, ohne Lizenzen, ohne Genehmigungen** auskommen.

---

## 🔍 **PHASE 1: MARKTANALYSE & POSITIONIERUNG (ÜBERARBEITET)**

1. **Wettbewerbsanalyse**
   - Analysiere bestehende **Open-Source-Lösungen** in den drei Kernbereichen:
     - **Mobilität:** OpenStreetMap, OpenRouteService, GTFS, OSCA-Mobilitätsmodule
     - **Finanzen:** GNU Taler, Lightning Network, Bitcoin (keine BaFin-Lizenz nötig für P2P)
     - **Gesundheit:** OpenMRS, FHIR-Open-Source-Tools (nur Terminverwaltung, keine TI-Anbindung)
   - Identifiziere:
     - Welche Open-Source-Lösungen existieren bereits?
     - Welche sind in Deutschland nutzbar (rechtlich und technisch)?
     - Welche Lücken gibt es noch?

2. **Zielgruppen-Definition (UNVERÄNDERT)**
   - Erstelle 3-4 detaillierte Nutzer-Personas (wie ursprünglich)
   - **Zusätzlich:** Definiere die "Entwickler-Persona" – wer wird zum Code beitragen?

3. **Positionierungs-Statement (NEU)**
   > "Für alle Deutschen, die eine datenschutzkonforme, kostenlose Alternative zu kommerziellen All-in-One-Apps suchen, bietet HEIMAT 2.0 eine Open-Source-Plattform für Mobilität, Finanzen und Gesundheit. Anders als WeChat oder Grab ist HEIMAT 2.0 vollständig transparent, community-getrieben und benötigt keine Verträge mit Banken oder Behörden."

---

## 🏗️ **PHASE 2: SERVICE-DEFINITION & PRIORISIERUNG (ÜBERARBEITET)**

4. **Service-Blaupausen (NEU)**

   **A) MOBILITÄT (Nur öffentliche Daten)**
   - **Datenquelle:** OpenStreetMap + GTFS-ÖPNV-Daten (öffentlich zugänglich)
   - **Routing:** OpenRouteService (Open Source) oder OSRM
   - **Ticketkauf:** Keine Integration – nur Anzeige von Fahrplänen (rechtlich unbedenklich)
   - **Partnerschaften:** Keine – nur öffentliche APIs
   - **UX-Flow:** Nutzer gibt Start/Ziel ein → App zeigt Verbindung an → Nutzer kauft Ticket extern

   **B) FINANZDIENSTLEISTUNGEN (Nur P2P)**
   - **Technologie:** GNU Taler oder Lightning Network (Open Source)
   - **Compliance:** Keine BaFin-Lizenz nötig für reine P2P-Überweisungen (kein Geldverwahrung)
   - **Partnerschaften:** Keine – dezentrales System
   - **UX-Flow:** Nutzer sendet Geld an Freund → Transaktion läuft über dezentrales Netzwerk

   **C) GESUNDHEIT (Nur Terminverwaltung)**
   - **Technologie:** OpenMRS oder einfaches Open-Source-Terminbuchungssystem
   - **Compliance:** Keine TI-Anbindung – nur Anzeige von Terminen, keine Patientendaten
   - **Partnerschaften:** Keine – Ärzte können sich manuell eintragen
   - **UX-Flow:** Nutzer sucht Arzt → App zeigt Verfügbarkeit → Nutzer bucht Termin (manuelle Bestätigung)

5. **Priorisierungs-Matrix (NEU)**
   - Bewerte alle Services nach:
     - **Nutzen für den Nutzer** (1-10)
     - **Technischer Aufwand** (1-10)
     - **Rechtliche Komplexität** (1-10) – **neu: 0 = keine rechtlichen Hürden**
     - **Open-Source-Verfügbarkeit** (1-10) – **neu: wie gut ist die Open-Source-Lösung?**
   - Empfehle die **Top 3 Services für den MVP-Start** (nur rechtlich unbedenkliche)

---

## 🛠️ **PHASE 3: TECHNOLOGIE & ARCHITEKTUR (ÜBERARBEITET)**

6. **Technologie-Stack-Empfehlung (NEU)**
   - **Frontend:** Flutter (Open Source, Cross-Platform)
   - **Backend:** Node.js + Express (Open Source, einfache Community-Beiträge)
   - **Datenbank:** PostgreSQL (Open Source)
   - **Cloud:** Hetzner Cloud (deutscher Anbieter, DSGVO-konform, ab €5/Monat)
   - **Zahlungen:** GNU Taler (Open Source, keine Banklizenz nötig)
   - **Routing:** OpenRouteService (Open Source)
   - **Karten:** OpenStreetMap (Open Data)
   - **Kommunikation:** Matrix (Open Source, dezentral)

7. **Mini-Programm-Ökosystem (NEU)**
   - **Architektur:** WebView-basierte Mini-Apps (wie WeChat)
   - **SDK:** Open-Source-SDK für Entwickler
   - **Abrechnung:** Keine – Mini-Apps sind kostenlos (oder über Spenden finanziert)
   - **Sicherheit:** Sandbox-Umgebung für Mini-Apps (Open-Source-Sicherheitstools)

---

## ⚖️ **PHASE 4: RECHTLICHES & COMPLIANCE (ÜBERARBEITET)**

8. **Regulatorischer Fahrplan (NEU)**
   - **Finanzen:** KEINE BaFin-Lizenz – nur P2P-Transaktionen (rechtlich unbedenklich)
   - **Gesundheit:** KEINE TI-Anbindung – nur Terminverwaltung (keine Patientendaten)
   - **Mobilität:** KEINE Verträge – nur öffentliche APIs
   - **DSGVO:** Open-Source-DSGVO-Tools (PrivaShield) – selbst dokumentiert

9. **DSGVO-Strategie als Wettbewerbsvorteil (UNVERÄNDERT)**
   - Privacy-by-Design
   - Datenminimierung
   - Einwilligungsmanagement
   - **NEU:** Open-Source-Transparenz – jeder kann den Code prüfen

---

## 📈 **PHASE 5: GO-TO-MARKET-STRATEGIE (ÜBERARBEITET)**

10. **Lancierungs-Strategie (NEU)**
    - **Start:** GitHub – nicht Hamburg
    - **Erste Nutzer:** Entwickler und Open-Source-Enthusiasten
    - **Erste Stadt:** Kontakt zu Open-Source-freundlichen Kommunen (z.B. München, wo Open Source gefördert wird)
    - **12-Monats-Plan:**
      - Monat 1-3: GitHub-Repository + Community-Aufbau
      - Monat 4-6: Erste funktionierende Demo (Stadtinformationen + ÖPNV)
      - Monat 7-9: Integration von Routing + P2P-Zahlungen
      - Monat 10-12: Erste Pilot-Stadt (kostenlose Bereitstellung)

11. **Marketing-Kampagne (NEU)**
    - **Kanäle:** Mastodon, Open-Source-Foren, heise online, Linux-Magazin
    - **Zielgruppe:** Open-Source-Community, Datenschutzbewusste
    - **Botschaft:** "HEIMAT 2.0 – Die Open-Source-Alternative zu kommerziellen Super-Apps"

12. **Partner-Akquise-Strategie (NEU)**
    - **KEINE kommerziellen Partner**
    - **Stattdessen:** Open-Source-Community, Städte, Universitäten
    - **Value Proposition:** "Kostenlose, Open-Source-Bürger-App für Ihre Stadt"

---

## 💎 **PHASE 6: BUSINESS CASE & FINANZEN (ÜBERARBEITET)**

13. **Geschäftsmodell (NEU)**
    - **KEINE Einnahmequellen** – reine Community-Entwicklung
    - **Finanzierung:** Spenden (Open Collective), Förderungen (Prototype Fund)
    - **Kosten:** Nur Hosting (€5-10/Monat) + Domain (€10/Jahr)

14. **Risikoanalyse (NEU)**
    - **Top 3 Risiken:**
      1. **Mangelnde Community** – Lösung: Aktive Akquise von Entwicklern
      2. **Rechtliche Grauzonen** – Lösung: Fokus auf rechtlich unbedenkliche Services
      3. **Technische Abhängigkeiten** – Lösung: Open-Source-Standards

---

### 📊 **NEUE FORMATVORGABE**

Bitte erstelle einen **Open-Source-Umsetzungsplan** mit:

- Executive Summary (Fokus auf Open-Source-Philosophie)
- Detaillierte Kapitel für jede Phase (mit Open-Source-Bezug)
- Liste aller benötigten Open-Source-Tools und Datenquellen
- Konkrete GitHub-Repository-Empfehlungen
- Community-Aufbau-Strategie
- Zeitplan (Open-Source-Meilensteine)

---

### 🧭 **NEUE LEITFRAGEN FÜR DEN AGENTEN**

- Welche Open-Source-Projekte können wir als Basis nutzen (OSCA, OpenRouteService, GNU Taler)?
- Wie können wir eine aktive Community aufbauen (ohne Geld)?
- Wie minimieren wir rechtliche Risiken (keine BaFin, keine TI)?
- Wie finanzieren wir Hosting und Infrastruktur (Spenden, Förderungen)?
- Wie schaffen wir Vertrauen (Open-Source-Transparenz)?

---

### ✅ **NEUE ERFOLGSKRITERIEN**

1. **Open-Source-Nutzung:** 100% der verwendeten Tools sind Open Source
2. **Rechtliche Unbedenklichkeit:** Keine Verträge, keine Lizenzen, keine Genehmigungen
3. **Kostenfreiheit:** Die App ist für alle Nutzer vollständig kostenlos
4. **Community-getrieben:** Mindestens 10 aktive Contributor nach 6 Monaten
5. **Funktionsfähigkeit:** MVP mit Mobilität, Finanzen (P2P) und Gesundheit (Termine)

---

### 🏁 **STARTANWEISUNG**

Beginne mit der **Phase 1: Marktanalyse & Positionierung (überarbeitet)**. Arbeite strukturiert und detailreich, mit Fokus auf Open-Source-Lösungen.

**Los geht's! 🚀**

---

**Hinweis für den Agenten:** Dies ist der überarbeitete Rahmen für HEIMAT 2.0. Alle Entscheidungen müssen unter der Prämisse getroffen werden: **"Nur das nutzen, was legal, kostenlos und Open Source ist – ohne Verträge, ohne Genehmigungen, ohne Unternehmen."**
