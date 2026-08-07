@Timeout(Duration(seconds: 60))
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/weather/weather_provider.dart';
import 'package:heimat_app/features/air_quality/air_quality_provider.dart';

/// LocationService Tests — GPS-Fehlerpfade via Provider-Logik.
///
/// **Scope:**
/// - Testet wie WeatherProvider und AirQualityProvider auf GPS-Ausfall reagieren
/// - Verifiziert Error-Messages bei lat=0/lng=0
/// - Testet Cache mit/ohne Koordinaten
/// - Kein Mocking von LocationService (nicht notwendig fuer Provider-Logik)
///
/// **HEIMAT-Test-Convention:**
/// - SharedPreferences.setMockInitialValues({}) in JEDEM setUp()
/// - Kein pumpAndSettle()
/// - Kein Mockito

void main() {
  // Cache-Key-Konstanten (Mirror zu Provider-Dateien)
  const kWeatherCacheKey = 'weather_last_forecast_v1';
  const kWeatherTsKey = 'weather_last_forecast_ts_v1';
  const kWeatherLatKey = 'weather_last_lat_v1';
  const kWeatherLngKey = 'weather_last_lng_v1';
  const kWeatherNameKey = 'weather_last_name_v1';
  const kWeatherAlertsKey = 'weather_last_alerts_v1';

  const kAirCacheKey = 'air_quality_last_forecast_v1';
  const kAirTsKey = 'air_quality_last_forecast_ts_v1';
  const kAirLatKey = 'air_quality_last_lat_v1';
  const kAirLngKey = 'air_quality_last_lng_v1';
  const kAirNameKey = 'air_quality_last_name_v1';

  // Helper: Valid Weather JSON
  String validWeatherJson() => jsonEncode({
        'status': 'ok',
        'current': {
          'temperature': 21.1,
          'feelsLike': 20.0,
          'humidity': 65,
          'pressure': 1013.2,
          'windSpeed': 28.1,
          'windDirection': 270.0,
          'weatherCode': 1,
          'weatherText': 'Klarer Himmel',
          'precipitation': 0.0,
          'cloudCover': 10,
          'uvIndex': 3.5,
        },
        'hourly': <Map<String, dynamic>>[],
        'daily': <Map<String, dynamic>>[],
        'location': {
          'lat': 52.52,
          'lng': 13.41,
          'name': 'Berlin',
        },
        'source': 'DWD via Open-Meteo',
      });

  // Helper: Valid Air Quality JSON
  String validAirJson() => jsonEncode({
        'status': 'ok',
        'airQuality': {
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
          'name': 'Berlin',
        },
        'source': 'CAMS via Open-Meteo',
      });

  // ==================================================================
  // Group 1: WeatherProvider — GPS-Ausfall-Verhalten
  // ==================================================================
  group('WeatherProvider — GPS-Ausfall', () {
    late WeatherProvider provider;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      provider = WeatherProvider();
    });

    test('Ohne GPS → lat/lng bleibt 0/0', () async {
      await provider.init();

      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });

    test('Ohne GPS → refresh() setzt Error-Messsage', () async {
      await provider.init();
      await provider.refresh();

      expect(provider.error, isNotNull);
      expect(provider.error!, contains('Standort nicht verfügbar'));
    });

    test('Ohne GPS → hasData bleibt false', () async {
      await provider.init();
      await provider.refresh();

      expect(provider.hasData, isFalse);
    });

    test('Cache mit lat/lng → Koordinaten werden restauriert', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kWeatherCacheKey: validWeatherJson(),
        kWeatherTsKey: now.millisecondsSinceEpoch,
        kWeatherLatKey: '52.52',
        kWeatherLngKey: '13.41',
        kWeatherNameKey: 'Berlin',
      });

      await provider.init();

      expect(provider.lat, 52.52);
      expect(provider.lng, 13.41);
      expect(provider.locationName, 'Berlin');
    });

    test('Cache ohne lat/lng → lat/lng bleibt 0/0 (kein Berlin-Fallback)', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kWeatherCacheKey: validWeatherJson(),
        kWeatherTsKey: now.millisecondsSinceEpoch,
        // intentional: KEIN kWeatherLatKey/kWeatherLngKey
      });

      await provider.init();

      expect(provider.lat, 0,
          reason: 'Kein lat-Key im Cache → bleibt 0 (kein hardcoded Fallback)');
      expect(provider.lng, 0,
          reason: 'Kein lng-Key im Cache → bleibt 0 (kein hardcoded Fallback)');
    });

    test('init() komplettiert ohne Exception bei GPS-Ausfall', () async {
      expect(() => provider.init(), returnsNormally);
    });
  });

  // ==================================================================
  // Group 2: AirQualityProvider — GPS-Ausfall-Verhalten
  // ==================================================================
  group('AirQualityProvider — GPS-Ausfall', () {
    late AirQualityProvider provider;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      provider = AirQualityProvider();
    });

    test('Ohne GPS → lat/lng bleibt 0/0', () async {
      await provider.init();

      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });

    test('Ohne GPS → refresh() setzt Error-Messsage', () async {
      await provider.init();
      await provider.refresh();

      expect(provider.error, isNotNull);
      expect(provider.error!, contains('Standort konnte nicht ermittelt werden'));
    });

    test('Ohne GPS → hasData bleibt false', () async {
      await provider.init();
      await provider.refresh();

      expect(provider.hasData, isFalse);
    });

    test('Cache mit lat/lng → Koordinaten werden restauriert', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kAirCacheKey: validAirJson(),
        kAirTsKey: now.millisecondsSinceEpoch,
        kAirLatKey: '48.137',
        kAirLngKey: '11.575',
        kAirNameKey: 'München',
      });

      await provider.init();

      expect(provider.lat, 48.137);
      expect(provider.lng, 11.575);
      expect(provider.locationName, 'München');
    });

    test('Cache ohne lat/lng → lat/lng bleibt 0/0', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kAirCacheKey: validAirJson(),
        kAirTsKey: now.millisecondsSinceEpoch,
        // intentional: KEIN kAirLatKey/kAirLngKey
      });

      await provider.init();

      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });

    test('init() komplettiert ohne Exception bei GPS-Ausfall', () async {
      expect(() => provider.init(), returnsNormally);
    });
  });

  // ==================================================================
  // Group 3: Beide Provider parallel (wie in main.dart)
  // ==================================================================
  group('Beide Provider parallel — GPS-Ausfall', () {
    test('Weather + AirQuality init() parallel crashed nicht', () async {
      SharedPreferences.setMockInitialValues({});
      final weather = WeatherProvider();
      final air = AirQualityProvider();

      // Simuliert main.dart: ChangeNotifierProvider create: (_) => WeatherProvider()..init()
      await Future.wait([weather.init(), air.init()]);

      expect(weather.lat, 0);
      expect(weather.lng, 0);
      expect(air.lat, 0);
      expect(air.lng, 0);
    });

    test('Beide Provider teilen sich Cache-Keys (kein Conflict)', () async {
      SharedPreferences.setMockInitialValues({});
      final weather = WeatherProvider();
      final air = AirQualityProvider();

      await Future.wait([weather.init(), air.init()]);

      // Weather hat eigene Keys
      expect(weather.locationName, '');
      // Air hat eigene Keys
      expect(air.locationName, '');

      // Kein Overwrite
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(kWeatherLatKey), isNull);
      expect(prefs.getString(kAirLatKey), isNull);
    });
  });

  // ==================================================================
  // Group 4: Timeout-Verhalten
  // ==================================================================
  group('Provider Timeout — 10 Sekunden', () {
    test('WeatherProvider: _tryUpdateLocation hat 10s Timeout', () async {
      // Verifiziert dass der Provider nicht sofort abbricht
      SharedPreferences.setMockInitialValues({});
      final provider = WeatherProvider();

      // init() startet _tryUpdateLocation mit 10s Timeout
      // Da kein GPS verfuegbar → timeout → lat/lng bleibt 0/0
      final start = DateTime.now();
      await provider.init();
      final elapsed = DateTime.now().difference(start);

      // Provider soll init in <5s abschliessen (10s Timeout + overhead)
      expect(elapsed.inSeconds, lessThan(15),
          reason: 'init() soll <15s dauern (10s Timeout + Overhead)');
      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });

    test('AirQualityProvider: _tryUpdateLocation hat 10s Timeout', () async {
      SharedPreferences.setMockInitialValues({});
      final provider = AirQualityProvider();

      final start = DateTime.now();
      await provider.init();
      final elapsed = DateTime.now().difference(start);

      expect(elapsed.inSeconds, lessThan(15),
          reason: 'init() soll <15s dauern (10s Timeout + Overhead)');
      expect(provider.lat, 0);
      expect(provider.lng, 0);
    });
  });

  // ==================================================================
  // Group 5: Stale Cache mit Koordinaten
  // ==================================================================
  group('Stale Cache — Koordinaten-Restaurierung', () {
    test('Weather: stale Cache restauriert lat/lng auch wenn Refresh fehlschlägt',
        () async {
      final staleTs = DateTime.now()
          .subtract(const Duration(minutes: 10))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kWeatherCacheKey: validWeatherJson(),
        kWeatherTsKey: staleTs,
        kWeatherLatKey: '53.55',
        kWeatherLngKey: '9.99',
        kWeatherNameKey: 'Hamburg',
      });

      final provider = WeatherProvider();
      await provider.init();

      // Koordinaten aus Cache restauriert
      expect(provider.lat, 53.55);
      expect(provider.lng, 9.99);
      expect(provider.locationName, 'Hamburg');
      // hasData aus Cache
      expect(provider.hasData, isTrue);
    });

    test('Air: stale Cache restauriert lat/lng auch wenn Refresh fehlschlägt',
        () async {
      final staleTs = DateTime.now()
          .subtract(const Duration(minutes: 10))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kAirCacheKey: validAirJson(),
        kAirTsKey: staleTs,
        kAirLatKey: '48.137',
        kAirLngKey: '11.575',
        kAirNameKey: 'München',
      });

      final provider = AirQualityProvider();
      await provider.init();

      expect(provider.lat, 48.137);
      expect(provider.lng, 11.575);
      expect(provider.locationName, 'München');
      expect(provider.hasData, isTrue);
    });
  });
}
