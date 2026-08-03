import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import '../../core/services/location_service.dart';
import 'air_quality_dto.dart';

/// AirQualityProvider — Backend-Anbindung für Luftqualität.
///
/// **Architektur (wie WeatherProvider):**
/// - Online: ruft /api/air-quality/forecast?lat=&lng= (Backend hat 5-Min Cache + Retry)
/// - Cache-Tier 1 (Memory): _forecast für sofortiges Tab-Switching
/// - Cache-Tier 2 (SharedPreferences): JSON + Timestamp persistent
/// - Location: LocationService.getCurrentLocation() mit Fallback Berlin
class AirQualityProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // Cache-Keys + TTL
  // ------------------------------------------------------------------
  static const String _kCacheKey = 'air_quality_last_forecast_v1';
  static const String _kCacheTsKey = 'air_quality_last_forecast_ts_v1';
  static const String _kLatKey = 'air_quality_last_lat_v1';
  static const String _kLngKey = 'air_quality_last_lng_v1';
  static const String _kNameKey = 'air_quality_last_name_v1';
  static const Duration _ttl = Duration(minutes: 5);

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  AirQualityForecastResponse? _forecast;

  // Kein hardcoded Default — "nicht bestimmt" bis LocationService liefert
  double _lat = 0;
  double _lng = 0;
  String _locationName = '';
  DateTime? _lastUpdated;
  bool _isStale = false;

  // ------------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------------
  AirQualityProvider();

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  AirQualityForecastResponse? get forecast => _forecast;
  DateTime? get lastUpdated => _lastUpdated;
  bool get isStale => _isStale;
  String get locationName => _locationName;
  double get lat => _lat;
  double get lng => _lng;
  bool get hasData => _forecast != null;

  // ------------------------------------------------------------------
  // init — Lade Cache + versuche Location (best-effort)
  // ------------------------------------------------------------------
  Future<void> init() async {
    await _loadFromCache();
    notifyListeners();
    // Auto-refresh wenn Cache älter als TTL
    if (hasData && _isStale) {
      unawaited(refresh());
    }
    // Location-Update best-effort
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
        await refresh();
      }
    } catch (_) {
      // silently ignore — kein Fallback (Location nicht verfügbar → kein API-Call)
    }
  }

  // ------------------------------------------------------------------
  // refresh — Live-Fetch vom Backend
  // ------------------------------------------------------------------
  Future<void> refresh() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      if (_lat == 0 && _lng == 0) {
        _error = 'Standort konnte nicht ermittelt werden';
        return;
      }
      final data =
          await apiGet('/api/air-quality/current?lat=$_lat&lng=$_lng');
      if (data['status'] != 'ok') {
        throw Exception(
          data['message']?.toString() ?? 'Backend lieferte Fehler-Status',
        );
      }
      _forecast = AirQualityForecastResponse.fromJson(data);
      _locationName =
          (data['location'] as Map<String, dynamic>?)?['name']?.toString() ??
              _locationName;
      _lastUpdated = DateTime.now();
      _isStale = false;

      // Cache persistieren
      await _persistForecast(data);
      await _persistLocation();
    } catch (e) {
      _error = e.toString();
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
      _forecast = AirQualityForecastResponse.fromJson(data);
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
    } catch (_) {
      // Cache corrupted — silent fallback
      _forecast = null;
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
}
