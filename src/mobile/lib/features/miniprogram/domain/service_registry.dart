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
/// - ✅ `mobility` → Native Flutter (Mobilität — 2026-07-29)
/// - ✅ `finance` → Native Flutter (Finanzen — 2026-07-29)
/// - ✅ `health` → Native Flutter (Gesundheit — 2026-07-29)
/// - ✅ `jobs` → Native Flutter (Job-Suche via Arbeitnow — Phase D, 2026-08-03)
/// - ✅ events → Native Flutter (Wikidata + OSM — Phase D, 2026-08-04)
/// - ✅ hotels → Native Flutter (OSM Overpass — Phase D, 2026-08-04)
/// - ✅ buergeramt → Native Flutter (Nominatim — Phase D, 2026-08-04)
/// - ⏳ futai → ComingSoonScreen (Phase Futai-Integration, 2026-08-11)
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
      // ===== Mobilität (category: 'Mobilität') =====
      'mobility': ServiceDefinition(
        id: 'mobility',
        name: 'ÖPNV & Routen',
        category: 'Mobilität',
        description: 'Haltestellen & Abfahrten in deiner Nähe.',
        searchTags: const ['bus', 'bahn', 'öpnv', 'transitous', 'haltestelle'],
        nativeBuilder: (_) => const MobilityScreen(),
        displayOrder: 1,
        isFrequentlyUsed: true,
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
        displayOrder: 2,
        isFrequentlyUsed: true,
      ),
      'ev_charging': ServiceDefinition(
        id: 'ev_charging',
        name: 'E-Ladestationen',
        category: 'Mobilität',
        description: 'E-Ladestationen in deiner Nähe — OpenStreetMap Overpass.',
        searchTags: const ['ladestation', 'laden', 'ev', 'elektro', 'strom'],
        nativeBuilder: (_) => const EvChargingScreen(),
        displayOrder: 3,
        isFrequentlyUsed: true,
      ),

      // ===== Gesundheit (category: 'Gesundheit') =====
      'health': ServiceDefinition(
        id: 'health',
        name: 'Ärzte & Termine',
        category: 'Gesundheit',
        description: 'Ärzte-Suche & Online-Terminbuchung.',
        searchTags: const ['arzt', 'praxis', 'termin', 'medizin', 'doc'],
        nativeBuilder: (_) => const HealthScreenWithTabs(),
        displayOrder: 1,
        isFrequentlyUsed: true,
      ),
      'checkin': ServiceDefinition(
        id: 'checkin',
        name: 'Lebenszeichen',
        category: 'Gesundheit',
        description: 'Täglicher Check-in für deine Sicherheit — Timer-basiert.',
        searchTags: const [
          'checkin',
          'lebenszeichen',
          'sicherheit',
          'notfall',
          'schutzengel'
        ],
        nativeBuilder: (_) => const CheckinScreen(),
        displayOrder: 2,
      ),

      // ===== Alltag (category: 'Alltag') =====
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
        displayOrder: 1,
        isFrequentlyUsed: true,
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
        displayOrder: 2,
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
        displayOrder: 3,
      ),
      'buergeramt': ServiceDefinition(
        id: 'buergeramt',
        name: 'Bürgeramt',
        category: 'Alltag',
        description: 'Bürgerämter & Behörden in deiner Nähe.',
        searchTags: const ['amt', 'behörde', 'verwaltung', 'termin'],
        nativeBuilder: (_) => const BuergeramtScreen(),
        displayOrder: 4,
      ),
      'jobs': ServiceDefinition(
        id: 'jobs',
        name: 'Job-Suche',
        category: 'Alltag',
        description: 'Stellenangebote aus Deutschland (Arbeitnow API).',
        searchTags: const ['stelle', 'arbeit', 'karriere', 'job', 'ba'],
        nativeBuilder: (_) => const JobScreen(),
        displayOrder: 5,
      ),

      // ===== Kultur & Reise (category: 'Kultur & Reise') =====
      'events': ServiceDefinition(
        id: 'events',
        name: 'Veranstaltungen',
        category: 'Kultur & Reise',
        description: 'Events & Aktivitäten aus Wikidata & OpenStreetMap.',
        searchTags: const ['konzert', 'theater', 'fest', 'event', 'kultur'],
        nativeBuilder: (_) => const EventsScreen(),
        displayOrder: 1,
      ),
      'hotels': ServiceDefinition(
        id: 'hotels',
        name: 'Hotels',
        category: 'Kultur & Reise',
        description: 'Unterkünfte aus OpenStreetMap.',
        searchTags: const ['unterkunft', 'übernachtung', 'reise', 'hostel'],
        nativeBuilder: (_) => const HotelsScreen(),
        displayOrder: 2,
      ),

      // ===== Finanzen (category: 'Finanzen') =====
      'finance': ServiceDefinition(
        id: 'finance',
        name: 'Taler-Wallet',
        category: 'Finanzen',
        description: 'Taler-Wallet & P2P-Überweisungen.',
        searchTags: const ['geld', 'kudos', 'taler', 'p2p', 'wallet'],
        nativeBuilder: (_) => const FinanceScreen(),
        displayOrder: 1,
      ),

      // ===== AI (category: 'AI') =====
      'ai_chat': ServiceDefinition(
        id: 'ai_chat',
        name: 'HEIMAT AI',
        category: 'AI',
        description: 'KI-Assistent für alle Services — lokal via Ollama.',
        searchTags: const [
          'ki',
          'chat',
          'assistent',
          'ollama',
          'hilfe',
          'frage'
        ],
        nativeBuilder: (_) => const AiChatScreen(),
        displayOrder: 1,
      ),
      'futai': ServiceDefinition(
        id: 'futai',
        name: 'Futai Chat',
        category: 'AI',
        description:
            'KI-Assistent mit Gedächtnis & Emotionen — Integration in Planung.',
        searchTags: const [
          'futai',
          'chat',
          'ki',
          'assistent',
          'sozial',
          'gedächtnis'
        ],
        nativeBuilder: (_) => const ComingSoonScreen(
          serviceName: 'Futai Chat',
          description:
              'KI-Assistent mit Gedächtnis & Emotionen — Integration in Planung. '
              'Futai ist eine Open-Source Social-Media-App mit KI-Chat (Ollama), '
              '12 Emotionen, Gedächtnis und Feed.',
          category: 'AI',
          searchTags: ['futai', 'chat', 'ki', 'assistent', 'sozial'],
        ),
        displayOrder: 2,
      ),
    });
  }

  /// Liefert die ServiceDefinition für eine ID, oder null wenn unbekannt.
  ServiceDefinition? lookup(String id) => _definitions[id];

  /// True wenn der Service ein nativen Flutter-Builder hat.
  bool isNative(String id) => _definitions[id]?.isNative ?? false;

  /// Alle Kategorien in Reihenfolge, mit zugehörigen Services.
  /// Liefert: [('Mobilität', [def1, def2, ...]), ...]
  List<(String, List<ServiceDefinition>)> categoriesGrouped() {
    final map = <String, List<ServiceDefinition>>{};
    for (final def in _definitions.values) {
      final cat = def.category ?? 'Sonstiges';
      map.putIfAbsent(cat, () => []);
      map[cat]!.add(def);
    }
    // Sortiere Services innerhalb jeder Kategorie nach displayOrder
    for (final list in map.values) {
      list.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    }
    // Kategorien-Reihenfolge: Mobilität, Gesundheit, Alltag, Kultur, Finanzen, AI
    const order = [
      'Mobilität',
      'Gesundheit',
      'Alltag',
      'Kultur & Reise',
      'Finanzen',
      'AI'
    ];
    final result = <(String, List<ServiceDefinition>)>[];
    for (final cat in order) {
      if (map.containsKey(cat)) {
        result.add((cat, map[cat]!));
      }
    }
    // Restliche Kategorien anhängen
    for (final entry in map.entries) {
      if (!order.contains(entry.key)) {
        result.add((entry.key, entry.value));
      }
    }
    return result;
  }

  /// Services mit isFrequentlyUsed = true, sortiert nach displayOrder.
  List<ServiceDefinition> frequentlyUsed() {
    return _definitions.values.where((d) => d.isFrequentlyUsed).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }
}
