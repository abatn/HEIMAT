import '../../weather/weather_screen.dart';
import '../../air_quality/air_quality_screen.dart';
import '../../waste/waste_screen.dart';
import '../../ev_charging/presentation/ev_charging_screen.dart';
import '../../parking/presentation/parking_screen.dart';
import '../../ai_chat/presentation/ai_chat_screen.dart';
import '../../mobility/presentation/mobility_screen.dart';
import '../../finance/presentation/finance_screen.dart';
import '../../health/presentation/health_screen_with_tabs.dart';
import '../../checkin/presentation/checkin_screen.dart';
import '../../jobs/job_screen.dart';
import '../../events/events_screen.dart';
import '../../hotels/hotels_screen.dart';
import '../../buergeramt/buergeramt_screen.dart';
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
/// - ✅ `mobility` → Native Flutter (Mobilität — 2026-07-29)
/// - ✅ `finance` → Native Flutter (Finanzen — 2026-07-29)
/// - ✅ `health` → Native Flutter (Gesundheit — 2026-07-29)
/// - ✅ `jobs` → Native Flutter (Job-Suche via Arbeitnow — Phase D, 2026-08-03)
/// - ✅ events → Native Flutter (Wikidata + OSM — Phase D, 2026-08-04)
/// - ✅ hotels → Native Flutter (OSM Overpass — Phase D, 2026-08-04)
/// - ✅ buergeramt → Native Flutter (Nominatim — Phase D, 2026-08-04)
/// - ⏳ futai → ComingSoonScreen-Placeholder
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
      'parking': ServiceDefinition(
        id: 'parking',
        name: 'Parkplätze',
        category: 'Mobilität',
        description: 'Parkplätze in deiner Nähe — OpenStreetMap Overpass.',
        searchTags: const [
          'parken',
          'parkplatz',
          'garage',
          'tiefgarage',
          'parkhaus'
        ],
        nativeBuilder: (_) => const ParkingScreen(),
      ),

      // ===== Echte native Services =====
      'mobility': ServiceDefinition(
        id: 'mobility',
        name: 'Mobilität',
        category: 'Mobilität',
        description: 'Haltestellen & Abfahrten in deiner Nähe.',
        searchTags: const ['bus', 'bahn', 'öpnv', 'transitous', 'haltestelle'],
        nativeBuilder: (_) => const MobilityScreen(),
      ),
      'finance': ServiceDefinition(
        id: 'finance',
        name: 'Finanzen',
        category: 'Alltag',
        description: 'Taler-Wallet & P2P-Überweisungen.',
        searchTags: const ['geld', 'kudos', 'taler', 'p2p', 'wallet'],
        nativeBuilder: (_) => const FinanceScreen(),
      ),
      'health': ServiceDefinition(
        id: 'health',
        name: 'Gesundheit',
        category: 'Alltag',
        description: 'Ärzte-Suche & Online-Terminbuchung.',
        searchTags: const ['arzt', 'praxis', 'termin', 'medizin', 'doc'],
        nativeBuilder: (_) => const HealthScreenWithTabs(),
      ),

      'checkin': ServiceDefinition(
        id: 'checkin',
        name: 'Lebenszeichen',
        category: 'Gesundheit',
        description:
            'Täglicher Check-in für deine Sicherheit — Timer-basiert, kein Sensor-Tracking.',
        searchTags: const [
          'checkin',
          'lebenszeichen',
          'sicherheit',
          'notfall',
          'schutzengel'
        ],
        nativeBuilder: (_) => const CheckinScreen(),
      ),

      // ===== Coming Soon Placeholder (Phase D/E Migration pending) =====

      'events': ServiceDefinition(
        id: 'events',
        name: 'Veranstaltungen',
        category: 'Kultur',
        description: 'Events & Aktivitäten aus Wikidata & OpenStreetMap.',
        searchTags: const ['konzert', 'theater', 'fest', 'event', 'kultur'],
        nativeBuilder: (_) => const EventsScreen(),
      ),
      'jobs': ServiceDefinition(
        id: 'jobs',
        name: 'Job-Suche',
        category: 'Karriere',
        description: 'Stellenangebote aus Deutschland (Arbeitnow API).',
        searchTags: const ['stelle', 'arbeit', 'karriere', 'job', 'ba'],
        nativeBuilder: (_) => const JobScreen(),
      ),
      'hotels': ServiceDefinition(
        id: 'hotels',
        name: 'Hotels',
        category: 'Reise',
        description: 'Unterkünfte aus OpenStreetMap.',
        searchTags: const ['unterkunft', 'übernachtung', 'reise', 'hostel'],
        nativeBuilder: (_) => const HotelsScreen(),
      ),
      'buergeramt': ServiceDefinition(
        id: 'buergeramt',
        name: 'Bürgeramt',
        category: 'Behörden',
        description: 'Bürgerämter & Behörden in deiner Nähe.',
        searchTags: const ['amt', 'behörde', 'verwaltung', 'termin'],
        nativeBuilder: (_) => const BuergeramtScreen(),
      ),
    });
  }

  /// Liefert die ServiceDefinition für eine ID, oder null wenn unbekannt.
  ServiceDefinition? lookup(String id) => _definitions[id];

  /// True wenn der Service ein nativen Flutter-Builder hat.
  /// Phase X.1: Alle registrierten Services haben einen nativeBuilder (ComingSoonScreen zählt).
  bool isNative(String id) => _definitions[id]?.isNative ?? false;
}
