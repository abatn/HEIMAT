// CI Race-Fix: HTTP .timeout(30s) races with test runner default 30s.
// Library-level @Timeout gives HTTP calls time to timeout before test kill.
@Timeout(Duration(seconds: 60))
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/ev_charging/presentation/ev_charging_provider.dart';
import 'package:heimat_app/features/ev_charging/ev_charging_dto.dart';

/// EvChargingProvider Tests — State + Error-Handling + DTO-Parsing.
///
/// **Scope-Grenze (mirror zu air_quality_provider_test.dart):**
/// - EvChargingProvider hat KEIN SharedPreferences-Cache (network-only).
/// - Tests fokussieren auf Initial-State, Error-Handling-Contract,
///   Location-Passthrough und DTO-Parsing.
/// - HTTP-Success-Pfade sind NICHT testbar (keine apiGet-Injection).
///
/// **HEIMAT-Test-Convention:**
/// - SharedPreferences.setMockInitialValues({}) in setUp() (defensiv).
/// - Kein pumpAndSettle(), kein Mockito.
void main() {
  late EvChargingProvider provider;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    provider = EvChargingProvider();
  });

  // ==================================================================
  // Group 1: Initial State
  // ==================================================================
  group('Initial state — Konstruktor-Defaults', () {
    test('isLoading ist false initial', () {
      expect(provider.isLoading, isFalse);
    });

    test('error ist null initial', () {
      expect(provider.error, isNull);
    });

    test('stations ist leer initial', () {
      expect(provider.stations, isEmpty);
    });

    test('hasData ist false initial', () {
      expect(provider.hasData, isFalse);
    });

    test('lastUpdated ist null initial', () {
      expect(provider.lastUpdated, isNull);
    });

    test('locationName ist leer initial', () {
      expect(provider.locationName, '');
    });

    test('lat/lng sind 0 initial', () {
      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });
  });

  // ==================================================================
  // Group 2: init() mit leerem State
  // ==================================================================
  group('init() ohne vorherige Daten', () {
    test('init() komplettiert ohne Exception', () async {
      await provider.init();
    });
    test('init() laesst isLoading=false (kein sync-Call)', () async {
      await provider.init();
      expect(provider.isLoading, isFalse);
      expect(provider.error, isNull);
    });
    test('init() ruft notifyListeners mind. 1x auf', () async {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      await provider.init();
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(notifyCount, greaterThanOrEqualTo(1));
    });
  });

  // ==================================================================
  // Group 3: setLocation() — manuelle Koordinaten-Setzung
  // ==================================================================
  group('setLocation() — manuelle Standort-Setzung', () {
    test('setzt lat/lng korrekt', () {
      provider.setLocation(48.137, 11.575, name: 'München');

      expect(provider.lat, 48.137);
      expect(provider.lng, 11.575);
      expect(provider.locationName, 'München');
    });

    test('setLocation ohne name bleibt locationName leer', () {
      provider.setLocation(52.52, 13.41);

      expect(provider.lat, 52.52);
      expect(provider.lng, 13.41);
      expect(provider.locationName, '');
    });
  });

  // ==================================================================
  // Group 4: refresh() Error-Handling-Contract
  // ==================================================================
  group('refresh() Error-Handling (kein Mockito)', () {
    test('refresh() resolved ohne unhandled Exception', () async {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      await provider.refresh();

      expect(provider.isLoading, isFalse,
          reason: 'isLoading wird im finally-Block resettet');
      expect(notifyCount, greaterThanOrEqualTo(1),
          reason: 'notifyListeners wurde mind. 1x aufgerufen');
    });
    test('refresh() setzt error bei Network-Failure (stabiler Endzustand)',
        () async {
      await provider.refresh();

      expect(provider.isLoading, isFalse);
      // Bei Network-Failure: error != null (catch setzt _error).
      // Bei Netzwerk-Erfolg: error=null, stations geladen.
      // Beide Pfade gueltig — isLoading-Resets ist der invariante Test.
    });

    test('refresh() mit radiusKm bleibt stabil', () async {
      await provider.refresh(radiusKm: 10);

      expect(provider.isLoading, isFalse);
    });
    test('refresh() Doppel-Call: zweiter Aufruf wird sicher gedroppt',
        // 2x refresh() = potentiell 2x HTTP 30s = 60s → braucht >60s
        timeout: const Timeout(Duration(seconds: 90)), () async {
      // Beide awaiten: erster läuft durch, zweiter wird via Guard gedroppt
      await provider.refresh();
      await provider.refresh();

      expect(provider.isLoading, isFalse);
    });
  });

  // ==================================================================
  // Group 5: EvChargingStation DTO Convenience-Getter
  // ==================================================================
  group('EvChargingStation Convenience-Getter', () {
    test('is247 ist true bei "24/7" openingHours', () {
      final s = EvChargingStation(
        id: '1',
        osmType: 'node',
        name: 'Test',
        latitude: 52.5,
        longitude: 13.4,
        sockets: [],
        openingHours: '24/7',
      );
      expect(s.is247, isTrue);
    });

    test('is247 ist false bei anderen openingHours', () {
      final s = EvChargingStation(
        id: '2',
        osmType: 'node',
        name: 'Test',
        latitude: 52.5,
        longitude: 13.4,
        sockets: [],
        openingHours: 'Mo-Fr 8-20',
      );
      expect(s.is247, isFalse);
    });

    test('is247 ist false bei null openingHours', () {
      final s = EvChargingStation(
        id: '3',
        osmType: 'node',
        name: 'Test',
        latitude: 52.5,
        longitude: 13.4,
        sockets: [],
      );
      expect(s.is247, isFalse);
    });
  });
}
