# HEIMAT 2.0 – Open-Source Umsetzungsplan

## Executive Summary

HEIMAT 2.0 ist eine Open-Source Super App für den deutschen Alltag, die ausschließlich auf Open-Source-Technologien und öffentlich zugänglichen Daten basiert. Die Plattform fokussiert sich auf drei Kernbereiche: Mobilität, Finanzen und Gesundheit – stets unter der Prämisse: keine Verträge, keine Lizenzen, keine Genehmigungen. Das Ziel ist eine datenschutzkonforme, kostenfreie Alternative zu kommerziellen All-in-One-Apps.

---

## Phase 1: Marktanalyse & Positionierung

### 1. Wettbewerbsanalyse

#### A) Mobilität

| Open-Source-Lösung | Beschreibung | Status in DE | Lücke |
|---------------------|--------------|--------------|-------|
| **OpenStreetMap (OSM)** | Weltweit größte freie Karte | ✅ Sehr aktiv, riesige DE-Community | Keine |
| **OpenRouteService** | Routing-Engine auf OSM-Basis | ✅ German OSM Server verfügbar | Keine |
| **OSRM** | Schnelles Routing | ✅ Nutzt OSM-Daten | Keine |
| **db-rest (Vendo API)** | ÖPNV-Daten via DB Navigator Backend | ✅ Echtzeit-Daten, 461 Verbünde, REST JSON | Keine |
| **OSCA** | Mobilitätsmodul für Verbünde | ✅ In einigen Städten aktiv | Skalierung nötig |
| **Vereinbarkeit** | Kein Ticketkauf nötig | ✅ Rechtlich unbedenklich | Nur Anzeige |

**Fazit Mobilität:** Die Open-Source-Basis ist exzellent. OSM + db-rest (Vendo API) + OpenRouteService decken Navigation und ÖPNV-Anzeige vollständig ab. Kein rechtliches Risiko, da nur öffentliche APIs genutzt werden.

#### B) Finanzen

| Open-Source-Lösung | Beschreibung | Status in DE | Lücke |
|---------------------|--------------|--------------|-------|
| **GNU Taler** | Privacy-preserving digitales Bargeld | ✅ In Entwicklung, erster Productive Launch in CH | Nutzerbasis noch klein |
| **Lightning Network** | Bitcoin Layer-2 für schnelle Zahlungen | ✅ Aktive Community | Volatilität, nicht für jeden |
| **Bitcoin (P2P)** | Dezentrale Überweisungen | ✅ Legal in DE | Keine BaFin-Lizenz nötig für P2P |
| **Cashu** | E-Cash Protokoll | ✅ Open Source | Experimental |

**Fazit Finanzen:** P2P-Zahlungen sind legal ohne BaFin-Lizenz (kein Geldverwahrer). GNU Taler ist die vielversprechendste Lösung für den deutschen Markt – privacy-by-design, kein Spekulieren. Lightning/Bitcoin als Backup für technikaffine Nutzer.

#### C) Gesundheit

| Open-Source-Lösung | Beschreibung | Status in DE | Lücke |
|---------------------|--------------|--------------|-------|
| **OpenMRS** | Medizinisches Aufzeichnungssystem | ✅ Weltweit eingesetzt | Nicht für DE-TI ausgelegt |
| **FHIR-Tools** | Healthcare Interoperability | ✅ Open Source Implementierungen | TI-Anbindung = Genehmigung nötig |
| **Simple termin-buchung** | Manuelle Terminverwaltung | ✅ Jedes Kalender-Tool | Keine |
| **DGDG** | Digital Health Germany | ✅ Community | Terminverwaltung = unkritisch |

**Fazit Gesundheit:** Für reine Terminverwaltung braucht es keine TI-Anbindung. Ein einfaches Open-Source-Buchungssystem (oder sogar Matrix-Rooms) reicht. Keine Patientendaten = kein rechtliches Risiko.

### 2. Zielgruppen-Definition

#### Nutzer-Personas

**Persona 1: Anna, 32, Berlin**
- Beruf: UX-Designerin
-Anna: Hasst das Wechseln zwischen 10 Apps (DB, Moovit, PayPal, Doctolib)
- Nutzt: Datenschutzkonforme Tools (Signal, OSM)
- Wert: Bequemkeit ohne Kompromisse bei Privatsphäre

**Persona 2: Markus, 45, München**
- Beruf: Ingenieur, Familienvater
-Markus: Komplexe ÖPNV-Verbindungen mit Kind
- Nutzt: Android, pragmatisch
- Wert: Zuverlässigkeit, keine versteckten Kosten

**Persona 3: Sarah, 28, Hamburg**
- Beruf: Freelancerin
-Sarah: P2P-Zahlungen an Kollegen, Terminfindung beim Arzt
- Nutzt: iOS, Open-Source begeistert
- Wert: Transparenz, Community

**Persona 4: Klaus, 67, Leipzig**
- Beruf: Rentner
-Klaus: Digitale Teilhabe, einfache Bedienung
- Nutzt: Smartphone Basics
- Wert: Einfachheit, Vertrauen

#### Entwickler-Persona

**Persona 5: Dev, 29, Remote**
- Beruf: Full-Stack-Entwickler
- Motivation: Open-Source beitragen, Portfolio aufbauen
- Skills: Flutter, Node.js, PostgreSQL
- Wert: Gute Dokumentation, freundliche Community, lernbar

### 3. Positionierungs-Statement

> "Für alle Deutschen, die eine datenschutzkonforme, kostenlose Alternative zu kommerziellen All-in-One-Apps suchen, bietet HEIMAT 2.0 eine Open-Source-Plattform für Mobilität, Finanzen und Gesundheit. Anders als WeChat oder Grab ist HEIMAT 2.0 vollständig transparent, community-getrieben und benötigt keine Verträge mit Banken oder Behörden."

---

## Phase 2: Service-Definition & Priorisierung

### 4. Service-Blaupausen

#### A) MOBILITÄT

| Aspekt | Details |
|--------|---------|
| **Datenquelle** | OpenStreetMap + db-rest (DB Navigator Vendo API, REST JSON) |
| **Routing** | OpenRouteService (Open Source) oder OSRM |
| **Ticketkauf** | Keine Integration – nur Anzeige von Fahrplänen |
| **Partnerschaften** | Keine – nur öffentliche APIs |
| **Rechtliche Lage** | Unbedenklich – öffentliche REST APIs, kein Scraping |

**UX-Flow:**
1. Nutzer gibt Start/Ziel ein
2. App zeigt Verbindung mit ÖPNV, Rad, Fuß an
3. Nutzer sieht Fahrpreis und Fahrzeit
4. Nutzer kauft Ticket extern (DB, HVV, etc.)

**Technische Umsetzung:**
- Karten-Rendering: MapLibre GL (OSM-basiert)
- Routing-API: OpenRouteService oder eigener OSRM-Server
- ÖPNV-Daten: db-rest (self-hosted Docker, Vendo API – echte DB Navigator Backend-API)
- Kein eigenes Backend nötig für erste Version

---

#### B) FINANZDIENSTLEISTUNGEN

| Aspekt | Details |
|--------|---------|
| **Technologie** | GNU Taler (Hauptoption) oder Lightning Network (Fallback) |
| **Compliance** | Keine BaFin-Lizenz nötig – reine P2P-Überweisungen |
| **Geldverwahrung** | Keine – Taler sind Bargeld-Äquivalent |
| **Partnerschaften** | Keine – dezentrales System |
| **Rechtliche Lage** | P2P-Zahlungen legal, kein Zahlungsinstitut |

**UX-Flow:**
1. Nutzer verknüpft Taler-Wallet (einmalig)
2. Nutzer sendet Geld an Freund (Scan QR oder Username)
3. Transaktion läuft über dezentrales Taler-Netzwerk
4. Empfänger sieht Geld sofort (instant settlement)

**Technische Umsetzung:**
- Taler-Integration via SDK (GNU Taler Reference Implementation)
- Wallet-Plugin für die App
- Kein eigenes Payment-Backend nötig
- Exchange-Integration über öffentliche Taler-Exchanges

---

#### C) GESUNDHEIT

| Aspekt | Details |
|--------|---------|
| **Technologie** | Open-Source-Terminbuchungssystem (z.B. Cal.com, Easy!Appointments) |
| **Compliance** | Keine TI-Anbindung – nur Terminverwaltung |
| **Patientendaten** | Keine – nur Termin Slot |
| **Partnerschaften** | Keine – Ärzte können sich manuell eintragen |
| **Rechtliche Lage** | Unbedenklich – kein Gesundheitsdaten-Handling |

**UX-Flow:**
1. Nutzer sucht Arzt (nach Fachrichtung, PLZ)
2. App zeigt verfügbare Termine
3. Nutzer bucht Termin (manuelle Bestätigung durch Praxis)
4. Nutzer bekommt Erinnerung

**Technische Umsetzung:**
- Cal.com (Open Source) oder Easy!Appointments
- Ärzte tragen sich selbst ein (Self-Service)
- Kalender-Sync via iCal/Open Calendar
- Keine Patientenakte, keine Gesundheitsdaten

---

### 5. Priorisierungs-Matrix

| Service | Nutzen (1-10) | Aufwand (1-10) | Recht (1-10) | OSS (1-10) | **Gesamt** |
|---------|---------------|----------------|--------------|------------|------------|
| **Mobilität (ÖPNV-Anzeige)** | 9 | 3 | 0 | 10 | **22** |
| **Finanzen (P2P-Taler)** | 7 | 5 | 0 | 9 | **21** |
| **Gesundheit (Termine)** | 6 | 2 | 0 | 8 | **16** |

**Bewertungsskala:**
- Nutzen: Je höher, desto besser für Nutzer
- Aufwand: Je niedriger, desto schneller umsetzbar
- Recht: 0 = keine Hürden (Ziel)
- OSS: Je höher, desto besser die Open-Source-Verfügbarkeit

---

### 6. Top 3 MVP-Start (Reihenfolge)

