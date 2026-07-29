import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import '../../core/services/location_service.dart';
import '../ai/local_sentiment_classifier.dart';
import 'weather_dto.dart';

/// WeatherProvider — Backend-Anbindung für das Wetter-Mini-Program.
///
/// **Architektur (Phase E):**
/// - Online: ruft /api/weather/forecast?lat=&lng= (Backend hat 5-Min Cache + Retry)
/// - Cache-Tier 1 (Memory): ein _forecast-Feld für sofortiges Tab-Switching
/// - Cache-Tier 2 (SharedPreferences): JSON + Timestamp persistent
/// - Stale Graceful Degradation: zeigt letzte Daten + isStale=true statt Error-Screen
/// - Location: LocationService.getCurrentLocation() (kein hardcoded Fallback)
///
/// **AI-Architektur.md:** Kein Cloud-AI-Call hier. Reine DTO-Daten.
class WeatherProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // Cache-Keys + TTL
  // ------------------------------------------------------------------
  static const String _kCacheKey = 'weather_last_forecast_v1';
  static const String _kCacheTsKey = 'weather_last_forecast_ts_v1';
  static const String _kLatKey = 'weather_last_lat_v1';
  static const String _kLngKey = 'weather_last_lng_v1';
  static const String _kNameKey = 'weather_last_name_v1';
  static const String _kAlertsKey = 'weather_last_alerts_v1';
  static const Duration _ttl = Duration(minutes: 5);

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  WeatherForecastResponse? _forecast;

  // Kein hardcoded Standort — wird via LocationService + Cache dynamisch geladen
  double _lat = 0;
  double _lng = 0;
  String _locationName = '';
  DateTime? _lastUpdated;
  bool _isStale = false;

  // ------------------------------------------------------------------
  // AI Hook (Phase E - On-Device Sentiment-Klassifikation)
  // ------------------------------------------------------------------
  /// Classifier-Impl ist injizierbar (Constructor) für Tests + spaeteren
  /// TFLite-Swap. Phase R Default = UninitialisedClassifier (ehrlich "AI noch
  /// nicht aktiv", kein Mock-Score). 0 Bytes Netzwerk-Traffic (On-Device).
  final LocalSentimentClassifier _classifier;

  /// Phase E: Sentiment-Score fuer current.weatherText.
  /// Wird in refresh() gesetzt nachdem forecast parsiert wurde.
  SentimentResult? _sentiment;

  /// Phase E Forecast-Schicht: Unwetter-Alerts vom Backend Rule-Engine.
  /// Concurrent-fetched mit dem Forecast-Endpoint /api/weather/alerts.
  /// Default = leere Liste (kein Alert = keine Warnung).
  List<WeatherAlert> _alerts = const [];

  WeatherProvider({LocalSentimentClassifier? classifier})
      : _classifier = classifier ?? defaultSentimentClassifier;

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  WeatherForecastResponse? get forecast => _forecast;
  DateTime? get lastUpdated => _lastUpdated;
  bool get isStale => _isStale;
  String get locationName => _locationName;
  double get lat => _lat;
  double get lng => _lng;

  /// Aktuelles Sentiment-Result (Phase R: UninitialisedClassifier = "AI noch nicht initialisiert").
  /// Null solange noch kein refresh() gelaufen ist.
  SentimentResult? get sentiment => _sentiment;

  /// Phase E Alerts-Liste (Unwetter-Vorhersagen vom Backend).
  /// Immer sortiert vom Backend (dayIndex ASC, severity DANGER > WARNING > INFO).
  List<WeatherAlert> get alerts => _alerts;

  /// True wenn aktive Alerts vorhanden (= Banner sichtbar).
  bool get hasAlerts => _alerts.isNotEmpty;

  /// True wenn (cached ODER live) Daten verfügbar — Widget kann rendern
  bool get hasData => _forecast != null;

  // ------------------------------------------------------------------
  // init — Lade Cache + versuche Location (best-effort, 3s timeout)
  // ------------------------------------------------------------------
  Future<void> init() async {
    await _loadFromCache();
    notifyListeners();
    // MAJOR-Fix (Code-Reviewer): Wenn Cache geladen UND aelter als TTL,
    // automatisch refresh() triggern. Sonst sieht der User stale data
    // fuer Ewigkeit — bis manuelles pull-to-refresh.
    if (hasData && _isStale) {
      unawaited(refresh());
    }
    // Location update ist best-effort — bei Fehler kein Fetch (Standort unbekannt)
    unawaited(_tryUpdateLocation());
  }

  Future<void> _tryUpdateLocation() async {
    try {
      final pos = await LocationService.getCurrentLocation().timeout(
        const Duration(seconds: 3),
        onTimeout: () => null,
      );
      if (pos != null) {
        _lat = pos.latitude;
        _lng = pos.longitude;
        await _persistLocation();
        notifyListeners();
        // Auto-Refresh wenn Location sich geändert hat
        await refresh();
      }
    } catch (_) {
      // silently ignore — Standort aktuell nicht verfuegbar
    }
  }

  // ------------------------------------------------------------------
  // refresh — Live-Fetch vom Backend
  // ------------------------------------------------------------------
  Future<void> refresh() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    // Kein hardcoded Standort — wenn _lat==0 && _lng==0 (Location nicht verfuegbar),
    // keinen leeren API-Call starten. User sieht "Standort nicht verfuegbar".
    if (_lat == 0 && _lng == 0) {
      _error = 'Standort nicht verfügbar — bitte Standortzugriff erlauben.';
      _isLoading = false;
      notifyListeners();
      return;
    }
    _sentiment = null;
    notifyListeners();
    try {
      final data = await apiGet('/api/weather/forecast?lat=$_lat&lng=$_lng');
      if (data['status'] != 'ok') {
        throw Exception(
          data['message']?.toString() ?? 'Backend lieferte Fehler-Status',
        );
      }
      _forecast = WeatherForecastResponse.fromJson(data);
      _locationName =
          (data['location'] as Map<String, dynamic>?)?['name']?.toString() ??
              _locationName;
      _lastUpdated = DateTime.now();
      _isStale = false;

      // Phase E AI Hook: on-device Sentiment-Klassifikation.
      // Pattern ist TFLite-swap-ready: spaeter nur Impl austauschen,
      // Aufruf-Site bleibt unveraendert. Classifier ist injizierbar
      // via Constructor fuer Test-Stubs.
      try {
        _sentiment = await _classifier.classify(_forecast!.current.weatherText);
      } catch (_) {
        // Classifier-Fehler ist nicht-kritisch: ohne Sentiment weiterleben.
        _sentiment = null;
      }

      // Cache persistieren
      await _persistForecast(data);
      await _persistLocation();

      // Phase E Forecast-Schicht: Unwetter-Alerts (separater Endpoint).
      // /api/weather/alerts liefert Rule-Engine Output (kein Cloud-AI).
      // Fehler ist NICHT critical: ohne Alerts nur keine Banner oben.
      try {
        final alertsData =
            await apiGet('/api/weather/alerts?lat=$_lat&lng=$_lng');
        final alertsResp = WeatherAlertsResponse.fromJson(alertsData);
        _alerts = alertsResp.alerts;
        await _persistAlerts(alertsResp);
      } catch (_) {
        // Alerts-Fehler: behalte vorherige _alerts (oder leere Liste)
      }
    } catch (e) {
      _error = e.toString();
      // Wenn wir alte Daten haben: Als stale markieren, nicht überschreiben
      _isStale = _forecast != null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ------------------------------------------------------------------
  // Cache: Prefs Tier 2 (persistent bis 5min TTL)
  // ------------------------------------------------------------------
  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCacheKey);
      if (raw == null) return;

      final data = jsonDecode(raw) as Map<String, dynamic>;
      _forecast = WeatherForecastResponse.fromJson(data);
      _locationName = prefs.getString(_kNameKey) ?? _locationName;
      final tsMs = prefs.getInt(_kCacheTsKey);
      if (tsMs != null) {
        _lastUpdated = DateTime.fromMillisecondsSinceEpoch(tsMs);
        _isStale = DateTime.now().difference(_lastUpdated!) > _ttl;
      }

      final lat = prefs.getString(_kLatKey);
      final lng = prefs.getString(_kLngKey);
      if (lat != null && lng != null) {
        _lat = double.tryParse(lat) ?? _lat;
        _lng = double.tryParse(lng) ?? _lng;
      }

      // Phase E Forecast-Schicht: Alerts aus Cache restaurieren damit
      // Banner direkt nach Cold-Start sichtbar (kein Network-Roundtrip).
      final alertsRaw = prefs.getString(_kAlertsKey);
      if (alertsRaw != null) {
        try {
          final alertsJson = jsonDecode(alertsRaw) as Map<String, dynamic>;
          _alerts = WeatherAlertsResponse.fromJson(alertsJson).alerts;
        } catch (_) {
          // Corrupted alerts cache — silently ignore
        }
      }

      // MAJOR-Fix: Klassifiziere gecachten Wetter-Text sofort nach Restore,
      // damit die KI-Wetterstimmung-Row direkt nach Cold-Start ohne
      // Netzwerk-Roundtrip sichtbar ist. Fire-and-forget + notifyListeners()
      // wenn Klassifikation fertig.
      unawaited(_restoreSentimentFromCache());
    } catch (_) {
      // Cache corrupted — silent fallback to in-memory-only mode
      _forecast = null;
    }
  }

  Future<void> _restoreSentimentFromCache() async {
    if (_forecast == null) return;
    try {
      _sentiment = await _classifier.classify(_forecast!.current.weatherText);
      notifyListeners();
    } catch (_) {
      _sentiment = null;
    }
  }

  Future<void> _persistForecast(Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCacheKey, jsonEncode(data));
      await prefs.setInt(
        _kCacheTsKey,
        _lastUpdated?.millisecondsSinceEpoch ?? 0,
      );
      await prefs.setString(_kNameKey, _locationName);
    } catch (_) {
      // Cache write failed — in-memory state bleibt gültig
    }
  }

  Future<void> _persistLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kLatKey, _lat.toString());
      await prefs.setString(_kLngKey, _lng.toString());
    } catch (_) {
      // ignore
    }
  }

  Future<void> _persistAlerts(WeatherAlertsResponse resp) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kAlertsKey, jsonEncode(resp.toJson()));
    } catch (_) {
      // Cache write failed — in-memory alerts bleiben gültig
    }
  }
}
