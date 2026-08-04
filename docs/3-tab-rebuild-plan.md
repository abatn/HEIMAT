# HEIMAT 2.0 — 3-Tab-Rebuild (WeChat-Muster)

**Erstellt:** 2026-08-04 | **Status:** Planung | **Version:** v1.0

---

## 🎯 Ziel

Umbau der Flutter-App von 5 Tabs auf 3 Tabs, orientiert an WeChat's Super-App-Muster:
- **Startseite** (Dashboard + Alerts + Briefing)
- **Dienste** (Kategorisierte Services)
- **Profil** (User-Info + Settings)

---

## 📊 Aktueller Stand vs. Ziel

### Heute (5 Tabs)
```
┌──────────┬──────────┬──────────┬──────────┬──────────────┐
│  🏠 HOME │ 📱 APPS  │ 🚗 MOB.  │ 🏥 GES.  │ 💰 FINANZ   │
│ Dashboard│ 15 Apps  │ Routing  │ Ärzte    │ Taler        │
│ Stats    │ (flach)  │ ÖPNV     │ Triage   │ Wallet       │
│ Quick    │          │          │ Medika-  │              │
│ Actions  │          │          │ mente    │              │
│ "Neue    │          │          │ Mental   │              │
│ Features"│          │          │ Health   │              │
└──────────┴──────────┴──────────┴──────────┴──────────────┘
```

### Ziel (3 Tabs — WeChat-Muster)
```
┌──────────────────┬──────────────────┬────────────────────┐
│  🏠 STARTSEITE   │  🔍 DIENSTE      │  👤 PROFIL         │
├──────────────────┼──────────────────┼────────────────────┤
│ Greeting         │ 🔍 Suche         │ Avatar             │
│ Dashboard        │ Häufig benutzt   │ Name               │
│ Smart Alerts     │ 🚗 Mobilität     │ Einstellungen      │
│ Daily Briefing   │ 🏥 Gesundheit    │ Verlauf            │
│ Letzte benutzt   │ 🏠 Alltag        │ Notfall            │
│ Empfehlungen     │ 🎪 Kultur        │ Abmelden           │
│ AI-Chat入口      │ 💰 Finanzen      │                    │
└──────────────────┴──────────────────┴────────────────────┘
```

---

## 📋 Implementierungsphasen

### PHASE 0: Vorbereitung (30min)

**Ziel:** CI-Grünes Confirmen VOR dem Refactor.

| Schritt | Befehl | Erwartung |
|---------|--------|-----------|
| 0.1 | `flutter analyze lib/` | 0 errors |
| 0.2 | `flutter test` | Alle grün |
| 0.3 | CI-Status prüfen | Alle Workflows grün |

```
Commit: "chore: pre-refactor CI confirm — alles gruen vor 3-Tab-Rebuild"
```

---

### PHASE 1: Navigation-Shell (1-2h)

**Ziel:** 5 Tabs → 3 Tabs in `main.dart`.

#### Datei: `src/mobile/lib/main.dart`

**Änderung 1: Imports (Zeilen 14-20)**

```dart
// VORHER:
import 'features/mobility/presentation/mobility_screen.dart';
import 'features/finance/presentation/finance_screen.dart';
import 'features/health/presentation/health_screen_with_tabs.dart';
import 'features/miniprogram/presentation/launchpad_screen.dart';

// NACHHER:
import 'features/services/services_screen.dart';      // NEU
import 'features/profile/profile_screen.dart';        // NEU
// mobility_screen, finance_screen, health_screen_with_tabs
// werden NICHT mehr direkt importiert — nur noch via ServiceRegistry
```

**Änderung 2: _screens Array (Zeile 167-172)**

```dart
// VORHER:
List<Widget> get _screens => [
      HomeScreen(onNavigateTab: (index) => setState(() => _currentIndex = index)),
      const MobilityScreen(),
      const FinanceScreen(),
      const HealthScreenWithTabs(),
      const LaunchpadScreen(),
    ];

// NACHHER:
List<Widget> get _screens => [
      HomeScreen(onNavigateTab: (index) => setState(() => _currentIndex = index)),
      const ServicesScreen(),    // NEU: Kategorisierter Dienste-Tab
      const ProfileScreen(),     // NEU: Profil-Tab
    ];
```

**Änderung 3: NavigationBar (Zeilen 213-245)**

