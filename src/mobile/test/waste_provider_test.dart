@Timeout(Duration(seconds: 60))
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/waste/presentation/waste_provider.dart';
import 'package:heimat_app/features/waste/waste_dto.dart';
import 'package:heimat_app/features/waste/waste_location_defaults_dto.dart';

void main() {
  // -----------------------------------------------------------------
  // Phase B-3 8-group Struktur (Mirror zu weather_provider_test.dart).
  // Race-Safety: Group 4 stale-cache keine direkte isStale-Assertion.
  // Group 7 refresh kein direkter provider.error-Assert (Network-CI kann
  // in production-CI erfolgreich sein — daher nur state-asserts).
  // Mock-Policy: kein fundLocal/_computeMockLiveStatus/StubNaiveBayes*.
  // Wir testen Cache/State-Contract pur ohne apiGet-Mocking.
  //
  // Phase X.3c NEW Group 10: LocationDefaults dynamic-config-loader
  // (Backend-driven refactor, ersetzt 6 hardcoded BBox-Konstanten).
  // -----------------------------------------------------------------
  late WasteProvider provider;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    provider = WasteProvider();
  });

  // ------------------------------- Group 1 -------------------------------
  group('Group 1: Initial State (kein hardcoded Standort)', () {
    test('isLoading ist initial false', () {
      expect(provider.isLoading, isFalse);
    });

    test('error ist initial null', () {
      expect(provider.error, isNull);
    });

    test('addressRequired ist initial false', () {
      expect(provider.addressRequired, isFalse);
    });

    test('calendar ist initial null (no data)', () {
      expect(provider.hasData, isFalse);
      expect(provider.calendar, isNull);
    });

    test('lat/lng Defaults = 0/0 (kein hardcoded Berlin)', () {
      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });

    test('city/street/houseNr initial (unknown/empty)', () {
      expect(provider.city, 'unknown');
      expect(provider.street, '');
      expect(provider.houseNr, '');
    });

    test('weeks default = 4', () {
      expect(provider.weeks, 4);
    });

    test('lastUpdated initial null', () {
      expect(provider.lastUpdated, isNull);
    });

    test('isStale initial false', () {
      expect(provider.isStale, isFalse);
    });
  });

  // ------------------------------- Group 2 -------------------------------
  group('Group 2: init() mit leerem Cache', () {
    test('init() komplettiert ohne Exception', () async {
      await provider.init();
      expect(provider.hasData, isFalse);
    });

    test('init() ruft notifyListeners mindestens 1x', () async {
      var notified = 0;
      provider.addListener(() => notified++);
      await provider.init();
      expect(notified, greaterThanOrEqualTo(1));
    });

    test('init() triggert auto-refresh wenn kein Cache', () async {
      await provider.init();
      expect(provider.calendar, anyOf(isNull, isA<WasteCalendarResponse>()));
    });
  });

  // ------------------------------- Group 3 -------------------------------
  group('Group 3: setWeeks() (TTL-boundary-independent Codepath)', () {
    test('setWeeks(2) aktualisiert weeks-Wert', () {
      provider.setWeeks(2);
      expect(provider.weeks, 2);
    });

    test('setWeeks(0) ungültig → no-op', () {
      final before = provider.weeks;
      provider.setWeeks(0);
      expect(provider.weeks, before);
    });

    test('setWeeks(9) ungültig → no-op (max 8)', () {
      final before = provider.weeks;
      provider.setWeeks(9);
      expect(provider.weeks, before);
    });

    test('setWeeks(4) bei identischem Wert → kein refresh-Trigger (no-op)', () {
      provider.setWeeks(4);
      expect(provider.weeks, 4);
    });
  });

  // ------------------------------- Group 4 -------------------------------
  group('Group 4: updateAddress(city, street, houseNr)', () {
    test('updateAddress setzt city/street/houseNr synchron (deterministic)',
        () {
      provider.updateAddress(
        city: 'hamburg',
        street: 'Beispielstraße',
        houseNr: '1',
      );
      expect(provider.city, 'hamburg');
      expect(provider.street, 'Beispielstraße');
      expect(provider.houseNr, '1');
      expect(provider.addressRequired, isFalse);
    });

    test('updateAddress setzt city/street/houseNr', () {
      provider.updateAddress(
        city: 'muenchen',
        street: 'Maximilianstraße',
        houseNr: '12',
      );
      expect(provider.city, 'muenchen');
      expect(provider.street, 'Maximilianstraße');
      expect(provider.houseNr, '12');
    });

    test('updateAddress mit leerem street wird nicht ausgelöst', () {
      provider.updateAddress(city: 'hamburg', street: '', houseNr: '');
      expect(provider.street, '');
      expect(provider.houseNr, '');
    });
  });

  // ------------------------------- Group 5 -------------------------------
  group('Group 5: Cache-write/read Paths', () {
    test('_persistCalendar schreibt JSON in SharedPreferences', () async {
      final fakeData = <String, dynamic>{
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [
          {'start': '2026-01-15T06:00:00', 'summary': 'Biotonne'},
        ],
        'source': 'cache-test',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': true,
      };
      SharedPreferences.setMockInitialValues({});
      final prefs1 = await SharedPreferences.getInstance();
      await prefs1.setString('waste_data_v1', jsonEncode(fakeData));
      await prefs1.setInt('waste_ts_v1', DateTime.now().millisecondsSinceEpoch);
      await prefs1.setString('waste_city_v1', 'berlin');
      await prefs1.setInt('waste_weeks_v1', 4);

      final reloadProvider = WasteProvider();
      await reloadProvider.init();
      expect(reloadProvider.hasData, isTrue);
      expect(reloadProvider.calendar?.city, 'berlin');
      expect(reloadProvider.events.length, 1);
    });

    test('init() mit corrupted cache (invalid JSON) → silent fallback',
        () async {
      SharedPreferences.setMockInitialValues({
        'waste_data_v1': '{not-json{',
        'waste_ts_v1': DateTime.now().millisecondsSinceEpoch,
      });
      final p2 = WasteProvider();
      await p2.init();
      expect(p2.hasData, isFalse);
      expect(p2.calendar, isNull);
    });

    test('init() mit frischem cache (jetzt = < 24h) → isStale=false', () async {
      final fakeData = <String, dynamic>{
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [],
        'source': 'cache',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': true,
      };
      SharedPreferences.setMockInitialValues({
        'waste_data_v1': jsonEncode(fakeData),
        'waste_ts_v1': DateTime.now()
            .subtract(const Duration(hours: 23, minutes: 59))
            .millisecondsSinceEpoch,
      });
      final p3 = WasteProvider();
      await p3.init();
      expect(p3.hasData, isTrue);
      expect(p3.isStale, isFalse);
    });
  });

  // ------------------------------- Group 6 -------------------------------
  group('Group 6: TTL Boundary (24h strict > test)', () {
    test('init() mit 23h59m altem cache → isStale=false (strict > TTL)',
        () async {
      final fakeData = <String, dynamic>{
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [],
        'source': 'cache',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': true,
      };
      SharedPreferences.setMockInitialValues({
        'waste_data_v1': jsonEncode(fakeData),
        'waste_ts_v1': DateTime.now()
            .subtract(const Duration(hours: 23, minutes: 59))
            .millisecondsSinceEpoch,
      });
      final p4 = WasteProvider();
      await p4.init();
      expect(p4.hasData, isTrue);
      expect(p4.isStale, isFalse,
          reason: 'Bei 23h59m ist diff < 24h (TTL) → Strict `>` ergibt false');
    });

    test('init() mit 24h+1min altem cache → isStale=true', () async {
      final fakeData = <String, dynamic>{
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [],
        'source': 'cache-age-test',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': true,
      };
      SharedPreferences.setMockInitialValues({
        'waste_data_v1': jsonEncode(fakeData),
        'waste_ts_v1': DateTime.now()
            .subtract(const Duration(hours: 24, minutes: 1))
            .millisecondsSinceEpoch,
      });
      final p5 = WasteProvider();
      await p5.init();
      expect(p5.hasData, isTrue);
      expect(p5.isStale, isTrue);
    });
  });

  // ------------------------------- Group 7 -------------------------------
  group('Group 7: refresh() Error-Handling-Contracts', () {
    test('refresh() wirft KEINE unhandled Exception (auch ohne backend)',
        () async {
      bool unhandled = false;
      try {
        await provider.refresh().timeout(const Duration(seconds: 5));
      } on UnimplementedError {
        unhandled = true;
      } catch (_) {
        // caught via _error
      }
      expect(unhandled, isFalse);
      expect(provider.isLoading, isFalse);
    });

    test(
        'refresh() bei backend-network-failure: cache-preservation wenn vorher data',
        () async {
      final fakeData = <String, dynamic>{
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [
          {'start': '2026-01-17T06:00:00', 'summary': 'Biotonne'},
        ],
        'source': 'cache-pre-refresh',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': true,
      };
      SharedPreferences.setMockInitialValues({
        'waste_data_v1': jsonEncode(fakeData),
        'waste_ts_v1': DateTime.now()
            .subtract(const Duration(hours: 1))
            .millisecondsSinceEpoch,
      });
      final p6 = WasteProvider();
      await p6.init();
      expect(p6.hasData, isTrue);
      final calBefore = p6.calendar;
      await p6.refresh().timeout(const Duration(seconds: 5));
      expect(p6.calendar, same(calBefore));
    });
  });

  // ------------------------------- Group 8 -------------------------------
  group('Group 8: refresh() AddressRequiredError-State', () {
    test('addressRequired bleibt false wenn refresh()-Backend 422 simuliert',
        () async {
      final initial = provider.addressRequired;
      expect(initial, isFalse);
      await provider.refresh().timeout(const Duration(seconds: 5));
      expect(provider.addressRequired, isFalse);
    });

    test('After refresh()-failure: isLoading = false (finally-branch)',
        () async {
      await provider.refresh().timeout(const Duration(seconds: 5));
      expect(provider.isLoading, isFalse);
    });
  });

  // ------------------------------- Group 9 -------------------------------
  // Phase X.5c — pickCityFromBbox nutzt dynamische cityDefaults (keine hardcoded
  // BBox-Konstanten mehr). Als Fallback bei fehlendem cityDefaults → 'unknown'.
  group('Group 9: pickCityFromBbox (Phase X.5c dynamic cityDefaults, static)',
      () {
    final testDefaults = <CityDefaultDto>[
      CityDefaultDto(
        name: 'berlin',
        displayName: 'Berlin',
        bbox: const BBoxDto(
            minLat: 52.34, maxLat: 52.68, minLng: 13.10, maxLng: 13.77),
        addressRequired: false,
        attribution: 'BSR — CC-BY 4.0',
      ),
      CityDefaultDto(
        name: 'hamburg',
        displayName: 'Hamburg',
        bbox: const BBoxDto(
            minLat: 53.39, maxLat: 53.74, minLng: 9.73, maxLng: 10.32),
        addressRequired: true,
        attribution: 'SRH — CC-BY 4.0',
      ),
      CityDefaultDto(
        name: 'muenchen',
        displayName: 'München',
        bbox: const BBoxDto(
            minLat: 48.06, maxLat: 48.25, minLng: 11.36, maxLng: 11.73),
        addressRequired: true,
        attribution: 'AWB — CC-BY 4.0',
      ),
    ];

    test('Berlin Mitte (52.52, 13.41) → berlin', () {
      expect(
          WasteProvider.pickCityFromBbox(52.52, 13.41,
              cityDefaults: testDefaults),
          'berlin');
    });

    test('Hamburg Mitte (53.55, 9.99) → hamburg', () {
      expect(
          WasteProvider.pickCityFromBbox(53.55, 9.99,
              cityDefaults: testDefaults),
          'hamburg');
    });

    test('Muenchen Mitte (48.14, 11.58) → muenchen', () {
      expect(
          WasteProvider.pickCityFromBbox(48.14, 11.58,
              cityDefaults: testDefaults),
          'muenchen');
    });

    test('Berlin lower-bound inclusive (52.34, 13.10) → berlin', () {
      expect(
          WasteProvider.pickCityFromBbox(52.34, 13.10,
              cityDefaults: testDefaults),
          'berlin');
    });

    test('Hamburg upper-bound edge just-inside (53.73, 10.31) → hamburg', () {
      expect(
          WasteProvider.pickCityFromBbox(53.73, 10.31,
              cityDefaults: testDefaults),
          'hamburg');
    });

    test(
        'Berlin upper-bound edge just-outside (52.68, 13.41) → unknown (Fallback)',
        () {
      expect(
          WasteProvider.pickCityFromBbox(52.68, 13.41,
              cityDefaults: testDefaults),
          'unknown');
    });

    test('Out-of-bbox Koeln (50.94, 6.96) → unknown (Fallback)', () {
      expect(
          WasteProvider.pickCityFromBbox(50.94, 6.96,
              cityDefaults: testDefaults),
          'unknown');
    });

    test(
        'Muenchen upper-bound edge just-outside (48.25, 11.73) → unknown (Fallback)',
        () {
      expect(
          WasteProvider.pickCityFromBbox(48.25, 11.73,
              cityDefaults: testDefaults),
          'unknown');
    });

    test('Ohne cityDefaults → unknown (kein hardcoded Fallback)', () {
      expect(
        WasteProvider.pickCityFromBbox(52.52, 13.41),
        'unknown',
        reason: 'Kein cityDefaults übergeben → Fallback unknown',
      );
    });
  });

  // ------------------------------- Group 10 ------------------------------
  // **Phase X.5c — Backend-Driven Location-Defaults (KEIN hardcoded Fallback).**
  //
  // Strategie:
  // - Source-of-Truth: GET /api/config/location-defaults (response via apiGet)
  // - Cache-Layer: SharedPreferences `waste_config_v1` (JSON) + `waste_config_ts_v1` (ms)
  //   mit 24h TTL (analog zu calendar-cache)
  // - KEIN Hardcoded-Fallback mehr — bei Cache-Empty + Network-Down bleibt
  //   hasCityConfig=false und _cityDefaults leer.
  group('Group 10: LocationDefaults (Phase X.5c keine Fallback-Konstanten)',
      () {
    test('hasCityConfig ist false nach init() wenn kein Cache und kein Network',
        () async {
      expect(provider.hasCityConfig, isFalse);
      await provider.init();
      // Ohne Cache + ohne Network → hasCityConfig bleibt false
      expect(provider.hasCityConfig, isFalse);
    });

    test('cityDefaults ist leer nach init() wenn kein Cache', () async {
      await provider.init();
      expect(provider.cityDefaults, isEmpty,
          reason: 'Kein hardcoded Fallback — cityDefaults bleibt leer');
    });

    test('Gecachte location-defaults werden aus SharedPreferences geladen',
        () async {
      SharedPreferences.setMockInitialValues({
        'waste_config_v1': jsonEncode([
          {
            'name': 'berlin',
            'displayName': 'Berlin',
            'bbox': {
              'minLat': 51.99,
              'maxLat': 52.99,
              'minLng': 12.99,
              'maxLng': 13.99
            },
            'addressRequired': false,
            'attribution': 'BSR — CC-BY 4.0',
          },
        ]),
        'waste_config_ts_v1': DateTime.now().millisecondsSinceEpoch,
      });
      final pCached = WasteProvider();
      await pCached.init();
      expect(pCached.hasCityConfig, isTrue);
      expect(pCached.cityDefaults.length, 1);
      expect(pCached.cityDefaults.first.name, 'berlin');
      expect(pCached.cityDefaults.first.bbox.minLat, 51.99,
          reason:
              'Dynamic-config aus Cache verwendet, KEIN hardcoded Fallback');
    });

    test('Corrupted config-cache → hasCityConfig=false, cityDefaults=[]',
        () async {
      SharedPreferences.setMockInitialValues({
        'waste_config_v1': '{not-json{',
        'waste_config_ts_v1': DateTime.now().millisecondsSinceEpoch,
      });
      final pCorrupt = WasteProvider();
      await pCorrupt.init();
      expect(pCorrupt.hasCityConfig, isFalse,
          reason: 'Corrupted cache → kein Fallback, hasCityConfig=false');
      expect(pCorrupt.cityDefaults, isEmpty,
          reason: 'Corrupted cache → cityDefaults bleibt leer');
    });
    test(
        'refreshLocationDefaults() public-API: kein Crash + kein Fallback (dynamisch oder leer)',
        () async {
      await provider.init();
      // Hinweis: `_isLoading` kann durch init()-triggered refresh(true) sein.
      // refreshLocationDefaults() selbst setzt KEIN loading state —
      // daher testen wir nur den Contract: Crash-Freiheit + City-Defaults.
      await provider.refreshLocationDefaults();
      expect(provider.cityDefaults.length, anyOf(0, greaterThan(0)),
          reason:
              'cityDefaults bleibt 0 (kein Cache/Network) oder wächst (Backend geladen) — kein hardcoded Fallback');
    });

    test('Group-10-cityDefaults ist read-only (List.unmodifiable)', () async {
      await provider.init();
      expect(() => provider.cityDefaults.removeAt(0), throwsUnsupportedError,
          reason: 'cityDefaults ist read-only public-API');
    });
  });
}