| Rang | Service | Begründung |
|------|---------|------------|
| **1** | **Mobilität (ÖPNV)** | Höchster Nutzen, geringster Aufwand, keine rechtlichen Hürden, exzellente OSS-Basis |
| **2** | **Finanzen (P2P-Taler)** | Differenzierung, gutes OSS, rechtlich unbedenklich |
| **3** | **Gesundheit (Termine)** | Einfachste Integration, guter Nutzen, aber abwärts prioritisiert |

---

### 7. Minimales MVP (Release 0.1)

Das erste Release enthält:
- ✅ Interaktive Karte (OSM/MapLibre)
- ✅ ÖPNV-Verbindungssuche (db-rest / Vendo API)
- ✅ Routing (OpenRouteService)
- ✅ Städtische Infos (Wikipedia/Wikidata)
- ✅ Keine Accounts nötig für Nutzung

**Folge-Releases:**
- v0.2: Taler-Integration (P2P)
- v0.3: Arzt-Termine (Cal.com)
- v0.4: Mini-Programm-Ökosystem

---

## Phase 3: Technologie & Architektur

### 8. Technologie-Stack-Empfehlung

| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| **Frontend** | Flutter | Open Source, Cross-Platform (iOS/Android/Web), große Community |
| **Backend** | Node.js + Express | Open Source, einfache Community-Beiträge, JavaScript-Ökosystem |
| **Datenbank** | PostgreSQL | Open Source, mächtig, bewährt |
| **Cloud** | Render.com + Hetzner Cloud | Open Source Deployment, DSGVO-konform |
| **Zahlungen** | GNU Taler | Open Source, keine Banklizenz nötig |
| **Routing** | OpenRouteService | Open Source, OSM-basiert |
| **ÖPNV** | db-rest (self-hosted, Vendo API) | Open Source, REST JSON, Echtzeit-Daten, 461 Verbünde |
| **Karten** | OpenStreetMap + MapLibre GL | Open Data, kein Proprietär |
| **Kommunikation** | Matrix (Element) | Open Source, dezentral, E2E-verschlüsselt |
| **Auth** | Keycloak | Open Source, SSO-fähig |
| **CI/CD** | GitHub Actions | Kostenlos für Open Source |
| **Monitoring** | Grafana + Prometheus | Open Source, Self-Hosted |

---

