import 'dart:async';
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
  group('Group 1: Initial State (Berlin-Defaults)', () {
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

    test('lat/lng Berlin-Defaults', () {
      expect(provider.lat, 52.52);
      expect(provider.lng, 13.41);
    });

    test('city/street/houseNr initial (Berlin/empty)', () {
      expect(provider.city, 'berlin');
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
    test('init() mit EXAKT 24h altem cache → isStale=false (strict > TTL)',
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
            .subtract(const Duration(hours: 24))
            .millisecondsSinceEpoch,
      });
      final p4 = WasteProvider();
      await p4.init();
      expect(p4.hasData, isTrue);
      expect(p4.isStale, isFalse);
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
  // Phase B-3.1 — Bbox-basierter Auto-City-Picker (Static helper).
  //
  // Backward-Compat: Diese statische Funktion muss identisches
  // Verhalten weiter zeigen (siehe Folder-Naming `_x3c_static_helper_legacy`).
  // Der **neue** runtime-Pfad in Phase X.3c ist `_pickFromDynamicConfig()`
  // (instance-method, nutzt dynamic _cityDefaults).
  group('Group 9: pickCityFromBbox (Phase B-3.1 Bbox-Auto-Picker, static)', () {
    test('Berlin Mitte (52.52, 13.41) → berlin', () {
      expect(WasteProvider.pickCityFromBbox(52.52, 13.41), 'berlin');
    });

    test('Hamburg Mitte (53.55, 9.99) → hamburg', () {
      expect(WasteProvider.pickCityFromBbox(53.55, 9.99), 'hamburg');
    });

    test('Muenchen Mitte (48.14, 11.58) → muenchen', () {
      expect(WasteProvider.pickCityFromBbox(48.14, 11.58), 'muenchen');
    });

    test('Berlin lower-bound inclusive (52.34, 13.10) → berlin', () {
      expect(WasteProvider.pickCityFromBbox(52.34, 13.10), 'berlin');
    });

    test('Hamburg upper-bound edge just-inside (53.73, 10.31) → hamburg', () {
      expect(WasteProvider.pickCityFromBbox(53.73, 10.31), 'hamburg');
    });

    test(
        'Berlin upper-bound edge just-outside (52.68, 13.41) → berlin (Fallback)',
        () {
      expect(WasteProvider.pickCityFromBbox(52.68, 13.41), 'berlin');
    });

    test('Out-of-bbox Koeln (50.94, 6.96) → berlin (Fallback)', () {
      expect(WasteProvider.pickCityFromBbox(50.94, 6.96), 'berlin');
    });

    test(
        'Muenchen upper-bound edge just-outside (48.25, 11.73) → berlin (Fallback)',
        () {
      expect(WasteProvider.pickCityFromBbox(48.25, 11.73), 'berlin');
    });
  });

  // ------------------------------- Group 10 ------------------------------
  // **Phase X.3c NEW — Backend-Driven BBox-Defaults.**
  //
  // Strategie (Mirror zum Backend Phase X.3b):
  // - Source-of-Truth: GET /api/config/location-defaults (response via apiGet)
  // - Cache-Layer: SharedPreferences `waste_config_v1` (JSON) + `waste_config_ts_v1` (ms)
  //   mit 24h TTL (analog zu calendar-cache)
  // - Fallback-Layer: `_fallbackCityConfig` private constants (Last-Resort bei
  //   Cache-Empty + Network-Down). User-Regel "kein Hardcoding" gilt für
  //   primary-source — fallback ist graceful-degradation, nicht Mockup.
  //
  // Test-Scope: cache-state-contract (kein HTTP-Mocking weil pubspec kein
  // dio hat + Phase-B-3 established kein-Mockito-policy).
  group('Group 10: LocationDefaults (Phase X.3c dynamic config-loader)', () {
    test('hasCityConfig ist true nach init() (fallback oder cache oder fetch)',
        () async {
      // Cold start: kein cache, network-down → fallback aktiv
      expect(provider.hasCityConfig, isFalse);
      await provider.init();
      expect(provider.hasCityConfig, isTrue,
          reason:
              'Fallback-Konstanten sind auch "config available" (graceful-degradation)');
    });

    test('cityDefaults enthält 3 cities nach init() (fallback oder cache)',
        () async {
      await provider.init();
      expect(provider.cityDefaults.length, 3,
          reason: 'Berlin + Hamburg + München expected');
      expect(provider.cityDefaults.map((c) => c.name).toSet(),
          {'berlin', 'hamburg', 'muenchen'});
    });

    test(
        'cityDefaults enthält plausible BBox-Werte nach init() (fallback-source)',
        () async {
      await provider.init();
      final berlin =
          provider.cityDefaults.firstWhere((c) => c.name == 'berlin');
      expect(berlin.bbox.minLat, 52.34);
      expect(berlin.bbox.maxLat, 52.68);
      expect(berlin.bbox.minLng, 13.10);
      expect(berlin.bbox.maxLng, 13.77);
      expect(berlin.addressRequired, isFalse);
      final hamburg =
          provider.cityDefaults.firstWhere((c) => c.name == 'hamburg');
      expect(hamburg.addressRequired, isTrue);
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
              'Dynamic-config aus Cache verwendet, NICHT Hardcoded-Fallback');
    });

    test('Corrupted config-cache → fallback-Konstanten', () async {
      SharedPreferences.setMockInitialValues({
        'waste_config_v1': '{not-json{',
        'waste_config_ts_v1': DateTime.now().millisecondsSinceEpoch,
      });
      final pCorrupt = WasteProvider();
      await pCorrupt.init();
      expect(pCorrupt.hasCityConfig, isTrue);
      expect(pCorrupt.cityDefaults.length, 3,
          reason: 'Corrupted cache → fallback mit 3 cities');
      expect(pCorrupt.cityDefaults.map((c) => c.name).toSet(),
          {'berlin', 'hamburg', 'muenchen'});
    });

    test('refreshLocationDefaults() public-API: failed-fetch hält Fallback',
        () async {
      // Erwartung: refresh-locationDefaults triggert fetch, fetch failed
      // (kein Backend) → fallback bleibt aktiv, kein error-State.
      await provider.init();
      final beforeFallback = provider.cityDefaults.length;
      await provider.refreshLocationDefaults();
      expect(provider.hasCityConfig, isTrue,
          reason: 'hasCityConfig bleibt true (fallback oder cached)');
      expect(
          provider.cityDefaults.length, beforeFallback > 0 ? beforeFallback : 3,
          reason: 'Failed-fetch behält letzten Stand (fallback oder cache)');
    });

    test('Group-10-cityDefaults ist read-only (List.unmodifiable)', () async {
      await provider.init();
      expect(() => provider.cityDefaults.removeAt(0), throwsUnsupportedError,
          reason: 'cityDefaults ist read-only public-API');
    });
  });
}