```dart
// VORHER: 5 NavigationDestination
destinations: const [
  NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Dashboard'),
  NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Mobilität'),
  NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), ...),
  NavigationDestination(icon: Icon(Icons.local_hospital_outlined), ...),
  NavigationDestination(icon: Icon(Icons.apps_outlined), ...),
],

// NACHHER: 3 NavigationDestination
destinations: const [
  NavigationDestination(
    icon: Icon(Icons.home_outlined),
    selectedIcon: Icon(Icons.home),
    label: 'Startseite',
  ),
  NavigationDestination(
    icon: Icon(Icons.grid_view_outlined),
    selectedIcon: Icon(Icons.grid_view),
    label: 'Dienste',
  ),
  NavigationDestination(
    icon: Icon(Icons.person_outline),
    selectedIcon: Icon(Icons.person),
    label: 'Profil',
  ),
],
```

**Änderung 4: Provider-Registrierung (Zeilen 75-120)**

```dart
// KEINE ÄNDERUNG — alle Provider bleiben registriert.
// Die Screens werden jetzt via ServiceRegistry aufgerufen,
// aber die Provider müssen weiterhin im MultiProvider leben.
```

```
Commit: "refactor(nav): 5 Tabs → 3 Tabs (WeChat-Muster) — Startseite, Dienste, Profil"
```

---

### PHASE 2: Services-Screen (2-3h)

**Ziel:** `launchpad_screen.dart` wird zu `services_screen.dart` umgebaut.

#### Datei: NEU `src/mobile/lib/features/services/services_screen.dart`

**Struktur:**
```dart
class ServicesScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildSearchBar(),          // Globale Suche (oben)
        Expanded(
          child: ListView(
            children: [
              _buildFrequentlyUsed(), // "Häufig benutzt" (horizontal)
              _buildCategorySection('🚗', 'Mobilität', ['routing', 'parking', 'ev_charging']),
              _buildCategorySection('🏥', 'Gesundheit', ['health', 'checkin']),
              _buildCategorySection('🏠', 'Alltag', ['weather', 'air', 'waste', 'buergeramt', 'jobs']),
              _buildCategorySection('🎪', 'Kultur & Reise', ['events', 'hotels']),
              _buildCategorySection('💰', 'Finanzen', ['finance']),
            ],
          ),
        ),
      ],
    );
  }
}
```

**Hilfs-Widgets:**
```dart
Widget _buildCategorySection(String emoji, String title, List<String> serviceIds) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Text('$emoji $title', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      ),
      ...serviceIds.map((id) => _buildServiceTile(id)),
    ],
  );
}

Widget _buildServiceTile(String serviceId) {
  final service = ServiceRegistry.instance.lookup(serviceId);
  if (service == null) return SizedBox.shrink();
  return ListTile(
    leading: Icon(service.icon),
    title: Text(service.name),
    subtitle: Text(service.description),
    trailing: Icon(Icons.chevron_right),
    onTap: () => Navigator.push(context, MaterialPageRoute(
      builder: (_) => service.nativeBuilder(context),
    )),
  );
}
```

**Datei: LÖSCHEN/OUMBENENNEN** `launchpad_screen.dart`

```dart
// VORHER: LaunchpadScreen (15 Mini-Programme im Grid)
// NACHHER: Gelöscht — ersetzt durch ServicesScreen
// ACHTUNG: launchpad_screen.dart wird in main.dart importiert — muss entfernt werden
```

```
Commit: "feat(services): ServicesScreen mit Kategorien — ersetzt LaunchpadScreen"
```

---

### PHASE 3: Profile-Screen (1-2h)

**Ziel:** Neuer Profil-Tab mit User-Info, Settings, Verlauf.

#### Datei: NEU `src/mobile/lib/features/profile/profile_screen.dart`

**Struktur:**
```dart
class ProfileScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        _buildUserHeader(),      // Avatar + Name + Email
        _buildSettingsSection(), // Einstellungen
        _buildHistorySection(),  // Verlauf
        _buildEmergencySection(),// Notfall
        _buildLogoutButton(),    // Abmelden
      ],
    );
  }
}
```

**Features:**
- User-Avatar (initials oder Bild)
- Name + E-Mail aus AuthProvider
- Settings (Benachrichtigungen, Sprache, Datenschutz)
- Verlauf (letzte Aktivitäten aus HomeProvider)
- Notfall-Kontakt (112, 116117)
- Abmelden (aus AuthProvider)

```
Commit: "feat(profile): ProfileScreen — User-Info, Settings, Verlauf, Notfall"
```

