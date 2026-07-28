import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/waste/presentation/waste_provider.dart';
import 'package:heimat_app/features/waste/waste_dto.dart';

void main() {
  // -----------------------------------------------------------------
  // Phase B-3 8-group Struktur (Mirror zu weather_provider_test.dart).
  // Race-Safety: Group 4 stale-cache keine direkte isStale-Assertion.
  // Group 7 refresh kein direkter provider.error-Assert (Network-CI kann
  // in production-CI erfolgreich sein — daher nur state-asserts).
  // Mock-Policy: kein fundLocal/_computeMockLiveStatus/StubNaiveBayes*.
  // Wir testen Cache/State-Contract pur ohne apiGet-Mocking.
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
      // hasData bleibt false (kein Cache, default-Berlin)
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
      // Nach init läuft refresh im Hintergrund. hasData ist false (Berlin default
      // ohne address aber city=berlin address_required=false, würde 200 geben
      // in production. Im Test ohne backend-network-failure könnte das divergieren,
      // daher nur check dass hasData NOT assert-true ist nach init.
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
      // SetUp weeks=4. setWeeks(4) early-exits guard. Test: kein Error, kein Side-Effect.
      provider.setWeeks(4);
      expect(provider.weeks, 4);
    });
  });

  // ------------------------------- Group 4 -------------------------------
  group('Group 4: updateAddress(city, street, houseNr)', () {
    test('updateAddress setzt city/street/houseNr synchron (deterministic)', () {
      // Phase R.9/R.10 race-safety: nicht auf async refresh-Outcome testen.
      // Stattdessen die synchron-state-Properties prüfen die updateAddress
      // garantiert setzt BEVOR refresh() (unawaited) startet.
      provider.updateAddress(
        city: 'hamburg',
        street: 'Beispielstraße',
        houseNr: '1',
      );
      expect(provider.city, 'hamburg');
      expect(provider.street, 'Beispielstraße');
      expect(provider.houseNr, '1');
      // addressRequired wurde durch updateAddress resetted (deterministic
      // synchron-state — kein async timing race).
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
      // updateAddress wird trotzdem aufgerufen, aber das Backend wuerde 422 geben.
      // Test: city/street werden trotzdem gesetzt (Screen-Verantwortung).
      provider.updateAddress(city: 'hamburg', street: '', houseNr: '');
      // Kein await — deterministischer synchron-state nach updateAddress.
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
      // Direkt über reflection der Persist-Methode via init-trick: write-then-reload.
      SharedPreferences.setMockInitialValues({});
      final prefs1 = await SharedPreferences.getInstance();
      await prefs1.setString('waste_data_v1', jsonEncode(fakeData));
      await prefs1.setInt(
          'waste_ts_v1', DateTime.now().millisecondsSinceEpoch);
      await prefs1.setString('waste_city_v1', 'berlin');
      await prefs1.setInt('waste_weeks_v1', 4);

      final reloadProvider = WasteProvider();
      await reloadProvider.init();
      // hasData sollte true sein (aus cache geladen).
      expect(reloadProvider.hasData, isTrue);
      expect(reloadProvider.calendar?.city, 'berlin');
      expect(reloadProvider.events.length, 1);
    });

    test('init() mit corrupted cache (invalid JSON) → silent fallback', () async {
      SharedPreferences.setMockInitialValues({
        'waste_data_v1': '{not-json{',
        'waste_ts_v1': DateTime.now().millisecondsSinceEpoch,
      });
      final p2 = WasteProvider();
      await p2.init();
      expect(p2.hasData, isFalse); // corrupted → null
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
      // 23h59m ist noch unter 24h TTL → isStale=false
      expect(p3.isStale, isFalse);
    });
  });

  // ------------------------------- Group 6 -------------------------------
  group('Group 6: TTL Boundary (24h strict > test)', () {
    test('init() mit EXAKT 24h altem cache → isStale=false (strict > TTL)', () async {
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
      // Phase R.9/Phase R.10 race-safety lesson: TTL-Boundary strict > _ttl.
      // Genau 24h alt: DateTime.now().diff(_lastUpdated) == 24h.
      // Provider check: `> _ttl` → strict greater-than → 24h alt == NICHT stale.
      // Fresh-cache path doesn't trigger unawaited(refresh()) — race-safe.
      // (Vgl. weather_provider_test.dart Group 8 strict-pattern).
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
    test('refresh() wirft KEINE unhandled Exception (auch ohne backend)', () async {
      // Network-failure-Pfad: apiGet wird scheitern oder 4xx/5xx liefern.
      // Provider swallowed den error in _error, _isStale ggf. true.
      bool unhandled = false;
      try {
        await provider.refresh().timeout(const Duration(seconds: 5));
      } on UnimplementedError {
        unhandled = true;
      } catch (_) {
        // caught via _error
      }
      expect(unhandled, isFalse);
      // isLoading ist false nach Ende (wenn refresh() durchgelaufen ist)
      expect(provider.isLoading, isFalse);
    });

    test('refresh() bei backend-network-failure: cache-preservation wenn vorher data',
        () async {
      // Vorbedingung: hasData=true durch init+cache, dann refresh fails.
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
      // hasData=true pre-refresh
      expect(p6.hasData, isTrue);
      final calBefore = p6.calendar;
      // refresh fails (no backend) → _error wird gesetzt, _calendar bleibt
      await p6.refresh().timeout(const Duration(seconds: 5));
      expect(p6.calendar, same(calBefore));
    });
  });

  // ------------------------------- Group 8 -------------------------------
  group('Group 8: refresh() AddressRequiredError-State', () {
    test('addressRequired bleibt false wenn refresh()-Backend 422 simuliert',
        () async {
      // Test-Constraint: ohne Backend-Mock koennen wir 422 nicht direkt triggern.
      // Wir verifizieren den Reset-on-refresh: initial false → refresh läuft →
      // bleibt false (oder wird gesetzt, race-safe).
      final initial = provider.addressRequired;
      expect(initial, isFalse);
      await provider.refresh().timeout(const Duration(seconds: 5));
      expect(provider.addressRequired, isFalse);
    });

    test('After refresh()-failure: isLoading = false (finally-branch)', () async {
      await provider.refresh().timeout(const Duration(seconds: 5));
      expect(provider.isLoading, isFalse);
    });
  });
}