### 9. Systemarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                      HEIMAT 2.0                             │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Flutter)                                         │
│  ├── Karte (MapLibre GL)                                   │
│  ├── ÖPNV-Suche (db-rest / Vendo API)                       │
│  ├── Taler-Wallet (P2P)                                    │
│  └── Terminbuchung (Cal.com)                               │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js)                                         │
│  ├── API Gateway                                           │
│  ├── Auth Service (Keycloak)                               │
│  ├── Mobilität Service                                     │
│  ├── Finanzen Service (Taler-Integration)                  │
│  └── Gesundheit Service (Cal.com-Integration)              │
├─────────────────────────────────────────────────────────────┤
│  Daten & APIs                                              │
│  ├── PostgreSQL (Nutzer, Präferenzen)                      │
│  ├── OpenStreetMap (Karten)                                │
│  ├── db-rest (ÖPNV-Daten via DB Navigator Vendo API)        │
│  ├── OpenRouteService (Routing)                            │
│  └── GNU Taler (Zahlungen)                                 │
├─────────────────────────────────────────────────────────────┤
│  Infrastruktur (Hetzner Cloud)                             │
│  ├── Docker + Kubernetes                                   │
│  ├── Grafana + Prometheus                                  │
│  └── GitHub Actions (CI/CD)                                │
└─────────────────────────────────────────────────────────────┘
```

---

### 9b. ÖPNV-Architektur: db-rest (Vendo API)

**Status:** Aktiv — ersetzt GTFS-Datei-Import durch professionellen REST-API-Wrapper.

**Was ist db-rest?**
- Self-hosted Docker-Service (`derhuerst/db-rest:6`) auf Render.
- Wrapper um die **aktuelle DB Navigator Backend-API** (Vendo/Movas).
- Gleiche Infrastruktur wie die offizielle DB Navigator-App.
- Kein Token, kein GTFS-Download, kein Scraping.
- JSON-Responses mit Echtzeit-Verspätungen, Störungen, Verbindungen.
- Open Source: `github.com/derhuerst/db-rest` (120 Stars).

**Abdeckung:**
- Alle ICE/IC/RE/RB/S-Bahn/U-Bahn/Bus/Tram in Deutschland.
- 461 Verkehrsverbünde (über DB-Netz abgedeckt).
- Echtzeit-Daten (Verspätungen, Ausfälle).
- Fallback für reine Stadtbusse: Overpass API (wie bisher).

**Architektur:**
```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Flutter)                  │
│  Departure-Board │ Journey-Planner │ Stop-Suche       │
├──────────────────────────────────────────────────────┤
│              HEIMAT Backend (Render, Port 3000)        │
│  /api/mobility/departures │ /journey │ /stops/search  │
├──────────────────────────────────────────────────────┤
│           db-rest Service (Render, Port 3001)          │
│  Docker: derhuerst/db-rest:6                          │
│  Redis-Caching (Render Redis Addon)                   │
├──────────────────────────────────────────────────────┤
│           Vendo/Movas API (DB Navigator Backend)       │
│  https://app.vendo.noncd.db.de/mob/                   │
│  Kein Token, kein Auth, 100 req/min                   │
├──────────────────────────────────────────────────────┤
│           Fallback: Overpass API (lokale Stops)        │
│  Haltestellen-Suche für reine Stadtbusse              │
└──────────────────────────────────────────────────────┘
```

**ML-Verspätungsvorhersage (Innovation):**
- db-rest liefert bereits Echtzeit-Daten.
- Unsere Innovation: Vorhersage basierend auf historischen Daten.
- Ansatz: Täglich Abfahrten + reale Ankunftszeiten loggen (in Supabase).
- Modell: LightGBM (schnell, gut für Tabellen-Daten).
- Output: Vorhergesagte Verspätung für jede Abfahrtszeit.

---

### 10. Mini-Programm-Ökosystem

| Aspekt | Details |
|--------|---------|
| **Architektur** | WebView-basierte Mini-Apps (wie WeChat) |
| **SDK** | Open-Source-SDK für Entwickler |
| **Abrechnung** | Keine – Mini-Apps sind kostenlos (oder über Spenden finanziert) |
| **Sicherheit** | Isolierte Laufzeitumgebung für Mini-Apps |
| **Entwicklung** | Standard-Web-Technologien (HTML/CSS/JS) |

**Vorteile der WebView-Architektur:**
- Entwickler brauchen keine App-Stores
- Sofortige Updates ohne Review
- Einstiegshürde minimal (Web-Entwickler)
- Isolation für Sicherheit

**Beispiel-Mini-Apps:**
- Restaurant-Bestellung (Daten von OpenStreetMap)
- Event-Tickets (Daten von Wikidata)
- Nachbarschaftshilfe (Matrix-Rooms)

---

### 11. Datenschutz-Architektur

| Prinzip | Umsetzung |
|---------|-----------|
| **Privacy by Design** | Keine personenbezogenen Daten standardmäßig |
| **Datenminimierung** | Nur das Nötigste speichern |
| **Löschpflicht** | Automatisches Löschen nach 30 Tagen Inaktivität |
| **Transparenz** | Jeder kann den Code prüfen |
| **Verschlüsselung** | E2E für Messenger, TLS für alles andere |
| **Tracking** | Kein Tracking, kein Analytics |

---

## Phase 4: Rechtliches & Compliance

### 12. Regulatorischer Fahrplan

| Bereich | regulatorische Anforderung | HEIMAT-Lösung |
|---------|---------------------------|---------------|
| **Finanzen** | BaFin-Lizenz für Zahlungsdienstleister | **KEINE LIZENZ** – reine P2P-Transaktionen (kein Geldverwahrer) |
| **Gesundheit** | TI-Anbindung (KIM, ePA) | **KEINE TI** – nur Terminverwaltung, keine Patientendaten |
| **Mobilität** | Verträge mit Verkehrsverbünden | **KEINE VERTRÄGE** – nur öffentliche APIs (db-rest / Vendo) |
| **Messenger** | TKÜ-Verbot (Vorratsdatenspeicherung) | **E2E-Verschlüsselung** – Matrix, kein Zugriff möglich |
| **DSGVO** | Datenschutz-Grundverordnung | **PRIVACY-BY-DESIGN** – Open Source, transparent |

---

### 13. Detaillierte Rechtsanalyse nach Bereich

#### A) Finanzen (GNU Taler / Lightning)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine BaFin-Lizenz? | **Nein** – P2P-Zahlungen ohne Geldverwahrung sind keine Zahlungsdienstleistung |
| Was ist Geldverwahrung? | Wenn HEIMAT Geld zwischenspeichert – das tun wir NICHT |
| Ist Taler legal in DE? | **Ja** – Taler ist ein digitales Bargeld-Äquivalent, kein e-Payment |
| Brauche ich AML/KYC? | **Nein** – P2P-Transaktionen unterhalb von Freigrenzen |
| Was mit Steuern? | Nutzer sind selbst verantwortlich – HEIMAT ist nur Plattform |

**Fazit:** P2P-Zahlungen über Taler/Lightning sind rechtlich unbedenklich, solange kein Geldverwahrung stattfindet.

#### B) Gesundheit (Terminverwaltung)

| Frage | Antwort |
|-------|---------|
| Brauche ich eine TI-Zulassung? | **Nein** – keine Patientendaten, keine Arzt-Patienten-Kommunikation |
| Was ist ein Gesundheitsdaten-Scheduler? | Nur Termin Slot – kein Name, keine Diagnose |
| Brauche ich eine Datenschutz-Folgenabschätzung? | **Nein** – keine Verarbeitung besonderer Kategorien |
| Was mit Ärzten? | Ärzte tragen sich selbst ein – HEIMAT ist Vermittler |

**Fazit:** Reine Terminverwaltung ohne Patientendaten ist kein Gesundheitsdienst im Sinne der Regulierung.

#### C) Mobilität

| Frage | Antwort |
|-------|---------|
| Darf ich GTFS-Daten scrapen? | **Ja** – GTFS ist öffentlich, meist under CC-BY |
| Brauche ich Verträge mit Verbünden? | **Nein** – öffentliche Daten, kein Vertrieb von Tickets |
| Ist routing legal? | **Ja** – OpenStreetMap ist Open Data |
| Was mit Haftung? | KEINE HAFTUNG für falsche Fahrpläne – Disclaimer in App |

**Fazit:** Öffentliche Daten auslesen ist legal. Kein Verkauf, keine Haftung.

---

### 14. DSGVO-Strategie als Wettbewerbsvorteil

| Prinzip | Umsetzung | Nutzen |
|---------|-----------|--------|
| **Privacy by Design** | Keine personenbezogenen Daten standardmäßig | Vertrauen |
| **Datenminimierung** | Nur das Nötigste speichern | Geringes Risiko |
| **Einwilligungsmanagement** | Klare Opt-in/Out-Dialoge | Transparenz |
| **Recht auf Löschung** | Automatisches Löschen nach 30 Tagen | Compliance |
| **Open-Source-Transparenz** | Jeder kann den Code prüfen | Community-Vertrauen |
| **Kein Tracking** | Kein Analytics, kein Profiling | Differenzierung |

**Wettbewerbsvorteil:** Während kommerzielle Apps auf Tracking setzen, ist HEIMAT von Grund auf privat. Das ist kein Nachteil, sondern das Hauptverkaufsargument.

---

### 15. Haftung & Disclaimer

| Bereich | Disclaimer |
|---------|------------|
| **Mobilität** | "Fahrpläne können sich ändern. Bitte prüfe vor Abfahrt." |
| **Finanzen** | "P2P-Zahlungen sind endgültig. HEIMAT haftet nicht für Fehler." |
| **Gesundheit** | "Terminvorschläge sind unverbindlich. Ärzte bestätigen manuell." |
| **Gesamt** | "HEIMAT ist Open Source – keine Gewähr auf Richtigkeit." |

---

## Phase 5: Go-to-Market-Strategie

### 16. Lancierungs-Strategie

| Phase | Status | Details |
|-------|--------|---------|
| **Phase 1: Repo + Community** | ✅ Abgeschlossen | GitHub-Repository, CONTRIBUTING.md, Matrix-Room |
| **Phase 2: MVP Demo** | ✅ Abgeschlossen | Funktionierende App: Karte + ÖPNV-Suche + Routing |
| **Phase 3: Integration** | 🔧 Teilweise | Arzt-Registrierung done, Taler Testnet ausstehend |
| **Phase 4: Pilot-Stadt** | 📋 Geplant | Nächster Meilenstein |

---

### 17. Startstrategie: "GitHub statt Hamburg"

| Aspekt | Traditionell | HEIMAT |
|--------|--------------|--------|
| **Startort** | Hauptsitz, Mitarbeiter | GitHub, Community |
| **Erste Nutzer** | Endverbraucher | Entwickler + Open-Source-Enthusiasten |
| **Erste Stadt** | Pilotprojekt mit Vertrag | Open-Source-Bereitstellung (kein Vertrag nötig) |
| **Finanzierung** | Venture Capital | Spenden + Fördermittel |

**Vorteil:** Kein Büro, kein Vertrag, kein Risiko – nur Code und Community.

---

### 18. Marketing-Kampagne

#### Kanäle

| Kanal | Zielgruppe | Botschaft |
|-------|------------|-----------|
| **Mastodon** | Datenschutzbewusste | "Kein Tracking, keine Kompromisse" |
| **GitHub** | Entwickler | "Contribuieren Sie an der ersten Open-Source Super App" |
| **heise online** | Tech-Interessierte | "HEIMAT 2.0 – Die Open-Source-Alternative zu WeChat" |
| **Linux-Magazin** | Linux-Nutzer | "100% Open Source, 100% Kostenlos" |
| **FOSDEM / CCC** | Hacker | "Privacy by Design – kein Buzzword, sondern Code" |
| **Lokale Meetups** | Stadtbewohner | "Ihre Stadt, Ihre App – Open Source" |

#### Kernbotschaften

1. **Für Nutzer:** "Alle Ihre Alltagsdienste in einer App – ohne Verträge, ohne Datenverlust."
2. **Für Entwickler:** "Contribuieren Sie an einem Projekt, das die Zukunft des deutschen Alltags gestaltet."
3. **Für Städte:** "Kostenlose, Open-Source-Bürger-App für Ihre Kommune – kein Vertrag, keine Lizenz."

---

### 19. Partner-Akquise-Strategie

| Partner-Typ | Ansatz | Value Proposition |
|-------------|--------|-------------------|
| **Open-Source-Community** | GitHub, Matrix, Foren | "Gestalten Sie die Zukunft mit" |
| **Kommunen** | Direktansprechpartner, HACKATHONS | "Kostenlose Bürger-App für Ihre Stadt" |
| **Universitäten** | Lehrstühle, Forschung | "Open-Source-Projekt für Studierende" |
| **OSM-Community** | Kontakt über local chapters | "Ihre Karten, unsere App" |

**Wichtig:** KEINE kommerziellen Partner. KEINE Verträge. Nur Open-Source-Community.

---

### 20. Community-Aufbau-Strategie

| Maßnahme | Details |
|----------|---------|
| **CONTRIBUTING.md** | Klare Anleitung für neue Contributors |
| **Good First Issues** | Einfache Aufgaben für Einsteiger |
| **Matrix-Room** | Echtzeit-Kommunikation |
| **Wöchentlicher Dev-Call** | Sync und Q&A |
| **Roadmap-Public** | Transparente Planung |
| **Hackathons** | Virtuelle Events zur Feature-Entwicklung |
| **Blog** | Regelmäßige Updates, Tutorials |

**Ziel:** 10 aktive Contributors nach 6 Monaten.

---

## Phase 6: Business Case & Finanzen

### 21. Geschäftsmodell

| Aspekt | Details |
|--------|---------|
| **Einnahmequellen** | KEINE – reine Community-Entwicklung |
| **Finanzierung** | Spenden (Open Collective) + Fördermittel (Prototype Fund, BMBF) |
| **Kosten** | Hosting: €5-10/Monat (Hetzner) + Domain: €10/Jahr |
| **Personal** | 100% Freiwillige – keine Angestellten |
| **Skalierung** | Kosten steigen mit Nutzern – aber langsam (Open Source ist günstig) |

**Philosophie:** HEIMAT 2.0 ist kein Startup, sondern ein Gemeinwohlprojekt. Es gibt keinen Exit, keine Investoren, keine Gewinnmaximierung.

---

### 22. Finanzplan (Jahr 1)

| Posten | Kosten |
|--------|--------|
| **Hetzner Cloud (Small)** | €60/Jahr |
| **Domain (.de)** | €10/Jahr |
| **Matrix-Server** | €0 (selbst gehostet) |
| **GitHub Actions** | €0 (für Open Source) |
| **Entwicklung** | €0 (Freiwillige) |
| **Gesamt** | **~€70/Jahr** |

**Potenzielle Fördermittel:**
- **Prototype Fund** (OKFN): Bis zu €50.000 für Open-Source-Projekte
- **BMBF** "Smart Data": Förderung für datenschutzkonforme Projekte
- **Stiftungen** (Bosch, VW, Telekom): Offene Förderprogramme

---

### 23. Risikoanalyse

| Risiko | Wahrscheinlichkeit | Impact | Lösung |
|--------|-------------------|--------|--------|
| **Mangelnde Community** | Mittel | Hoch | Aktive Akquise via Hackathons, University-Kooperationen |
| **Rechtliche Grauzonen** | Niedrig | Hoch | Fokus auf rechtlich unbedenkliche Services, Rechtsberatung (Pro Bono) |
| **Technische Abhängigkeiten** | Niedrig | Mittel | Nur Open-Source-Standards, kein Vendor Lock-in |
| **Wenig Nutzer** | Hoch | Mittel | Langfristige Community-Arbeit, Pilot-Städte |
| **Geringe Funding** | Mittel | Niedrig | Niedrige Kosten, Spenden, Fördermittel |
| **Burnout der Entwickler** | Mittel | Hoch | Nachhaltiges Pace, Contributors belohnen |

---

### 24. Erfolgskriterien

| Kriterium | Ziel (6 Monate) | Ziel (12 Monate) |
|-----------|-----------------|------------------|
| **Open-Source-Nutzung** | 100% der Tools sind Open Source | 100% |
| **Rechtliche Unbedenklichkeit** | Keine Verträge, keine Lizenzen | Keine |
| **Kostenfreiheit** | App ist kostenlos | App ist kostenlos |
| **Community** | 10 aktive Contributors | 30 aktive Contributors |
| **Nutzer** | 100 Beta-Nutzer | 1.000 Nutzer |
| **Funktionsfähigkeit** | MVP: Karte + ÖPNV | MVP + Taler + Termine |

---

### 25. Erfolgsmessung

| Metrik | Tool | Frequenz |
|--------|------|----------|
| **GitHub Stars** | GitHub Insights | Wöchentlich |
| **Contributors** | GitHub Insights | Monatlich |
| **Commits** | GitHub Insights | Wöchentlich |
| **App-Downloads** | F-Droid / Web | Monatlich |
| **Nutzer-Feedback** | Matrix-Room | Täglich |
| **Fehler** | GitHub Issues | Täglich |

---

### 26. Langfristige Vision

| Jahr | Vision |
|------|--------|
| **Jahr 1** | MVP live, 10 Contributors, erste Pilot-Stadt |
| **Jahr 2** | 5 Städte, 50 Contributors, vollständiger Feature-Set |
| **Jahr 3** | Bundeseitige Bekanntheit, 100 Contributors, Referenzprojekt |
| **Jahr 5** | De-facto-Standard für Open-Source-Bürger-Apps in Europa |

---

## Zusammenfassung

HEIMAT 2.0 ist ein machbares Projekt mit minimalen Kosten, klarem rechtlichem Rahmen und starker Open-Source-Basis. Der Erfolg hängt von der Community ab – nicht von Investoren.

**Nächster Schritt:** Phase 3 abschließen – GNU Taler Testnet-Integration verwirklichen.

---

*Erstellt am: Juli 2024*
*Nächste Aktualisierung: Nach Abschluss der Taler-Integration (Phase 3)*

---

## Phase 7: Repository-Setup

### 27. Repository-Struktur

```
HEIMAT/
├── README.md                 # Projektbeschreibung
├── CONTRIBUTING.md           # Anleitung für Contributors
├── LICENSE                   # AGPL-3.0 (Open Source)
├── .github/
│   ├── ISSUE_TEMPLATE/       # Issue-Vorlagen
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/            # CI/CD (GitHub Actions)
├── docs/                     # Dokumentation
│   ├── architecture.md       # Systemarchitektur
│   ├── roadmap.md            # Projekt-Roadmap
│   └── api/                  # API-Dokumentation
├── src/                      # Quellcode
│   ├── mobile/               # Flutter App
│   ├── backend/              # Node.js Backend
│   └── shared/               # Gemeinsame Libraries
├── infra/                    # Infrastructure as Code
│   ├── docker/
│   └── terraform/
└── .loop.md                  # Fortschritts-Tracking
```

### 28. README.md Inhalt

**Kernkomponenten:**
- Projektname + Logo
- One-Liner Beschreibung
- Features (Mobilität, Finanzen, Gesundheit)
- Quick-Start Anleitung
- Technologie-Stack
- Contributing-Hinweis
- Lizenz (AGPL-3.0)
- Community-Links (Matrix, GitHub Discussions)

### 29. CONTRIBUTING.md Inhalt

**Kernkomponenten:**
- Code of Conduct
- Erste Schritte (Fork, Clone, Branch)
- Entwicklungsumgebung einrichten
- Code-Style (Flutter, Node.js)
- Testing (Flutter Tests, Jest)
- PR-Prozess
- Issue-Labels (good-first-issue, bug, feature)
- Kommunikation (Matrix-Room)

### 30. Lizenz: AGPL-3.0

**Begründung:**
- Stärkste Open-Source-Lizenz für SaaS
- Verhindert Proprietarisierung durch Cloud-Anbieter
- Sicherstellt, dass Änderungen öffentlich bleiben
- Kompatibel mit EU-Förderprogrammen

### 31. GitHub-Repository-Setup

| Schritt | Details |
|---------|---------|
| **Branch Protection** | Main branch schützen, PRs erforderlich |
| **Issue Templates** | Bug Report, Feature Request, Question |
| **PR Template** | Checklist für Contributors |
| **GitHub Actions** | CI/CD für Flutter + Node.js |
| **Dependabot** | Automatische Security-Updates |
| **CODEOWNERS** | Code-Owner für Reviews |

### 32. Nächste Schritte nach Repository

1. README.md erstellen ✅
2. CONTRIBUTING.md erstellen ✅
3. LICENSE hinzufügen (AGPL-3.0) ✅
4. Issue-Templates anlegen ✅
5. PR-Template erstellen ✅
6. GitHub Actions workflows konfigurieren ✅
7. Matrix-Room einrichten ✅
8. Erste Good-First-Issues anlegen ✅

---

## Phase 9: Community-Setup

### 33. Matrix-Room Einrichtung

**Raum-Name:** `#heimat:matrix.org`

