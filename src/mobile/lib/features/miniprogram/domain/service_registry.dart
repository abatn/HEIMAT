import '../../weather/weather_screen.dart';
import '../../air_quality/air_quality_screen.dart';
import '../../waste/waste_screen.dart';
import '../../ev_charging/presentation/ev_charging_screen.dart';
import '../../ai_chat/presentation/ai_chat_screen.dart';
import '../presentation/coming_soon_screen.dart';
import 'service_definition.dart';

/// ServiceRegistry — Singleton-Verzeichnis aller HEIMAT-Services.
///
/// **Phase X.1 (Eliminierung IFrame-Einbettung, 2026-07-28):**
/// Jeder Service hat jetzt einen `nativeBuilder` — entweder ein echter
/// nativer Screen (weather, air, waste) oder `ComingSoonScreen` als
/// Placeholder. Es gibt KEINEN IFrame-Fallback mehr.
///
/// **User-Regel-Konform:**
/// - KEINE externe Webseiten-Einbettung (kein IFrame, kein WebView)
/// - KEIN Mock / keine Simulation — ComingSoonScreen ist ehrlicher Status
/// - KEIN hardcoded URL im Frontend (alle Service-Daten fließen aus Registry)
///
/// **Status pro Service:**
/// - ✅ `weather` → Native Flutter (Phase E Pilot)
/// - ✅ `air` → Native Flutter (Luftqualität — Phase B, 2026-07-27)
/// - ✅ `waste` → Native Flutter (Phase B-3, 2026-07-27)
/// - ⏳ mobility, finance, health, futai, events, jobs, hotels, buergeramt → ComingSoonScreen-Placeholder (Migration in Phase D/E)
class ServiceRegistry {
  ServiceRegistry._();
  static final ServiceRegistry instance = ServiceRegistry._();

  /// Lookup-Map aller registrierten Services
  final Map<String, ServiceDefinition> _definitions =
      <String, ServiceDefinition>{};

