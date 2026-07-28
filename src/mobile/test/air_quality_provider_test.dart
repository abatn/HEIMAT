import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/air_quality/air_quality_provider.dart';

/// AirQualityProvider Tests — Cache/State-Logik.
///
/// **Scope-Grenze (siehe Gemini-Design-Analyse):**
/// - Tests fokussieren sich auf `_loadFromCache()` / init() / Getter.
/// - `refresh()` testet nur den real-failure-Pfad (Error-Handling-Contract).
/// - HTTP-Success-Pfad ist hier NICHT testbar weil `apiGet` keine
///   Injection-Schnittstelle hat (kein Production-Code-Refactor gewollt).
/// - DTO-Parsing ist vollstaendig in `air_quality_dto_test.dart` getestet.
///
/// **HEIMAT-Test-Convention:**
/// - `SharedPreferences.setMockInitialValues({})` in JEDEM setUp() (Isolation).
/// - Kein `pumpAndSettle()` (per AGENTS.md: Tests haengen sonst in
///   infinite-Animation-Loops fest).
/// - Kein Mockito: nur Stub-Daten ueber SharedPreferences-Mock + reale
///   Cache-Strings.
void main() {
  // ------------------------------------------------------------------
  // Cache-Key-Konstanten — Mirror zu air_quality_provider.dart
  // (private Konstanten duerfen in Tests ueber String-Literals
  //  reproduziert werden, kein Reflection noetig)
  // ------------------------------------------------------------------
  const kCacheKey = 'air_quality_last_forecast_v1';
  const kCacheTsKey = 'air_quality_last_forecast_ts_v1';
  const kLatKey = 'air_quality_last_lat_v1';
  const kLngKey = 'air_quality_last_lng_v1';
  const kNameKey = 'air_quality_last_name_v1';

  // ------------------------------------------------------------------
  // Helper: Valides Forecast-JSON
  // ------------------------------------------------------------------
  String validForecastJson({String locationName = 'Berlin'}) => jsonEncode({
        'status': 'ok',
        'current': {
          'europeanAqi': 25.0,
          'pm10': 15.2,
          'pm25': 8.5,
          'nitrogenDioxide': 12.3,
          'ozone': 85.2,
          'carbonMonoxide': 0.3,
          'sulphurDioxide': 2.1,
          'aqiLevel': 'Gut',
          'aqiColor': '#3ea83e',
        },
        'hourly': <Map<String, dynamic>>[],
        'location': {
          'lat': 52.52,
          'lng': 13.41,
          'name': locationName,
        },
        'source': 'CAMS via Open-Meteo',
      });

  late AirQualityProvider provider;

  setUp(() {
    // Per HEIMAT-Test-Pattern: SharedPreferences MOCK reset vor jedem Test
    // (siehe auth_provider_test.dart + auth_gate_test.dart).
    SharedPreferences.setMockInitialValues({});
    provider = AirQualityProvider();
  });

  // ==================================================================
  // Group 1: Initial State (Konstruktor-Defaults)
  // ==================================================================
  group('Initial state — Konstruktor-Defaults (Berlin-Fallback)', () {
    test('hasData ist false vor jeglichem Daten-Load', () {
      expect(provider.hasData, isFalse);
    });

    test('isLoading ist false initial', () {
      expect(provider.isLoading, isFalse);
    });

    test('error ist null initial', () {
      expect(provider.error, isNull);
    });

    test('forecast ist null initial', () {
      expect(provider.forecast, isNull);
    });

    test('lastUpdated ist null initial', () {
      expect(provider.lastUpdated, isNull);
    });

    test('isStale ist false initial', () {
      expect(provider.isStale, isFalse);
    });

    test('locationName defaulted auf "Berlin"', () {
      expect(provider.locationName, 'Berlin');
    });

    test('lat defaulted auf 52.52 (Berlin-Koordinate)', () {
      expect(provider.lat, 52.52);
    });

    test('lng defaulted auf 13.41 (Berlin-Koordinate)', () {
      expect(provider.lng, 13.41);
    });
  });

  // ==================================================================
  // Group 2: init() mit leerem Cache (Cold-Start)
  // ==================================================================
  group('init() mit leerem SharedPreferences-Cache', () {
    test('init() komplettiert ohne Exception', () async {
      await provider.init();
    });

    test('init() laesst hasData=false (kein Forecast aus Cache)', () async {
      await provider.init();
      expect(provider.hasData, isFalse);
      expect(provider.isStale, isFalse);
      expect(provider.error, isNull);
    });

    test('init() ruft notifyListeners mind. 1x auf', () async {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      await provider.init();

      expect(notifyCount, greaterThanOrEqualTo(1));
    });
  });

  // ==================================================================
  // Group 3: init() mit frischem Cache (TTL < 5min)
  // ==================================================================
  group('init() mit frischem Cache (TTL noch nicht abgelaufen)', () {
    test('laedt Forecast aus Cache + isStale=false', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
      });

      await provider.init();

      expect(provider.hasData, isTrue);
      expect(provider.forecast, isNotNull);
      expect(provider.forecast!.current.aqiLevel, 'Gut');
      expect(provider.forecast!.current.europeanAqi, 25.0);
      expect(provider.isStale, isFalse);
      expect(provider.lastUpdated, isNotNull);
    });

    test('restauriert lat/lng/locationName aus Cache-Keys', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(locationName: 'München'),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '48.137',
        kLngKey: '11.575',
        kNameKey: 'München',
      });

      await provider.init();

      expect(provider.lat, 48.137);
      expect(provider.lng, 11.575);
      expect(provider.locationName, 'München');
    });
  });

  // ==================================================================
  // Group 4: init() mit stale Cache (TTL > 5min)
  //
  // ⚠️  RACE-CONDITION-HINWEIS: init() ruft unawaited(refresh()) wenn
  // hasData && _isStale. In CI mit Network-Zugang zum Production-Backend
  // kann refresh resolved sein BEVOR die Assertion ausgeführt wird → flake.
  //
  // Daher assertieren wir nur stabile Properties (hasData, lastUpdated aus
  // Cache). Die TTL-Boundary-Logik selbst (4:55 vs 5:00 vs 5:01) wird in
  // Group 8 ohne Refresh-Trigger getestet (Fresh-Cache-Pfad → race-free).
  // ==================================================================
  group('init() mit stale Cache (>5min TTL)', () {    test(
        'laedt Forecast trotz stale Timestamp (Background-Refresh wird getriggert)',
        () async {
      final staleTs = DateTime.now()
          .subtract(const Duration(minutes: 10))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: staleTs,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
      });

      await provider.init();

      // Stabile Properties: cache-geladen, Forecast-Referenz gesetzt,
      // Timestamp aus Cache uebernommen (nicht racy, da Cache-Read in
      // _loadFromCache synchron abgeschlossen ist bevor unawaited(refresh())
      // gestartet wird).
      expect(provider.hasData, isTrue,
          reason: 'Forecast-Cache wurde auch bei stale Timestamp geladen');
      expect(provider.forecast, isNotNull);
      expect(provider.lastUpdated, isNotNull,
          reason: 'lastUpdated aus Cache-Timestamp restauriert');
      expect(
        provider.lastUpdated!.isBefore(
            DateTime.now().subtract(const Duration(minutes: 9))),
        isTrue,
        reason:
            'Cache-Timestamp war um ~10min versetzt, lastUpdated reflektiert das',
      );
    });
  });

  // ==================================================================
  // Group 5: init() mit korruptem Cache (defensive Fallbacks)
  // ==================================================================
  group('init() mit korruptem Cache (Silent-Fallback)', () {
    test('stilles Recovery bei ungueltigem JSON-String', () async {
      SharedPreferences.setMockInitialValues({
        kCacheKey: 'this is not json{{{',
      });

      await provider.init();

      // Provider darf NICHT crashen, kein Error-State, kein partial forecast.
      expect(provider.hasData, isFalse);
      expect(provider.error, isNull);
    });

    test('stilles Recovery bei JSON ohne forecast-Schluessel', () async {
      SharedPreferences.setMockInitialValues({
        kCacheKey: jsonEncode({'unexpected': 'shape'}),
      });

      await provider.init();

      expect(provider.hasData, isFalse);
      expect(provider.error, isNull);
    });
  });

  // ==================================================================
  // Group 6: init() mit partiellem Cache (Default-Fallbacks)
  // ==================================================================
  group('init() mit partiellem Cache (Berlin-Defaults bei fehlenden Keys)', () {
    test('behaelt Berlin-Defaults wenn lat/lng-Keys fehlen', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        // intentionally: KEINE kLatKey/kLngKey/kNameKey
      });

      await provider.init();

      expect(provider.lat, 52.52,
          reason: 'Berlin-Fallback wenn kein lat im Cache');
      expect(provider.lng, 13.41,
          reason: 'Berlin-Fallback wenn kein lng im Cache');
      expect(provider.locationName, 'Berlin',
          reason:
              'locationName aus Konstruktor-Default wenn kein name im Cache');
    });

    test(
        'Last-Cached-Name wird uebernommen wenn nur name-Key fehlt, lat/lng da',
        () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '48.0',
        kLngKey: '11.0',
        // intentionally: KEIN kNameKey
      });

      await provider.init();

      expect(provider.lat, 48.0);
      expect(provider.lng, 11.0);
      expect(provider.locationName, 'Berlin',
          reason: 'locationName bleibt Default wenn name-Key fehlt');
    });
  });

  // ==================================================================
  // Group 7: refresh() Error-Handling-Contract
  //
  // HINWEIS: refresh() ruft apiGet() (top-level aus core/api/api_client.dart)
  // welcher eine echte HTTP-Anfrage gegen das Production-Backend macht.
  // Da Mocks verboten sind (AGENTS.md Mock-Policy), testen wir hier nur
  // den Error-Handling-Contract: "refresh() wirft KEINE unhandled Exception
  //  — der try/catch-Block fängt alle Fehler ab".
  //
  // In CI ohne Netzwerk wirft apiGet() einen Network-Error → catch in
  // refresh() setzt _error + isStale=true (oder false bei _forecast==null).
  // Der Test ist robust gegen Network-Up/Down und gegen Backend-Erreichbarkeit.
  // ==================================================================
  group('refresh() Error-Handling (kein Mockito, real-failure-basiert)', () {
    test('refresh() resolved ohne unhandled Exception bei leerem Cache',
        () async {
      // Der Test passiert wenn:
      // - CI kein Netzwerk hat → apiGet() wirft → catch setzt _error
      // - CI Netzwerk hat und Backend erreichbar → apiGet() liefert status='ok' → refresh() setzt hasData=true
      // Beide Pfade sind gueltiger Production-Code und der Test verifiziert
      // dass der Provider in _beiden_ Faellen stabil bleibt.
      await provider.refresh();

      expect(provider.isLoading, isFalse,
          reason: 'isLoading wird im finally-Block auf false zurueckgesetzt');
    });

    test(
        'refresh() mit vorher geladenem Cache behält Forecast bei Network-Failure',
        () async {
      // Cache mit stale=10min einrichten (hasData=true, isStale=true)
      final staleTs = DateTime.now()
          .subtract(const Duration(minutes: 10))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: staleTs,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
      });
      await provider.init();

      // Forecast aus Cache vorhanden
      expect(provider.hasData, isTrue);

      // refresh() triggern
      await provider.refresh();

      // Nach refresh(): isLoading zurueck auf false (finally-Block),
      // und hasData bleibt true WENN Cache-Layer Forecast behalten hat.
      expect(provider.isLoading, isFalse);
      // Forecast-Referenz wird NICHT genullt im catch-Block (siehe Code).
      expect(provider.forecast, isNotNull,
          reason:
              'Cache-Forecast bleibt bei Network-Failure erhalten (graceful degradation)');
    });
  });

  // ==================================================================
  // Group 8: TTL-Boundary (5min) — Race-Free via Fresh-Cache-Pfad
  //
  // Logik: `_isStale = DateTime.now().difference(_lastUpdated!) > _ttl`
  // wobei `_ttl = Duration(minutes: 5)`. Der Vergleich ist STRICT (>) —
  // exakt 5 Minuten ist also NOCH NICHT stale.
  //
  // Diese Tests nutzen den Fresh-Cache-Pfad (<5min Old → isStale=false →
  // init() ruft KEIN refresh()) → Race-Free auch in Network-CI.
  //
  // Wir testen die 2 nicht-racen Grenzfälle um die TTL-Logik zu pinnen
  // und Regressions bei TTL-Aenderung abzufangen.
  // ==================================================================
  group('TTL-Boundary (5min) — Race-Free via Fresh-Cache-Pfad', () {
    test('isStale=false bei Cache-Timestamp 4min55s alt (knapp unter TTL)',
        () async {
      final freshTs = DateTime.now()
          .subtract(const Duration(minutes: 4, seconds: 55))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: freshTs,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
      });

      await provider.init();

      expect(provider.hasData, isTrue);
      expect(provider.isStale, isFalse,
          reason:
              'Bei 4:55 ist diff < 5:00 (knapp unter TTL) → Strict > ergibt false');
    });

    test('isStale=false bei Cache-Timestamp EXAKT 5min alt (TTL-Boundary)',
        () async {
      // diff == _ttl → strict > ergibt false → NICHT stale
      final exactBoundaryTs = DateTime.now()
          .subtract(const Duration(minutes: 5))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: exactBoundaryTs,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
      });

      await provider.init();

      expect(provider.hasData, isTrue);
      expect(provider.isStale, isFalse,
          reason:
              '5min EXAKT ergibt diff==ttl, strict `>` ist false (Boundary inclusive)');
    });
  });
}
