import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/weather/weather_provider.dart';
import 'package:heimat_app/features/weather/weather_dto.dart';
import 'package:heimat_app/features/ai/local_sentiment_classifier.dart';

/// WeatherProvider Tests — Cache/State-Logik.
///
/// **Scope-Grenze (Mirror zu air_quality_provider_test.dart, Phase R.9):**
/// - Tests fokussieren auf `_loadFromCache()` / init() / Getter /
///   refresh()-Error-Contract.
/// - `refresh()` testet nur real-failure-Pfad (Error-Handling-Contract)
///   — kein Production-Code-Refactor fuer apiGet-DI.
/// - DTO-Parsing ist in `weather_dto_test.dart` (Cross-Service-Insights)
///   bzw. im separaten Test-Layer.
/// - HTTP-Success-Pfad ist nicht deterministisch testbar in CI.
///
/// **Weather-Spezifika (vs AirQualityProvider):**
/// - **6 cache keys** (statt 5): forecast, ts, lat, lng, name, **alerts**
/// - **Constructor-Injection** fuer `LocalSentimentClassifier` (DI-friendly!)
///   → Tests koennen `_StubClassifier` mit deterministischem Output uebergeben.
/// - **2 unawaited-Tasks in init()**: refresh() (wenn stale) + _tryUpdateLocation()
/// - **1 unawaited-Task in _loadFromCache()**: _restoreSentimentFromCache()
/// - **Refresh-Spec**: forecast apiGet + classifier + alerts apiGet (sequential).
///
/// **HEIMAT-Test-Convention (gemini Design-Analyse):**
/// - `SharedPreferences.setMockInitialValues({})` in JEDEM setUp().
/// - Kein `pumpAndSettle()` (per AGENTS.md: infinite-Animation-Hang).
/// - Kein Mockito: nur `_StubClassifier` (DI-Stub) + reale Cache-Strings.
/// - Memory-Layout-Mirror zu `air_quality_provider_test.dart`.
///
/// **Mock-Policy-Konformitaet:**
/// - Test-File in `src/mobile/test/` (audit-no-mocks.sh SCAN_PATHS ausgeschlossen).
/// - `_StubClassifier` ist test-only DI-Stub, kein verbotener Identifier.
/// - Mirror-Pattern zu `_StubFinance` in `app_smoke_test.dart:22` (HEIMAT Standard).

/// _StubClassifier — Test-only DI-Stub fuer LocalSentimentClassifier.
///
/// **Mock-Policy:** Mirror-Pattern zu `_StubFinance extends FinanceProvider`
/// in `app_smoke_test.dart:22`. NICHT in audit-no-mocks.sh SCAN_PATHS.
/// Klassennamen mit `_Stub*`-Prefix sind HEIMAT-Standard (kein verbotener
/// Identifier aus `fundLocal`/`_computeMockLiveStatus`/`StubNaiveBayes*`).
///
/// Parameter:
/// - `shouldThrow=true`: simuliert Classifier-Crash → testet try/catch in refresh()
/// - `score/axis/emoji`: deterministische SentimentResult-Werte fuer Assertions.
class _StubClassifier implements LocalSentimentClassifier {
  final bool shouldThrow;
  final double score;
  final SentimentAxis axis;
  final String emoji;
  final String source;

  _StubClassifier({
    this.shouldThrow = false,
    this.score = 0.8,
    this.axis = SentimentAxis.positive,
    this.emoji = '🌟',
    this.source = 'stub',
  });

  @override
  Future<SentimentResult> classify(String text) async {
    if (shouldThrow) {
      // Wirft synchron innerhalb async → wird vom try/catch in refresh()
      // gefangen. KEIN Mock-Score (User-Regel).
      throw Exception('Simulated classifier failure (test-only)');
    }
    return SentimentResult(
      score: score,
      axis: axis,
      emoji: emoji,
      source: source,
      computedAt: DateTime.now(),
    );
  }
}