---

### PHASE 4: Startseite umbauen (2-3h)

**Ziel:** HomeScreen wird zur intelligenten Startseite mit Kontext.

#### Datei: `src/mobile/lib/features/home/presentation/home_screen.dart`

**Änderung 1: "Neue Features" Karte entfernen (Zeilen 419-490)**

```dart
// VORHER: _buildNewFeaturesCard mit Alerts, Suche, Briefing
// NACHHER: Gelöscht — diese Features wandern in den Haupt-Content
```

**Änderung 2: Neuer Content-Aufbau**

```dart
// VORHER:
children: [
  _buildGreetingCard(home),
  _buildServiceSnapshots(home),
  _buildQuickStats(home),
  _buildQuickActions(home),
  _buildNewFeaturesCard(home),    // ← ENTFERNEN
  _buildSuggestionsSection(home),
]

// NACHHER:
children: [
  _buildGreetingCard(home),           // Begrüßung (bleibt)
  _buildServiceSnapshots(home),       // Dashboard-Karten (bleibt)
  _buildSmartAlertsSection(home),     // NEU: Alerts direkt sichtbar
  _buildDailyBriefingSection(home),   // NEU: Briefing direkt sichtbar
  _buildRecentlyUsedSection(home),    // NEU: Zuletzt benutzt
  _buildRecommendedSection(home),     // NEU: Empfehlungen
  _buildAiChat入口(home),             // NEU: AI-Chat immer erreichbar
]
```

**Änderung 3: HomeProvider erweitern**

```dart
// NEU: Methoden für neue Features
class HomeProvider {
  List<ServiceSnapshot> recentlyUsed = [];    // Zuletzt benutzt
  List<ServiceSnapshot> recommended = [];     // Empfehlungen
  List<Alert> smartAlerts = [];               // Smart Alerts
  BriefingData? dailyBriefing;                // Daily Briefing
}
```

```
Commit: "feat(home): Startseite mit Dashboard + Alerts + Briefing + Letzte benutzt"
```

---

### PHASE 5: ServiceRegistry anpassen (1h)

**Ziel:** Kategorien für die neue UI-Struktur.

#### Datei: `src/mobile/lib/features/miniprogram/domain/service_registry.dart`

**Änderung: ServiceDefinition erweitern**

```dart
class ServiceDefinition {
  // ... bestehende Felder
  final String category;        // 'mobility', 'health', 'daily', 'culture', 'finance'
  final int displayOrder;       // Reihenfolge in der UI
  final bool isFrequentlyUsed;  // Highlight in "Häufig"
  final String groupEmoji;      // Emoji für Kategorie-Header
}
```

**Änderung: Kategorien aktualisieren**

```dart
// VORHER: 'Alltag', 'Mobilität', 'Gesundheit', 'Kultur', 'Karriere', 'Reise', 'Behörden'
// NACHHER: 'mobility', 'health', 'daily', 'culture', 'finance'
```

```
Commit: "refactor(registry): ServiceRegistry mit Kategorien + displayOrder + isFrequentlyUsed"
```

---

### PHASE 6: Tests + CI (1h)

**Ziel:** Alle Tests anpassen, CI grün.

| Test-Datei | Änderung |
|------------|----------|
| `test/app_smoke_test.dart` | Tab-Count anpassen (5→3), neue Screens testen |
| `test/auth_integration_test.dart` | Navigation-Flow anpassen |
| `test/phase_d_dto_test.dart` | Keine Änderung (DTOs unverändert) |

**Befehle:**
```bash
cd src/mobile
flutter/bin/dart format lib/ test/
flutter/bin/flutter analyze lib/ test/
flutter/bin/flutter test
```

```
Commit: "test(flutter): Tests fuer 3-Tab-Struktur — smoke + integration"
```

---

### PHASE 7: Graph-Dateien + Docs (30min)

**Ziel:** Dokumentation auf aktuellen Stand bringen.

| Datei | Änderung |
|-------|----------|
| `knowledge.md` | 3-Tab-Struktur dokumentieren |
| `AGENTS.md` | Navigation-Änderung dokumentieren |
| `AGENT_HANDOFF.md` | Aktuellen Stand reflektieren |
| `projekt_*.md` | Phase 10 aktualisieren |

```
Commit: "docs: 3-Tab-Struktur dokumentiert — WeChat-Muster"
```

---

## 📁 Datei-Übersicht