**Einrichtungsschritte:**
1. Matrix-Room über Element erstellen
2. Raum-Beschreibung hinzufügen
3. Themen kanäle erstellen:
   - `#heimat-entwicklung:matrix.org` – Technische Diskussionen
   - `#heimat-mobilitaet:matrix.org` – Mobilitätsfeatures
   - `#heimat-finanzen:matrix.org` – Finanzfeatures
   - `#heimat-gesundheit:matrix.org` – Gesundheitsfeatures
   - `#heimat-ai:matrix.org` – AI-Integration
4. README.md mit Matrix-Link aktualisieren
5. CONTRIBUTING.md mit Kommunikationswegen aktualisieren

### 34. Community-Kanäle

| Kanal | Zweck | Plattform |
|-------|-------|-----------|
| **GitHub Issues** | Bug-Reports, Feature-Requests | GitHub |
| **GitHub Discussions** | Allgemeine Fragen, Ideen | GitHub |
| **Matrix-Room** | Echtzeit-Kommunikation | Matrix |
| **Mastodon** | Updates, Ankündigungen | Mastodon |

### 35. Good-First-Issues (Erstellt)

| Issue | Titel | Labels |
|-------|-------|--------|
| #6 | Flutter-Projektstruktur einrichten | `good-first-issue`, `flutter` |
| #7 | Node.js Backend-Grundstruktur | `good-first-issue`, `backend` |
| #8 | Docker-Grundkonfiguration | `good-first-issue`, `docker` |
| #9 | OpenStreetMap-Komponente | `good-first-issue`, `flutter` |
| #10 | Dokumentation: Architektur | `good-first-issue`, `documentation` |

### 36. Nächste Community-Maßnahmen

1. **Matrix-Room** einrichten und verlinken ✅
2. **Mastodon-Account** erstellen (@heimat@social.heimat-app.de)
3. **Erste Blog-Beiträge** veröffentlichen
4. **Open-Source-Foren** posten (heise, Linux-Magazin)
5. **Universitäten** kontaktieren (FH München, TU Berlin)

---

## Phase 10: Marketing-Setup

### 37. Mastodon-Account

**Account:** `@heimat@social.heimat-app.de`

**Einrichtungsschritte:**
1. Mastodon-Server einrichten (oder nutzung eines öffentlichen Servers)
2. Account erstellen mit Bio:
   > "HEIMAT 2.0 – Die erste Open-Source Super App für Deutschland. 100% kostenlos, 100% datenschutzkonform, 100% community-getrieben. #OpenSource #Datenschutz #Germany"
3. Profilbild und Header hinzufügen
4. Erste Beiträge veröffentlichen
5. Andere Open-Source-Projekte verlinken

### 38. Blog-Strategie

**Plattform:** GitHub Pages oder Self-Hosted (Hugo/Jekyll)

**Erste Blog-Beiträge:**

| Titel | Inhalt | Zielgruppe |
|-------|--------|------------|
| "Was ist HEIMAT 2.0?" | Projektvorstellung, Vision | Alle |
| "Warum Open Source?" | Philosophie, Vorteile | Entwickler |
| "Datenschutz als Feature" | DSGVO-Strategie | Datenschutzbewusste |
| "Erste Schritte zum Contributieren" | Tutorial | Neue Contributors |
| "AI in HEIMAT 2.0" | AI-Strategie | ML-Interessierte |

### 39. Social-Media-Strategie

| Kanal | Frequenz | Inhalt |
|-------|----------|--------|
| **Mastodon** | 3-5x/Woche | Updates, Diskussionen, Open-Source-Tipps |
| **GitHub** | Wöchentlich | Releases, Milestones, Contributors |
| **Blog** | 2x/Monat | Tutorials, Deep-Dives, Meinungen |
| **Matrix** | Täglich | Community-Support, Fragen |

### 40. Content-Kalender (historisch, Monat 1-4)

| Woche | Mastodon | Blog | Matrix |
|-------|----------|------|--------|
| **1** | Vorstellung HEIMAT | "Was ist HEIMAT 2.0?" | Room einrichten |
| **2** | Open-Source-Philosophie | "Warum Open Source?" | Erste Diskussionen |
| **3** | Datenschutz-Fokus | "Datenschutz als Feature" | Community-Welcome |
| **4** | Contributing-Call | "Erste Schritte" | Erste Good-First-Issues |

### 41. Open-Source-Foren

| Forum | Format | Inhalt |
|-------|--------|--------|
| **heise.de** | Artikel-Einreichung | "HEIMAT 2.0 – Open-Source Super App" |
| **Linux-Magazin** | Community-Beitrag | "Mitmachen bei HEIMAT" |
| **Reddit** | Post | r/opensource, r/de |
| **Hacker News** | Show HN | "Show HN: HEIMAT 2.0" |

### 42. Universitäts-Kontakt

| Universität | Ansprechpartner | Format |
|-------------|-----------------|--------|
| **FH München** | Prof. Dr. [Name] | Praxisprojekt |
| **TU Berlin** | Fachgebiet Mobile Computing | Bachelor-Arbeit |
| **Uni Hamburg** | Informatik | Seminarprojekt |

**Value Proposition:** "Kostenloses Open-Source-Projekt für Studierende mit Praxisbezug"

---

## Phase 11: Marketing-Ausführung

### 43. Mastodon-Account

**Account:** `@heimat@social.heimat-app.de`

**Setup-Anleitung:**
1. Mastodon-Server betreiben oder öffentlichen nutzen
2. Account erstellen
3. Bio:
   > "HEIMAT 2.0 – Die erste Open-Source Super App für Deutschland. 100% kostenlos, 100% datenschutzkonform, 100% community-getrieben. #OpenSource #Datenschutz #Germany"
4. Profilbild: HEIMAT-Logo
5. Header: Screenshot der App

**Erste Beiträge:**
1. "HEIMAT 2.0 ist da! Die erste Open-Source Super App für Deutschland. Alle Infos: github.com/abatn/HEIMAT"
2. "Warum Open Source? Weil Vertrauen durch Transparenz entsteht."
3. "Datenschutz ist kein Hindernis – er ist unser Produkt."

### 44. Erster Open-Source-Beitrag

**Ziel:** heise.de oder Linux-Magazin

**Artikel-Vorschlag:**
- **Titel:** "HEIMAT 2.0 – Die erste Open-Source Super App für Deutschland"
- **Inhalt:** Vorstellung des Projekts, Technologie, Philosophie
- **Zielgruppe:** Open-Source-Community, Datenschutzbewusste

**Einreichung:**
- heise.de: https://www.heise.de/ct/autoren
- Linux-Magazin: https://www.linuxmagazin.de/autoren

### 45. Reddit-Beiträge

**Subreddits:**
- r/opensource
- r/de
- r/selfhosted
- r/privacy