void main() {
  // ------------------------------------------------------------------
  // Cache-Key-Konstanten — Mirror zu weather_provider.dart
  // (private Konstanten duerfen in Tests ueber String-Literals
  //  reproduziert werden, kein Reflection noetig)
  // ------------------------------------------------------------------
  const kCacheKey = 'weather_last_forecast_v1';
  const kCacheTsKey = 'weather_last_forecast_ts_v1';
  const kLatKey = 'weather_last_lat_v1';
  const kLngKey = 'weather_last_lng_v1';
  const kNameKey = 'weather_last_name_v1';
  const kAlertsKey = 'weather_last_alerts_v1';

  // ------------------------------------------------------------------
  // Helper: Valides Forecast-JSON (CurrentWeatherDto + Hourly + Daily + Location)
  // ------------------------------------------------------------------
  String validForecastJson({String locationName = 'Berlin'}) => jsonEncode({
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
          'name': locationName,
        },
        'source': 'DWD via Open-Meteo',
      });

  // ------------------------------------------------------------------
  // Helper: Valides Alerts-JSON (WeatherAlertsResponse + WeatherAlert)
  // ------------------------------------------------------------------
  String validAlertsJson({bool withAlert = false}) => jsonEncode({
        'status': 'ok',
        'alerts': withAlert
            ? <Map<String, dynamic>>[
                {
                  'code': 'sturm',
                  'severity': 'warning',
                  'title': 'Sturmwarnung',
                  'message': 'Wind bis 80 km/h',
                  'dayIndex': 1,
                  'metric': {
                    'label': 'Windgeschwindigkeit',
                    'value': '75',
                    'unit': 'km/h',
                  },
                },
              ]
            : <Map<String, dynamic>>[],
        'generatedAt': '2026-07-27T15:00:00Z',
        'source': 'DWD regelbasiert',
        'attribution': 'DWD气象局',
      });

  late WeatherProvider provider;

  setUp(() {
    // Per HEIMAT-Test-Pattern: SharedPreferences MOCK reset vor jedem Test.
    SharedPreferences.setMockInitialValues({});
    // Default-Stub mit shouldThrow=false fuer die meisten Tests.
    provider = WeatherProvider(classifier: _StubClassifier());
  });

  // ==================================================================
  // Group 1: Initial State — Konstruktor-Defaults (Berlin-Fallback)
  //
  // Weather-spezifisch: 9 AQ-Defaults + sentiment/alerts/hasAlerts = 12
  // ==================================================================
  group('Initial state — Konstruktor-Defaults (Berlin-Fallback)', () {
    test('hasData ist false initial', () {
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

    // --- Weather-spezifische Defaults ---
    test('sentiment ist null initial (kein refresh gelaufen)', () {
      expect(provider.sentiment, isNull,
          reason:
              'Sentiment wird erst nach refresh()/unawaited-restore gesetzt');
    });

    test('alerts ist empty initial (constructor default: const [])', () {
      expect(provider.alerts, isEmpty,
          reason: '_alerts = const [] Default im Field-Initializer');
    });

    test('hasAlerts ist false initial', () {
      expect(provider.hasAlerts, isFalse);
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

    // --- Weather: alerts/sentiment bleiben nach leerem init() empty/null ---
    test('init() mit leerem Cache hat alerts=[] und sentiment=null', () async {
      await provider.init();
      // Microtask abwarten — _restoreSentimentFromCache ist unawaited in
      // _loadFromCache. Bei leerem Cache ist _forecast==null → frueh-return
      // → sentiment bleibt auf jeden Fall null.
      await Future<void>.delayed(Duration.zero);
      expect(provider.alerts, isEmpty);
      expect(provider.sentiment, isNull);
    });
  });

  // ==================================================================
  // Group 3: init() mit frischem Cache (TTL < 5min)
  //
  // Weather-spezifisch: Alerts werden separat aus Cache geladen,
  // _restoreSentimentFromCache wird unawaited gefeuert und setzt
  // sentiment NACH init() return. Microtask-Wait fuer deterministische
  // Sentiment-Assertion.
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
      expect(provider.forecast!.current.temperature, 21.1);
      expect(provider.forecast!.current.weatherText, 'Klarer Himmel');
      expect(provider.isStale, isFalse);
      expect(provider.lastUpdated, isNotNull);
    });

    test('restauriert lat/lng/locationName aus Cache-Keys', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(locationName: 'Hamburg'),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '53.55',
        kLngKey: '9.99',
        kNameKey: 'Hamburg',
      });

      await provider.init();

      expect(provider.lat, 53.55);
      expect(provider.lng, 9.99);
      expect(provider.locationName, 'Hamburg');
    });

    // --- Weather: Alerts separat aus kAlertsKey ---
    test('laedt Alerts aus kAlertsKey-Key (separate Cache-Schicht)', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
        kAlertsKey: validAlertsJson(withAlert: true),
      });

      await provider.init();

      expect(provider.alerts, hasLength(1),
          reason: '1 Sturm-Alert wurde im Cache abgelegt');
      expect(provider.alerts.first.code, AlertCode.sturm);
      expect(provider.alerts.first.severity, AlertSeverity.warning);
      expect(provider.hasAlerts, isTrue);
    });

    test('frischer Cache ohne Alerts-Key → alerts bleibt empty', () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
        // intentionally: KEIN kAlertsKey
      });

      await provider.init();

      expect(provider.alerts, isEmpty);
      expect(provider.hasAlerts, isFalse);
    });

    // --- Weather: Sentiment-Restore nach init() — RACE-SAFE via Microtask ---
    // ⚠️ _restoreSentimentFromCache ist unawaited in _loadFromCache, also
    // setzt sentiment erst NACH init() return. Mit `_StubClassifier.classify`
    // (async ohne await) ist die Future nach 1 Microtask-Hop resolved.
    test(
        'nach Microtask-Wait: sentiment wird vom Stub-Classifier gesetzt (Restore)',
        () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
      });

      await provider.init();
      // Microtask-Wait: gibt unawaited(_restoreSentimentFromCache()) Zeit
      // um `_classifier.classify(...)` zu resolved → notifyListeners → done.
      await Future<void>.delayed(Duration.zero);

      expect(provider.sentiment, isNotNull,
          reason: 'unawaited-restore hat Stub-Classifier.resolve abgewartet');
      expect(provider.sentiment!.score, 0.8,
          reason: 'Stub-Classifier-Default: score=0.8');
      expect(provider.sentiment!.source, 'stub');
    });
  });

  // ==================================================================
  // Group 4: init() mit stale Cache (TTL > 5min)
  //
  // ⚠️ RACE-CONDITION-HINWEIS: init() ruft unawaited(refresh()) wenn
  // hasData && _isStale. In CI mit Network-Zugang zum Production-Backend
  // kann refresh resolved sein BEVOR die Assertion ausgeführt wird → flake.
  //
  // Daher assertieren wir nur stabile Properties (hasData, lastUpdated aus
  // Cache). Die TTL-Boundary-Logik selbst (4:55 vs 5:00 vs 5:01) wird in
  // Group 8 ohne Refresh-Trigger getestet (Fresh-Cache-Pfad → race-free).
  //
  // Weather-Add: Sentiment ist nach init() + Microtask NICHT deterministisch
  // (kann vom cache-restore gesetzt sein bevor refresh triggert; kann null
  // sein wenn refresh's _sentiment = null reset schneller ist). Wir
  // assertieren NICHT hart auf sentiment-Wert in der stale-Pfad.
  // ==================================================================
  group('init() mit stale Cache (>5min TTL)', () {
    test(
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

      // Stabile Properties (aus Cache geladen VOR refresh).
      expect(provider.hasData, isTrue,
          reason: 'Forecast-Cache wurde auch bei stale Timestamp geladen');
      expect(provider.forecast, isNotNull);
      expect(provider.lastUpdated, isNotNull,
          reason: 'lastUpdated aus Cache-Timestamp restauriert');
      expect(
          provider.lastUpdated!
              .isBefore(DateTime.now().subtract(const Duration(minutes: 9))),
          isTrue,
          reason: 'lastUpdated reflektiert 10min-Versatz aus Cache');
    });

    // Weather-spezifisch: stale Forecast triggert refresh. Alerts werden
    // initial aus dem Cache geladen, koennen aber durch refresh ueberschrieben
    // werden wenn Network verfuegbar (race). Wir testen NUR dass init() nicht
    // crashst und forecast-cache geladen wurde. Die genauen alerts-Werte
    // sind race-prone (kann von refresh ueberschrieben werden in Network-CI).
    test('stale Forecast mit alerts-Cache: init() crashst nicht', () async {
      final staleTs = DateTime.now()
          .subtract(const Duration(minutes: 10))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: staleTs,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
        kAlertsKey: validAlertsJson(withAlert: true),
      });

      await provider.init();

      // Forecast aus Cache geladen (vor refresh).
      expect(provider.hasData, isTrue);
      // Alerts-Wert nicht hart assertiert: race-prone weil refresh async
      // alerts via API ueberschreiben kann.
    });
  });

  // ==================================================================
  // Group 5: init() mit korruptem Cache (Silent-Fallback)
  //
  // Weather-Add: kAlertsKey separat prüfen — try/catch im alerts-Block
  // ist INNERHALB des äusseren try/catch, also keine doppelte korruption.
  // ==================================================================
  group('init() mit korruptem Cache (Silent-Fallback)', () {
    test('stilles Recovery bei ungueltigem forecast-JSON', () async {
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

    // --- Weather-Add: Alert-Cache separat prüfen ---
    test(
        'forecast OK + korrupter alerts-Cache => alerts bleibt empty (silent recovery)',
        () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
        kAlertsKey: 'corrupted alerts json{{{',
      });

      await provider.init();
      // Microtask-Wait weil _restoreSentimentFromCache unawaited ist.
      await Future<void>.delayed(Duration.zero);

      // Forecast wurde geladen (Cache-JSON OK).
      expect(provider.hasData, isTrue);
      // Alerts-Cache wurde im inneren try/catch geschluckt → empty.
      expect(provider.alerts, isEmpty,
          reason:
              'Korrupter alertsCache wird im inneren try/catch silently gefangen');
      expect(provider.hasAlerts, isFalse);
    });
  });

  // ==================================================================
  // Group 6: init() mit partiellem Cache (Berlin-Defaults)
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

    test('Last-Cached-Name wird uebernommen wenn nur name-Key fehlt', () async {
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

    // --- Weather-Add: Partial alerts-Key (forecast only, no alerts) ---
    test(
        'forecast-cache OK + alerts-Key fehlt => forecast geladen, alerts leer',
        () async {
      final now = DateTime.now();
      SharedPreferences.setMockInitialValues({
        kCacheKey: validForecastJson(),
        kCacheTsKey: now.millisecondsSinceEpoch,
        kLatKey: '52.52',
        kLngKey: '13.41',
        kNameKey: 'Berlin',
        // intentionally: KEIN kAlertsKey
      });

      await provider.init();

      expect(provider.hasData, isTrue,
          reason: 'Forecast-Cache unabhaengig von alerts-Cache-Key');
      expect(provider.alerts, isEmpty,
          reason: 'Fehlender alerts-Key → alerts bleibt empty');
      expect(provider.hasAlerts, isFalse);
    });
  });

  // ==================================================================
  // Group 7: refresh() Error-Handling-Contract
  //
  // Weather-spezifisch:
  // - refresh() ruft am Anfang _sentiment = null → wir verifizieren das auch
  //   nach erfolglosem refresh().
  // - Classifier-Crash ist via DI-Stub simulierbar (_StubClassifier mit
  //   shouldThrow=true). Der inner try/catch in refresh() fängt das ab
  //   → _sentiment bleibt null.
  // - Alerts-Endpoint-Failure ist NICHT von forecast-Failure isoliert
  //   testbar ohne apiGet-DI-Refactor → nicht in scope.
  // ==================================================================
  group('refresh() Error-Handling (kein Mockito, real-failure-basiert)', () {
    test('refresh() resolved ohne unhandled Exception bei leerem Cache',
        () async {
      // Beide Pfade (CI ohne Network → exception, CI mit Network → success)
      // sind gueltiger Production-Code und der Test verifiziert
      // dass der Provider stabil bleibt.
      await provider.refresh();

      expect(provider.isLoading, isFalse,
          reason: 'isLoading wird im finally-Block auf false zurueckgesetzt');
    });

    test(
        'refresh() mit Classifier-Crash: Provider crashed nicht, sentiment bleibt null',
        () async {
      // DI-Stub wirft → inner try/catch in refresh() fängt das → _sentiment=null.
      SharedPreferences.setMockInitialValues({});
      provider =
          WeatherProvider(classifier: _StubClassifier(shouldThrow: true));

      await provider.refresh();

      // Provider lebt, kein unhandled throw.
      expect(provider.isLoading, isFalse);
      expect(provider.sentiment, isNull,
          reason:
              'Classifier-throw wird im try/catch in refresh() abgefangen → _sentiment=null');
    });

    // --- Weather-Add: refresh() mit vorher geladenem Cache ---
    test(
        'refresh() mit vorher geladenem Cache behaelt Forecast bei Network-Failure',
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
  // init() ruft KEIN refresh() + KEIN _restoreSentimentFromCache that wins
  // race) → Race-Free auch in Network-CI.
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