  /// Initialisierung — ALLE Services registrieren (Phase X.1).
  /// Lazy-Loading: die Screen-Imports werden hier gemacht, aber das
  /// eigentliche Widget wird nur bei Tap gebaut.
  void initialize() {
    _definitions.addAll({
      // ===== Echte native Services =====
      'ai_chat': ServiceDefinition(
        id: 'ai_chat',
        name: 'HEIMAT AI',
        category: 'Alltag',
        description:
            'KI-Assistent für Wetter, Luftqualität, Abfallkalender & mehr — lokal via Ollama.',
        searchTags: const [
          'ki',
          'chat',
          'assistent',
          'ollama',
          'hilfe',
          'frage'
        ],
        nativeBuilder: (_) => const AiChatScreen(),
      ),
      'weather': ServiceDefinition(
        id: 'weather',
        name: 'Wetter',
        category: 'Alltag',
        description:
            'Aktuelle Wetterdaten & 7-Tage-Vorhersage — DWD Open Data.',
        searchTags: const [
          'temperatur',
          'regen',
          'sonne',
          'dwd',
          'wettervorhersage'
        ],
        nativeBuilder: (_) => const WeatherScreen(),
      ),
      'air': ServiceDefinition(
        id: 'air',
        name: 'Luftqualität',
        category: 'Alltag',
        description:
            'Feinstaub- und Ozonwerte — CAMS Copernicus via Open-Meteo.',
        searchTags: const [
          'aqi',
          'feinstaub',
          'pm10',
          'pm25',
          'copernicus',
          'gesundheit'
        ],
        nativeBuilder: (_) => const AirQualityScreen(),
      ),
      'waste': ServiceDefinition(
        id: 'waste',
        name: 'Abfallkalender',
        category: 'Alltag',
        description: 'Abfuhrtermine & Sortier-Tipps.',
        searchTags: const [
          'müll',
          'abfuhr',
          'entsorgung',
          'recycling',
          'gelber sack'
        ],
        nativeBuilder: (_) => const WasteScreen(),
      ),
      'ev_charging': ServiceDefinition(
        id: 'ev_charging',
        name: 'E-Ladestationen',
        category: 'Mobilität',
        description: 'E-Ladestationen in deiner Nähe — OpenStreetMap Overpass.',
        searchTags: const ['ladestation', 'laden', 'ev', 'elektro', 'strom'],
        nativeBuilder: (_) => const EvChargingScreen(),
      ),

      // ===== Coming Soon Placeholder (Phase D/E Migration pending) =====
      'mobility': ServiceDefinition(
        id: 'mobility',
        name: 'Mobilität',
        category: 'Mobilität',
        description: 'Haltestellen & Abfahrten in deiner Nähe.',
        searchTags: const ['bus', 'bahn', 'öpnv', 'transitous', 'haltestelle'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Mobilität',
          description: 'Haltestellen & Abfahrten in deiner Nähe.',
          category: 'Mobilität',
          searchTags: ['bus', 'bahn', 'öpnv'],
        ),
      ),
      'finance': ServiceDefinition(
        id: 'finance',
        name: 'Finanzen',
        category: 'Alltag',
        description: 'Taler-Wallet & P2P-Überweisungen.',
        searchTags: const ['geld', 'kudos', 'taler', 'p2p', 'wallet'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Finanzen',
          description: 'Taler-Wallet & P2P-Überweisungen.',
          category: 'Alltag',
          searchTags: ['geld', 'kudos', 'taler', 'p2p', 'wallet'],
        ),
      ),
      'health': ServiceDefinition(
        id: 'health',
        name: 'Gesundheit',
        category: 'Alltag',
        description: 'Ärzte-Suche & Online-Terminbuchung.',
        searchTags: const ['arzt', 'praxis', 'termin', 'medizin', 'doc'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Gesundheit',
          description: 'Ärzte-Suche & Online-Terminbuchung.',
          category: 'Alltag',
          searchTags: ['arzt', 'praxis', 'termin'],
        ),
      ),
      'events': ServiceDefinition(
        id: 'events',
        name: 'Veranstaltungen',
        category: 'Kultur',
        description: 'Events & Aktivitäten aus Wikidata & OpenStreetMap.',
        searchTags: const ['konzert', 'theater', 'fest', 'event', 'kultur'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Veranstaltungen',
          description: 'Events & Aktivitäten aus Wikidata & OpenStreetMap.',
          category: 'Kultur',
          searchTags: ['konzert', 'theater', 'fest', 'kultur'],
        ),
      ),
      'jobs': ServiceDefinition(
        id: 'jobs',
        name: 'Job-Suche',
        category: 'Karriere',
        description: 'Stellenangebote der Bundesagentur für Arbeit.',
        searchTags: const ['stelle', 'arbeit', 'karriere', 'job', 'ba'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Job-Suche',
          description: 'Stellenangebote der Bundesagentur für Arbeit.',
          category: 'Karriere',
          searchTags: ['stelle', 'arbeit', 'karriere', 'job', 'ba'],
        ),
      ),
      'hotels': ServiceDefinition(
        id: 'hotels',
        name: 'Hotels',
        category: 'Reise',
        description: 'Unterkünfte aus OpenStreetMap & Wikidata.',
        searchTags: const ['unterkunft', 'übernachtung', 'reise', 'hostel'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Hotels',
          description: 'Unterkünfte aus OpenStreetMap & Wikidata.',
          category: 'Reise',
          searchTags: ['unterkunft', 'übernachtung', 'reise'],
        ),
      ),
      'buergeramt': ServiceDefinition(
        id: 'buergeramt',
        name: 'Bürgeramt',
        category: 'Behörden',
        description: 'Termine & Services deiner lokalen Bürgerämter.',
        searchTags: const ['amt', 'behörde', 'verwaltung', 'termin'],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Bürgeramt',
          description: 'Termine & Services deiner lokalen Bürgerämter.',
          category: 'Behörden',
          searchTags: ['amt', 'behörde', 'verwaltung', 'termin'],
        ),
      ),
    });
  }

  /// Liefert die ServiceDefinition für eine ID, oder null wenn unbekannt.
  ServiceDefinition? lookup(String id) => _definitions[id];

  /// True wenn der Service ein nativen Flutter-Builder hat.
  /// Phase X.1: Alle registrierten Services haben einen nativeBuilder (ComingSoonScreen zählt).
  bool isNative(String id) => _definitions[id]?.isNative ?? false;
}