| # | Datei | Status | Phase |
|---|-------|--------|-------|
| 1 | `src/mobile/lib/main.dart` | ÄNDERN | 1 |
| 2 | `src/mobile/lib/features/services/services_screen.dart` | NEU | 2 |
| 3 | `src/mobile/lib/features/profile/profile_screen.dart` | NEU | 3 |
| 4 | `src/mobile/lib/features/home/presentation/home_screen.dart` | ÄNDERN | 4 |
| 5 | `src/mobile/lib/features/home/presentation/home_provider.dart` | ÄNDERN | 4 |
| 6 | `src/mobile/lib/features/miniprogram/domain/service_registry.dart` | ÄNDERN | 5 |
| 7 | `src/mobile/lib/features/miniprogram/presentation/launchpad_screen.dart` | LÖSCHEN | 2 |
| 8 | `src/mobile/test/app_smoke_test.dart` | ÄNDERN | 6 |
| 9 | `src/mobile/test/auth_integration_test.dart` | ÄNDERN | 6 |

---

## ⚠️ Risiko-Register

| Risiko | Wahrscheinlichkeit | Impact | Lösung |
|--------|-------------------|--------|--------|
| App startet nicht | Niedrig | Hoch | CI vorher grün, Incremental-Commits |
| Provider nicht gefunden | Mittel | Mittel | Alle Provider bleiben im MultiProvider |
| Screens kaputt | Niedrig | Niedrig | ServiceRegistry-Lookup funktioniert weiter |
| Tests fehlgeschlagen | Mittel | Niedrig | Phase 6 behebt alle Tests |

---

## 🔄 Commit-Reihenfolge

```
1. chore: pre-refactor CI confirm
2. refactor(nav): 5 Tabs → 3 Tabs
3. feat(services): ServicesScreen mit Kategorien
4. feat(profile): ProfileScreen
5. feat(home): Startseite mit Dashboard + Alerts
6. refactor(registry): Kategorien + displayOrder
7. test(flutter): Tests fuer 3-Tab
8. docs: 3-Tab-Struktur dokumentiert
```

**Regel:** Jeder Commit muss grünen CI haben — KEIN Commit ohne grünen CI.

---

## 📐 UX-Mockups

### Startseite (Tab 0)
```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │ 🌤️ Moin! 21°C Bewölkt     │    │
│  │ Luft: Gut • Nächster Regen  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔔 3 neue Alerts            │    │
│  │ Müll morgen • Regen in 2h   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📋 Heute: Arzt 14:00       │    │
│  │ Briefing: 4 Dinge offen     │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Zuletzt benutzt ────────────   │
│  [🅿️ Parken] [🔌 Laden] [🎪 Events]│
│                                     │
│  ── Empfohlen ──────────────────   │
│  [🌤️ Wetter] [🏥 Ärzte] [💼 Jobs]  │
│                                     │
│                         💬 AI-Chat  │
└─────────────────────────────────────┘
```

### Dienste (Tab 1)
```
┌─────────────────────────────────────┐
│  🔍 Suche...                        │
│                                     │
│  ── Häufig ──────────────────────  │
│  [🌤️] [🏥] [🅿️] [🔌]              │
│                                     │
│  ── 🚗 Mobilität ───────────────  │
│  Routing • Parken • E-Laden         │
│                                     │
│  ── 🏥 Gesundheit ──────────────  │
│  Ärzte • Medikamente • Mental       │
│                                     │
│  ── 🏠 Alltag ──────────────────  │
│  Wetter • Luft • Abfall             │
│  Bürgeramt • Jobs                   │
│                                     │
│  ── 🎪 Kultur & Reise ──────────  │
│  Events • Hotels                    │
│                                     │
│  ── 💰 Finanzen ────────────────  │
│  Taler-Wallet                       │
└─────────────────────────────────────┘
```

### Profil (Tab 2)
```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │ 👤 Max Mustermann           │    │
│  │ max@heimat.de               │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Einstellungen ──────────────   │
│  ⚙️ Allgemein                    >  │
│  🔔 Benachrichtigungen           >  │
│  🌐 Sprache                      >  │
│                                     │
│  ── Verlauf ────────────────────   │
│  📋 Letzte Aktivitäten           >  │
│                                     │
│  ── Notfall ────────────────────   │
│  🚨 Notruf: 112                     │
│  🏥 Ärztefunk: 116117               │
│                                     │
│  ── Konto ──────────────────────   │
│  🚪 Abmelden                         │
└─────────────────────────────────────┘
```