**Format:**
- Titel: "[Projekt] HEIMAT 2.0 – Open-Source Super App für Deutschland"
- Inhalt: Kurzbeschreibung, Features, GitHub-Link

### 46. Hacker News

**Show HN Format:**
- Titel: "Show HN: HEIMAT 2.0 – Open-Source Super App for Germany"
- Inhalt: Technologie, Features, Warum Open Source

### 47. Content-Kalender (Woche 1-4)

| Woche | Mastodon | Blog | Foren |
|-------|----------|------|-------|
| **1** | Vorstellung | "Was ist HEIMAT?" | Reddit r/opensource |
| **2** | Open Source | "Warum Open Source?" | heise.de |
| **3** | Datenschutz | "Datenschutz als Feature" | Reddit r/de |
| **4** | Contributing | "Erste Schritte" | Hacker News |

### 48. Nächste Schritte nach Marketing

1. **Mastodon-Account** einrichten (manuell)
2. **Ersten Reddit-Post** erstellen
3. **heise.de-Artikel** einreichen
4. **Universitäten** kontaktieren
5. **Erste Community-Mitglieder** gewinnen

---

## Phase 20: Manuelle Umsetzung

### 49. Übersicht der manuellen Schritte

Diese Schritte können nicht automatisiert werden und müssen manuell durchgeführt werden.

| Schritt | Beschreibung | Priorität | Zeitbedarf |
|---------|--------------|-----------|------------|
| 1 | Mastodon-Account einrichten | Hoch | 1 Stunde |
| 2 | Blog-Beiträge veröffentlichen | Hoch | 2 Stunden |
| 3 | Open Collective Account erstellen | Mittel | 1 Stunde |
| 4 | Förderanträge einreichen | Hoch | 4 Stunden |
| 5 | Stiftungen anschreiben | Mittel | 2 Stunden |
| 6 | Good-First-Issues öffnen | Niedrig | 30 Minuten |
| 7 | Mit der Entwicklung beginnen | Hoch | Laufend |

### 50. Schritt 1: Mastodon-Account einrichten

**Anleitung:** `funding/open-collective-anleitung.md`

**Schritte:**
1. Mastodon-Server wählen (z.B. social.heimat-app.de oder öffentlichen Server)
2. Account erstellen
3. Bio hinzufügen:
   > "HEIMAT 2.0 – Die erste Open-Source Super App für Deutschland. 100% kostenlos, 100% datenschutzkonform, 100% community-getrieben."
4. Ersten Post veröffentlichen
5. Andere Open-Source-Projekte followen

### 51. Schritt 2: Blog-Beiträge veröffentlichen

**Vorbereitete Beiträge:** `blog/`

| # | Datei | Titel |
|---|-------|-------|
| 1 | `01-was-ist-heimat.md` | Was ist HEIMAT 2.0? |
| 2 | `02-warum-open-source.md` | Warum Open Source? |
| 3 | `03-datenschutz-als-feature.md` | Datenschutz als Feature |
| 4 | `04-erste-schritte-contributing.md` | Erste Schritte zum Contributieren |
| 5 | `05-ai-in-heimat.md` | AI in HEIMAT 2.0 |

**Schritte:**
1. Blog-Plattform einrichten (GitHub Pages oder Self-Hosted)
2. Beiträge nacheinander veröffentlichen (Woche 1-5)
3. Auf Mastodon und Reddit teilen

### 52. Schritt 3: Open Collective Account erstellen

**Anleitung:** `funding/open-collective-anleitung.md`

**Schritte:**
1. https://opencollective.com öffnen
2. Account erstellen (GitHub-Login)
3. Collective "HEIMAT" anlegen
4. Profil vervollständigen
5. Bezahlmethoden einrichten
6. GitHub-Badges einbinden

### 53. Schritt 4: Förderanträge einreichen

**Vorbereitete Anträge:** `funding/`

| Datei | Förderprogramm | Summe |
|-------|----------------|-------|
| `prototype-fund-antrag.md` | Prototype Fund (BMBF) | €50.000 |
| `bmwk-ki-antrag.md` | BMWK KI-Wettbewerb | €100.000 |

**Schritte:**
1. Anträge ausfüllen (Daten eintragen)
2. Budget kalkulieren
3. Team zusammenstellen
4. Anhänge vorbereiten
5. Absenden (Deadline prüfen!)

### 54. Schritt 5: Stiftungen anschreiben

**Vorbereitete Anschreiben:** `funding/stiftungs-anschreiben.md`

**Stiftungen:**
- Bosch Stiftung (Digitale Teilhabe)
- VW Stiftung (Mobilität)
- Telekom Stiftung (Bildung)
- Bertelsmann Stiftung (Digitalisierung)

**Schritte:**
1. Anschreiben an Stiftung anpassen
2. Ansprechpartner finden
3. E-Mail mit Anhängen senden
4. Nach 2 Wochen nachfragen

### 55. Schritt 6: Good-First-Issues öffnen

**Bestehende Issues:** #6-#10

**Schritte:**
1. Prüfen, ob Issues noch aktuell sind
2. Labels sicherstellen (`good-first-issue`)
3. Beschreibungen aktualisieren
4. Auf Reddit und Mastodon bewerben

### 56. Schritt 7: Mit der Entwicklung beginnen

**Nächste Schritte:**
1. **Issue #6** bearbeiten: Flutter-Projektstruktur einrichten
2. **Issue #7** bearbeiten: Node.js Backend-Grundstruktur
3. **Issue #8** bearbeiten: Docker-Grundkonfiguration
4. CI/CD testen
5. Ersten Commit machen

**Empfohlene Reihenfolge:**
1. Flutter-App initialisieren
2. Backend-Grundstruktur erstellen
3. Docker-Setup konfigurieren
4. OSM-Komponente implementieren
5. Erste Tests schreiben

---

## Zusammenfassung aller Phasen

| Phase | Status |
|-------|--------|
| 1-6 | Planung ✅ |
| 7 | Repository-Setup ✅ |
| 8 | AI-Integration ✅ |
| 9 | Community-Setup ✅ |
| 10-13 | Marketing ✅ |
| 14-18 | Fördermittel ✅ |
| 19 | Abschlussdokumentation ✅ |
| **20** | **Manuelle Umsetzung** ✅ |

**Status:** 🟢 ALLE AUTOMATISCHEN PHASEN ABGESCHLOSSEN
**Letztes Update:** Juli 2026

---

## Aktueller Stand (Juli 2026)

### Features — implementiert & funktional

| Feature | Status | Details |
|---------|--------|---------|
| **Mobilität: Karte** | ✅ | OpenStreetMap via Flutter Map, echte Haltestellen via Overpass API |
| **Mobilität: ÖPNV** | ✅ | transitous.org (MOTIS 2 API) — Abfahrten, Verbindungen, Echtzeit-Daten |
| **Mobilität: Routing** | ✅ | OSRM für Fuß/Auto, RAPTOR für ÖPNV (GTFS-basiert) |
| **Mobilität: GPS** | ✅ | echte GPS-Position via geolocator |
| **Finanzen: P2P** | ✅ | Echter GNU Taler Exchange (exchange.demo.taler.net), Ed25519-Wallet-Identity, Bank-Wire-only Reserve-Workflow |
| **Gesundheit: Ärzte** | ✅ | Overpass-Ärzte + registrierte Ärzte (DB) |
| **Gesundheit: Termine** | ✅ | Terminbuchung mit verfügbaren Slots |
| **Gesundheit: Registrierung** | ✅ | POST /api/health/doctors + Flutter-Formular |
| **AI: Intent-Klassifikation** | ✅ | Natural BayesClassifier (offline, deutsch) |
| **AI: Disruption-Analyse** | ✅ | transitous.org Alerts + Text-Parsing |
| **AI: Personal Routing** | ✅ | RAPTOR + Präferenz-Extraktion (regex-basiert) |
| **ML-Service** | ✅ | LightGBM Delay Predictor + Naive Bayes Budget Classifier (Fallback + Training) |
| **GTFS Stop-Matching** | ✅ | Overpass ↔ GTFS Zuordnung (haversine + Levenshtein) |
| **UX-Modernisierung** | ✅ | Theme, Shared Widgets, Navigation Pill-Indicator |

### CI/CD

| Pipeline | Status | Letzter Lauf |
|----------|--------|-------------|
| Flutter CI (format → analyze → test) | ❌ Android-Build broken | ea04acf — `geolocator_android-4.6.2` inkompatibel mit Flutter 3.24.5 |
| Backend CI (lint → test → tsc) | ❌ `npm install` ERESOLVE | ea04acf — TypeScript 7 inkompatibel mit @typescript-eslint 8.x |
| Web-Deploy (GitHub Pages) | ✅ automatisch | — |
| Render Backend Deploy | ✅ automatisch | — |

### Deployment

| Komponente | URL | Status |
|------------|-----|--------|
| Backend | https://heimat-backend.onrender.com | ✅ live |
| Frontend (Web) | https://abatn.github.io/HEIMAT/ | ✅ live |
| DB | Supabase (PostgreSQL 15) | ✅ live |
| Redis | Render Free-Tier | ✅ live |

### Bekannte Einschränkungen

1. **Taler-Exchange-Client (echter exchange.demo.taler.net)** (Phase 18 erledigt) — Bank-Wire-Workflow über `bank.demo.taler.net/webui`
2. **Kein User-Auth** — bcryptjs/jsonwebtoken in package.json aber ungenutzt
3. **CORS** — auf GitHub Pages Origin beschränkt (nicht `*`)
4. **Rate-Limiter** — 100 req/15min global (kann bei vielen API-Calls pro Screen limitieren)
5. **ML-Service** — nur Statistical/Keyword-Fallback, keine echten Trainingsdaten

### Test-Abdeckung

| Bereich | Tests | Details |
|---------|-------|---------|
| Backend Mobility | 12 | stops, route, geocode, departures, journey, raptor, log-delay, match |
| Backend Health | 10 | doctors, nearby, register, slots, appointments |
| Backend Finance | 12 | wallet, balance, pay, transactions, taler config, purse lifecycle |
| Flutter Widget | 9 | Theme, Colors, Screens (Mobility, Finance, Health), Widgets |
| Flutter Smoke | 12 | Screen-Rendering, Provider, EmptyState, SkeletonLoader, AppConfig |
| **Gesamt** | **55** | |

### Nächste Schritte (priorisiert)

1. **🔴 CI-Reparatur: Flutter Android-Build fixen** — `flutter.yml` Gradle-Patch für `flutter.compileSdkVersion` in Subprojekten
2. **🔴 CI-Reparatur: Backend `npm install` fixen** — TypeScript auf `~5.6.3` zurück, @typescript-eslint auf `^7.18.0`
3. **User-Auth implementieren** — JWT-basiert, bcryptjs für Passwörter
4. **Zod-Validierung** — Input-Validierung mit dem bereits installierten Package
5. **API-Dokumentation** — Swagger/OpenAPI für alle Endpoints
6. **Echte Taler-Exchange** — Anbindung an `exchange.demo.taler.net`
7. **E2E-Tests** — Flutter Integration Tests

---

## Architecture-Analyse (aus Fehleranalyse)

### Daten-Pipeline-Problem
```
PostgreSQL (DECIMAL) → Node.js pg (String) → JSON (String) → Flutter (.toDouble() scheitert)
```

### Fehler
```
NoSuchMethodError: 'toDouble' Dynamic call of null. Receiver: "52.52190000"
```

### Ursache
- PostgreSQL gibt DECIMAL als Strings zurück
- Node.js pg gibt diese Strings weiter
- Flutter erwartet Numbers

### Korrekte Lösung
- Frontend: `double.parse(json['latitude'].toString())` verwenden
- Oder: Backend: Daten-Typen ändern
- Empfehlung: Frontend-Fix (einfachster Weg)

### Nächste Schritte
1. mobility_provider.dart fixen
2. finance_provider.dart fixen
3. health_provider.dart fixen
4. App testen

---

## Mobilitäts-Feature: Fehleranalyse & Bugfix-Plan (Juli 2026)

### Identifizierte Bugs

| # | Schwere | Datei | Beschreibung |
|---|---------|-------|-------------|
| 1 | **KRITISCH** | `mobility_provider.dart:294` | Journey-Parameter-Mismatch: Frontend sendet `?from=lat,lng&to=lat,lng`, Backend erwartet `?from_lat=&from_lng=&to_lat=&to_lng=` → Verbindungssuche IMMER leer |
| 2 | **KRITISCH** | `departure_board.dart:43`, `journey_planner.dart:57` | ISO-Datum falsch geparsed: `split(':')` auf `"2025-07-22T14:30:00+02:00"` → angezeigt wird `"2025-07-22T14:30"` statt `"14:30"` |
| 3 | **MITTEL** | `mobility_screen.dart:33` | Kein GPS: App startet immer in Berlin (hartkodiert), kein Standort-Request |
| 4 | **MITTEL** | `dbRestService.ts:246` | Keine Linienfarben: `NormalizedLeg` liefert kein `route_color` → immer grau |
| 5 | **NIEDRIG** | `mobility.ts:107-141` | Stop-Name → db-rest ID Mapping fragil: Overpass-Name passt nicht zu db-rest-Suche |

### Bug-Details

**BUG 1 — Journey Planner komplett kaputt:**
```
Frontend sendet:  /api/mobility/journey?from=52.52,13.40&to=52.51,13.39
Backend erwartet: /api/mobility/journey?from_lat=52.52&from_lng=13.40&to_lat=52.51&to_lng=13.39
```
→ `req.query.from_lat` ist `undefined` → Exception → catch gibt `{ journeys: [] }` zurück → "Keine Verbindungen gefunden" IMMER.

**BUG 2 — Zeit-Anzeige hässlich:**
Dart `String.split(':')` auf `"2025-07-22T14:30:00+02:00"` ergibt `["2025-07-22T14", "30", "00+02", "00"]`. `.take(2).join(':')` → `"2025-07-22T14:30"`.

**BUG 3 — Kein GPS:**
`_startLocation = const LatLng(52.5200, 13.4050)` — jeder User startet in Berlin.

**BUG 4 — Graue Linienbadges:**
Backend `NormalizedLeg` hat kein `route_color`. Frontend fällt immer auf `#6B7280` (grau) zurück.

### Fix-Plan

| # | Datei | Fix |
|---|-------|-----|
| 1 | `mobility_provider.dart:294` | `from=$lat,$lng` → `from_lat=$lat&from_lng=$lng&to_lat=$lat&to_lng=$lng` |
| 2 | `departure_board.dart` + `journey_planner.dart` | `DateTime.parse(iso).hour:minute` statt `split(':')` |
| 3 | `mobility_screen.dart` | `geolocator` Package für echte GPS-Position |
| 4 | `dbRestService.ts` + `NormalizedLeg` | `route_color` aus `line.product` mappen (bus=#1B5E20, tram=#E65100, etc.) |
| 5 | `mobility.ts` | Fallback: Koordinaten direkt an db-rest `/locations` senden statt Overpass-ID |

---

## CORS/helmet-Bug: "Haltestellen konnten nicht geladen werden" (Juli 2026)

### Fehler
User sieht: "Haltestellen konnten nicht geladen werden" im Web-Browser.

### Ursache
`helmet()` mit Default-Einstellungen setzt:
```
cross-origin-resource-policy: same-origin
cross-origin-opener-policy: same-origin
```
→ Browser blockiert das Lesen der API-Response vom fremden Origin (`abatn.github.io` → `heimat-backend.onrender.com`).
→ CORS erlaubt den Request (`access-control-allow-origin: *`), aber **CORP blockiert die Antwort**.

### Fix
`src/backend/src/index.ts:25` — helmet()-Konfiguration anpassen:
```typescript
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
```

### Status
- Backend API funktioniert (curl zeigt 30 Haltestellen)
- CI/CD: alle grün ✅
- **Nächster Schritt:** Fix umsetzen, deployen, testen

---

## transitous.org Migration: db-rest / db-vendo-client ersetzt (Juli 2026)

### Problem
db-rest (Docker auf Render) antwortet nie korrekt (Port-Mismatch, App startet nicht).
db-vendo-client (Vendo API) geblockt von DB (OPS_BLOCKED, 403 von allen IPs).
Kein einziger ÖPNV-Endpoint liefert echte Daten.

### Lösung: transitous.org (MOTIS 2 API)
- Frei nutzbar, community-getrieben, GTFS-Daten aus VBB/Deutschland
- Endpoints: `/map/stops` (naheliegende Haltestellen), `/stoptimes` (Abfahrten), `/plan` (Verbindungen)
- Kein Token, kein Auth, CORS-freundlich

### Architektur (aktuell)
```
Frontend (Flutter)
  → DepartureBoard: sendet lat/lng → Backend /departures?lat=&lng=
  → JourneyPlanner: sendet Koordinaten → Backend /journey?from_lat=&from_lng=&to_lat=&to_lng=
  → Map: Overpass-API (lokale Stops, OSM-IDs)

Backend (Render, Port 3000)
  → dbVendoService.ts: transitous.org via fetch()
  → /departures: searchStopsByCoords → /map/stops → getDepartures → /stoptimes
  → /journey: /plan mit Koordinaten → NormalizedJourney

transitous.org (MOTIS 2)
  → /api/v1/map/stops?min=lat,lng&max=lat,lng
  → /api/v1/stoptimes?stopId=...&n=30
  → /api/v1/plan?fromPlace=lat,lng&toPlace=lat,lng&numItineraries=3
```

### Status
- `dbVendoService.ts`: transitous.org Integration ✅
- `db-vendo-client` Dependency entfernt ✅
- `Dockerfile.db-rest` + db-rest Render-Service gelöscht ✅
- Departures funktionieren mit Koordinaten ✅
- Journeys mit echten Daten + Farben ✅
- **Offen:** UTC→MESZ Zeitkonvertierung (s.u.)

---

## Abfahrtsboard: "Keine Abfahrten gefunden" (Juli 2026)

### Fehler
User klickt auf Haltestelle → "Abfahrten anzeigen" → "Keine Abfahrten gefunden".

### Root Cause: 3-stufiger Parameter-Mismatch

```
Frontend:  DepartureBoard.show(context, stop.name)           ← nur Name!
           → loadDepartures("S Hackescher Markt")
             → GET /departures?stop=S+Hackescher+Markt       ← param "stop"
               → Backend: const { stopId, lat, lng } = query  ← liest "stopId"
                 → stopId=undefined → LEER
```

### Fix (committet: 87cf284)
- `mobility_screen.dart:644`: `DepartureBoard.show(context, stop.name, stop.latitude, stop.longitude)`
- `departure_board.dart:12-13`: `show()` nimmt lat/lng, ruft `loadDepartures(lat:, lng:)`
- `mobility_provider.dart:259,266`: `loadDepartures({required double lat, required double lng})` → `?lat=...&lng=...`

### Status
- Fix committet + deployed ✅
- Live getestet: 30 Abfahrten mit Koordinaten ✅

---

## RouteColor immer grau (Juli 2026)

### Fehler
Linienbadges immer grau (#6B7280) statt Farbig.

### Root Cause
Backend sendet `routeColor` (camelCase), Frontend liest `json['route_color']` (snake_case).

### Fix (committet: 87cf284)
`mobility_provider.dart:116`: `json['routeColor'] ?? json['route_color'] ?? json['color']`

### Status
- Fix committet + deployed ✅
- Live: U5=#7e5330, S5=#eb7405 ✅

---

## Zeit-Anzeige: UTC statt MESZ (Juli 2026 — AKTUELL)

### Fehler
Zeiten im Mobilitäts-Feature zeigen UTC statt deutsche Zeit (MESZ = UTC+2).

### Root Causes

**1. Backend `formatTime()` nutzt UTC:**
```typescript
// dbVendoService.ts:116-120
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
```
→ Transitous liefert `"2026-07-22T15:09:00Z"` (UTC) → `getUTCHours()` = 15 → angezeigt: "15:09"
→ Richtig (MESZ): "17:09"

**2. Journey-Legs haben Roh-ISO statt formatierte Zeit:**
```typescript
originPlannedDeparture: l.scheduledStartTime || undefined,   // "2026-07-22T15:09:00Z"
```
→ Frontend speichert ISO-String → `_formatTime()` parsed als UTC → falsche Zeit

**3. Journey `departure`/`arrival` sind leer:**
→ `formatTime(firstDep)` wird aufgerufen, aber Response zeigt `departure=''`
→ Vermutlich: Render-Deploy nicht synchron (Backend CI fehlgeschlagen für vorherigen Commit)

### Fix-Plan

| # | Datei | Fix |
|---|-------|-----|
| 1 | `dbVendoService.ts:116-120` | `formatTime()` → `toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })` |
| 2 | `dbVendoService.ts:277-278` | Journey-Legs: `formatTime(l.scheduledStartTime)` statt roher ISO |
| 3 | `departure_board.dart` + `journey_planner.dart` | `_formatTime()` Fallback für bereits formatierte "HH:MM" Strings |

### Verifizierung
- `curl /departures?lat=52.52&lng=13.40` → `"plannedDeparture":"17:09"` (MESZ)
- `curl /journey?from_lat=...&to_lat=...` → `"departure":"17:09"` (nicht leer)
- Frontend zeigt korrekte deutsche Zeit an

---

## Phase 30: GPS + GTFS + RAPTOR + AI Integration (Juli 2026)

### 61. Gesamtarchitektur

```
┌──────────────────────────────────────────────────────────────┐
│                     HEIMAT Backend                             │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    API Layer                           │    │
│  │  mobility.ts, admin.ts, auth.ts                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                           │                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Service Layer                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ raptor-     │  │ gtfs-       │  │ dbVendo-    │  │    │
│  │  │ Service     │  │ Service     │  │ Service     │  │    │
│  │  │ (Node.js)   │  │ (PostgreSQL)│  │ (Fallback)  │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                           │                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   AI Layer                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ Intent      │  │ Disruption  │  │ Personal    │  │    │
│  │  │ Classifier  │  │ Agent       │  │ Agent       │  │    │
│  │  │ (GPT-4.1)   │  │ (LLM)       │  │ (RAG)       │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                           │                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Data Layer                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ GTFS-Datei  │  │ PostgreSQL  │  │ Redis       │  │    │
│  │  │ (in-memory) │  │ (Stops)     │  │ (Cache)     │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 62. Forschung: Open-Source-Projekte als Referenz

#### AI + Transit Integration

| Projekt | Tech | Ansatz |
|---------|------|--------|
| `ChatPlanner` (Paper) | LLM + MC-RAPTOR | Persönliches Routing über natürliche Sprache |
| `transit-foundation-model` | Qwen2.5 fine-tuned | 1.5B Modell für GTFS-Fragen |
| `LISBOA_MultiAgentSystem` | LangGraph + 6 Agents | Multi-Agent für Tourismus + Mobilität |
| `gtfs-mcp` | MCP Server | 6000+ GTFS Feeds weltweit |
| `MCP-Public-Transport` | MCP + Weather | Wetter-bewusstes Routing |
| `ratisbonalyzer` | DuckDB + Ollama | Lokale Analyse + Chat |
| `TransitGPT` | LLM + GTFS | Code-Generierung für GTFS-Analyse |

#### RAPTOR-Implementierungen

| Projekt | Sprache | Highlights |
|---------|---------|------------|
| `raptor-journey-planner` | Node.js | GTFS-Streams, MIT-Lizenz |
| `vulture` | Rust | 22µs (Delhi), 576µs (Berlin), Wheelchair |
| `blaise` | Rust | Fuzzy-Suche, Docker-Server |
| `minotor` | WASM/JS | Client-side, protobuf, 20MB Schweiz |

#### Flutter Transit-Apps

| Projekt | Architektur | Features |
|---------|-------------|----------|
| `trufi-core` | BLoC + Repository | OTP-Integration, Navigation |
| `kago` | Clean BLoC | Cloudflare Worker Proxy |
| `oasth-flutter` | A* Routing | geolocator, flutter_map |
| `ankarota` | Riverpod | Google Directions API |

### 63. Phase 1: GPS-Integration mit geolocator

**Status:** ✅ Abgeschlossen (Juli 2026)
**Abhängigkeiten:** Keine
**Dateien:** 4

#### Architektur
```
User öffnet App
  → LocationService.getCurrentLocation()
    → geolocator: Permission prüfen → GPS-Position
    → Bei Erfolg: echte Koordinaten
    → Bei Fehler/Permission-Deny: Berlin-Fallback
  → _startLocation = echte Koordinaten oder Berlin
  → Alles andere funktioniert automatisch
```

#### Dateien

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `src/mobile/pubspec.yaml` | Ändern | `geolocator: ^11.0.0`, `permission_handler: ^11.0.0` |
| `src/mobile/lib/core/services/location_service.dart` | Neu | LocationService Wrapper |
| `src/mobile/lib/features/mobility/presentation/mobility_screen.dart` | Ändern | Async Init + "Locate Me" FAB |
| `.github/workflows/flutter.yml` | Ändern | Gradle-Patch für compileSdkVersion 34 |

#### location_service.dart
```dart
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class LocationService {
  static Future<LatLng?> getCurrentLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    try {
      Position position = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      return LatLng(position.latitude, position.longitude);
    } catch (e) {
      return null;
    }
  }
}
```

#### mobility_screen.dart Änderungen
```dart
// In initState():
Future<void> _initLocation() async {
  LatLng? location = await LocationService.getCurrentLocation();
  setState(() {
    _startLocation = location ?? const LatLng(52.5200, 13.4050);
  });
}

// "Locate Me" FAB:
FloatingActionButton(
  onPressed: () async {
    LatLng? loc = await LocationService.getCurrentLocation();
    if (loc != null) {
      setState(() => _startLocation = loc);
    }
  },
  child: Icon(Icons.my_location),
)
```

#### CI Gradle-Patch
```yaml
- name: Enable Android platform
  run: |
    flutter create . --platforms android
    find . -name "build.gradle" -exec sed -i 's/compileSdkVersion [0-9]*/compileSdkVersion 34/g' {} \;
    find . -name "build.gradle" -exec sed -i 's/minSdkVersion [0-9]*/minSdkVersion 21/g' {} \;
```

### 64. Phase 2: GTFS-Import erweitern

**Status:** ✅ Abgeschlossen (Juli 2026)
**Abhängigkeiten:** Phase 1 (optional)
**Dateien:** 2

#### Schema-Erweiterung
```sql
-- In schema.sql hinzufügen:
CREATE TABLE IF NOT EXISTS gtfs_transfers (
    from_stop_id VARCHAR(255) NOT NULL,
    to_stop_id VARCHAR(255) NOT NULL,
    transfer_type INTEGER DEFAULT 0,
    min_transfer_time INTEGER DEFAULT 0,
    PRIMARY KEY (from_stop_id, to_stop_id)
);

CREATE INDEX IF NOT EXISTS idx_gtfs_transfers_from ON gtfs_transfers(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_transfers_to ON gtfs_transfers(to_stop_id);
```

#### Import-Script erweitern
```typescript
// In import-gtfs-local.ts hinzufügen:
async function importTransfers(connection: pg.PoolConnection) {
  const transferPath = path.join(extractDir, 'transfers.txt');
  if (!fs.existsSync(transferPath)) return;
  
  const parser = fs.createReadStream(transferPath).pipe(
    parse({ columns: true, delimiter: ',', trim: true })
  );
  
  let count = 0;
  const batch: any[] = [];
  
  for await (const record of parser) {
    batch.push({
      from_stop_id: record.from_stop_id,
      to_stop_id: record.to_stop_id,
      transfer_type: parseInt(record.transfer_type) || 0,
      min_transfer_time: parseInt(record.min_transfer_time) || 0
    });
    
    if (batch.length >= 2000) {
      await insertTransfersBatch(connection, batch);
      count += batch.length;
      batch.length = 0;
    }
  }
  
  if (batch.length > 0) {
    await insertTransfersBatch(connection, batch);
    count += batch.length;
  }
  
  console.log(`✅ Imported ${count} transfers`);
}
```

### 65. Phase 3: RAPTOR-Service implementieren

**Status:** ✅ Abgeschlossen (Juli 2026)
**Abhängigkeiten:** Phase 2
**Dateien:** 3

#### Abhängigkeit
```bash
cd src/backend
npm install raptor-journey-planner
```

#### raptorService.ts
```typescript
import fs from 'fs';
import { loadGTFS, RaptorAlgorithmFactory, DepartAfterQuery, JourneyFactory } from 'raptor-journey-planner';

class RaptorService {
  private static instance: RaptorService;
  private raptor: any = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): RaptorService {
    if (!RaptorService.instance) {
      RaptorService.instance = new RaptorService();
    }
    return RaptorService.instance;
  }

  async initialize(gtfsPath: string): Promise<void> {
    if (this.initialized) return;
    
    console.log('🔄 Loading GTFS data for RAPTOR...');
    const stream = fs.createReadStream(gtfsPath);
    const [trips, transfers, interchange] = await loadGTFS(stream);
    this.raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange);
    this.initialized = true;
    console.log('✅ RAPTOR initialized');
  }

  async findJourneys(from: string, to: string, departureTime: Date): Promise<any[]> {
    if (!this.initialized) throw new Error('RAPTOR not initialized');
    
    const query = new DepartAfterQuery(this.raptor, new JourneyFactory());
    const journeys = query.plan(from, to, departureTime, 14 * 60 * 60);
    return journeys.slice(0, 3);
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export default RaptorService.getInstance();
```

#### Serverstart (index.ts)
```typescript
import raptorService from './services/raptorService';

const gtfsPath = path.join(__dirname, '../data/gtfs-germany.zip');
if (fs.existsSync(gtfsPath)) {
  await raptorService.initialize(gtfsPath);
}
```

#### mobility.ts Route
```typescript
router.get('/journey/raptor', async (req, res) => {
  if (!raptorService.isReady()) {
    return fallbackToTransitous(req, res);
  }
  
  try {
    const journeys = await raptorService.findJourneys(
      req.query.from as string,
      req.query.to as string,
      new Date(req.query.departureTime as string)
    );
    res.json(journeys.map(normalizeRaptorJourney));
  } catch (error) {
    return fallbackToTransitous(req, res);
  }
});
```

### 66. Phase 4: AI-Intent-Klassifikation

**Status:** 🔧 In Arbeit (Juli 2026)
**Abhängigkeiten:** Keine
**Dateien:** 2

#### aiService.ts
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface UserIntent {
  type: 'journey' | 'departure' | 'disruption' | 'nearby' | 'info';
  origin?: string;
  destination?: string;
  time?: string;
  lines?: string[];
  preferences?: string[];
}

export async function classifyIntent(userMessage: string): Promise<UserIntent> {
  const prompt = `
    Klassifiziere die Benutzeranfrage und extrahiere die Struktur:
    
    Nachricht: "${userMessage}"
    
    Antwort im JSON-Format:
    {
      "type": "journey|departure|disruption|nearby|info",
      "origin": "Abfahrtshaltestelle",
      "destination": "Zielhaltestelle",
      "time": "Zeitangabe",
      "lines": ["Linien"],
      "preferences": ["Präferenzen"]
    }
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### 67. Phase 5: AI-Disruption-Agent

**Status:** 🔧 In Arbeit (Juli 2026)
**Abhängigkeiten:** Keine
**Dateien:** 2

#### disruptionAgent.ts
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Disruption {
  affected_stops: string[];
  affected_lines: string[];
  timeframe: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  alternatives: string[];
}

export async function analyzeDisruptions(alerts: string[]): Promise<Disruption[]> {
  const prompt = `
    Analysiere die folgenden ÖPNV-Störungen und strukturiere sie:
    
    ${alerts.join('\n---\n')}
    
    Für jede Störung:
    1. Betroffene Haltestellen
    2. Betroffene Linien
    3. Zeitraum
    4. Schweregrad (high/medium/low)
    5. Beschreibung
    6. Alternative Verbindungen
    
    Antwort als JSON-Array:
    [{
      "affected_stops": ["..."],
      "affected_lines": ["U1", "S2"],
      "timeframe": "2026-07-22 08:00-12:00",
      "severity": "high",
      "description": "...",
      "alternatives": ["..."]
    }]
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}

export async function getDisruptionsFromTransitous(): Promise<string[]> {
  const response = await fetch('https://api.transitous.org/api/v1/alerts');
  const data = await response.json();
  return data.alerts?.map((a: any) => a.description) || [];
}
```

### 68. Phase 6: AI-Personal-Routing

**Status:** 🔧 In Arbeit (Juli 2026)
**Abhängigkeiten:** Phase 3 (RAPTOR)
**Dateien:** 2

#### personalRoutingAgent.ts
```typescript
import OpenAI from 'openai';
import raptorService from './raptorService';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PersonalPreferences {
  preferFewerTransfers: boolean;
  preferShorterWalk: boolean;
  wheelchairAccessible: boolean;
  preferQuiet: boolean;
  preferScenic: boolean;
}

export async function personalRoutePlanning(
  userRequest: string,
  origin: string,
  destination: string
): Promise<any[]> {
  const preferences = await extractPreferences(userRequest);
  
  const routes = await raptorService.findJourneys(
    origin,
    destination,
    new Date()
  );
  
  return await rankRoutesWithAI(routes, preferences);
}

async function extractPreferences(userRequest: string): Promise<PersonalPreferences> {
  const prompt = `
    Extrahiere die Reisepräferenzen aus der Nachricht:
    "${userRequest}"
    
    Antworte im JSON-Format:
    {
      "preferFewerTransfers": true/false,
      "preferShorterWalk": true/false,
      "wheelchairAccessible": true/false,
      "preferQuiet": true/false,
      "preferScenic": true/false
    }
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}

async function rankRoutesWithAI(routes: any[], preferences: PersonalPreferences): Promise<any[]> {
  const prompt = `
    Bewerte und sortiere die Verbindungen basierend auf den Präferenzen:
    Präferenzen: ${JSON.stringify(preferences)}
    Verbindungen: ${JSON.stringify(routes)}
    Sortiere nach Relevanz und gib die top 3 zurück.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### 69. Integrationsmatrix

| Phase | Neue Dateien | Geänderte Dateien | Abhängigkeiten |
|-------|--------------|-------------------|----------------|
| **1. GPS** | `location_service.dart` | `pubspec.yaml`, `mobility_screen.dart`, `flutter.yml` | `geolocator`, `permission_handler` |
| **2. GTFS** | - | `schema.sql`, `import-gtfs-local.ts` | - |
| **3. RAPTOR** | `raptorService.ts` | `index.ts`, `mobility.ts` | `raptor-journey-planner` |
| **4. AI-Intent** | `aiService.ts` | `mobility.ts` | `openai` |
| **5. AI-Disruption** | `disruptionAgent.ts` | `mobility.ts` | `openai` |
| **6. AI-Personal** | `personalRoutingAgent.ts` | `mobility.ts` | `openai`, RAPTOR |

### 70. Implementierungsreihenfolge

1. **Phase 1 (GPS)** — Unabhängig, sofort testbar, keine Backend-Änderungen
2. **Phase 2 (GTFS-Import)** — Voraussetzung für Phase 3
3. **Phase 3 (RAPTOR)** — Kernfunktionalität für lokales Routing
4. **Phase 4-6 (AI)** — Erweiterungen, können parallel laufen

### 71. Fallback-Strategie

```
Anfrage → Versuche RAPTOR (lokal)
           ↓ Fehler/kein GTFS?
         Versuche transitous.org (Fallback)
           ↓ Fehler?
         Leere Antwort + Fehlermeldung
```

### 72. Nächste Schritte

1. ✅ Phase 1 – GPS-Integration (geolocator)
2. ✅ Phase 2 – GTFS-Import erweitern (transfers.txt)
3. ✅ Phase 3 – RAPTOR-Service (raptor-journey-planner)
4. ✅ Phase 4 – AI-Intent-Klassifikation (aiService.ts)
5. ✅ Phase 5 – AI-Disruption-Agent (disruptionAgent.ts)
6. ✅ Phase 6 – AI-Personal-Routing (personalRoutingAgent.ts)
7. ✅ Phase 7 – Testen & Deployen
8. ✅ Phase 8 – Sicherheits-Criticals (Admin-Key, CORS, migrate-Endpoint)
9. ✅ Phase 9 – Echte Health-Checks (DB/Redis Ping)
10. ✅ Phase 10 – Docker nginx.conf + Healthchecks
11. ✅ Phase 11 – ML-Service echte Modelle (LightGBM + Naive Bayes)
12. ✅ Phase 12 – GTFS Stop-Matching (Overpass ↔ GTFS)
13. ✅ Phase 13 – Backend-Tests erweitern (55 Tests)
14. ✅ Phase 14 – Flutter Tests (21 Tests)
15. ✅ Phase 15 – User-Auth (authService, auth-Middleware, auth-Routes, users-Tabelle)
16. ✅ Phase 16 – Zod-Validierung (validate.ts + schemas.ts + 30+ Tests)
17. ✅ Phase 17 – API-Dokumentation (Swagger + swagger-ui-express + OpenAPI 3.0)
18. ✅ Phase 18 – Echte Taler-Exchange (abgeschlossen) — echter Ed25519-Wallet-Identity, echte `/keys` + `/reserves/<pub>` Calls gegen exchange.demo.taler.net, Wire-Spec-konform gegen echte GNU-Taler-Production-Software. Siehe `src/backend/src/services/talerExchangeClient.ts` und `talerService.ts`.
19. ✅ Phase 19 – E2E-Tests (voller User-Lifecycle: Auth + Mobility + Health + Finance + Swagger + Fehlerbehandlung)

---

## Phase 21: CI-Reparatur (Juli 2026)

### Problem 1: Flutter CI Android-Build

`geolocator_android-4.6.2` nutzt `(flutter.compileSdkVersion as int)` in build.gradle. Flutter 3.24.5 stellt die `flutter` extension NICHT für Library-Subprojekte bereit. Alle Downgrade-Versuche (14→13→11.1.0→10.1.0) scheiterten, weil das Problem im Gradle-Subproject-Scope liegt.

**Fix in `flutter.yml` — `Enable Android platform`:**
```yaml
# Java 17 target
sed -i 's/VERSION_11/VERSION_17/g' app/build.gradle
# Hardcode SDK versions
sed -i 's/compileSdk .*/compileSdk 34/' app/build.gradle
sed -i 's/minSdk .*/minSdk 21/' app/build.gradle
sed -i 's/targetSdk .*/targetSdk 34/' app/build.gradle
# Globale flutter extension für Subprojekte (geolocator_android Fix)
cat >> build.gradle << 'GRADLE_EOF'

subprojects {
    project.ext.flutter = [compileSdkVersion: 34]
}
GRADLE_EOF
```

### Problem 2: Backend CI `npm install` ERESOLVE

Dependabot bumped `typescript` `~5.6.3` → `^7.0.2` und `@typescript-eslint/*` `^7.18.0` → `^8.65.0`. `@typescript-eslint/eslint-plugin@8.65.0` benötigt `typescript@>=4.8.4 <6.1.0` — inkompatibel mit TS 7.

**Fix in `package.json`:**
```json
"@typescript-eslint/eslint-plugin": "^7.18.0",
"@typescript-eslint/parser": "^7.18.0",
"typescript": "~5.6.3"
```

### Problem 3: Dependabot-Auto-Merge verursacht Kaskaden-Fehler

`dependabot-auto-merge.yml` merged minor-updates automatisch. Mehrere parallel gemergte Updates (TS 5→7, eslint 6→8, zod 3→4, etc.) erzeugen inkompatible Abhängigkeitsketten.

**Fix:** Kein Code-Fix — erfordert Process-Änderung. `dependabot-auto-merge.yml` sollte keine semver-minor für Dev-Dependencies automatisch mergen, oder einen `needs: [ci]` Gate hinzufügen.
