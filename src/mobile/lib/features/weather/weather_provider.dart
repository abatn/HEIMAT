import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import '../../core/services/location_service.dart';
import 'weather_dto.dart';

/// WeatherProvider — Backend-Anbindung für das Wetter-Mini-Program.
///
/// **Architektur (Phase E):**
/// - Online: ruft /api/weather/forecast?lat=&lng= (Backend hat 5-Min Cache + Retry)
/// - Cache-Tier 1 (Memory): ein _forecast-Feld für sofortiges Tab-Switching
/// - Cache-Tier 2 (SharedPreferences): JSON + Timestamp persistent
/// - Stale Graceful Degradation: zeigt letzte Daten + isStale=true statt Error-Screen
/// - Location: LocationService.getCurrentLocation() mit Fallback Berlin
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
  static const Duration _ttl = Duration(minutes: 5);

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  WeatherForecastResponse? _forecast;

  // Default: Berlin — wird in init() ggf. überschrieben
  double _lat = 52.52;
  double _lng = 13.41;
  String _locationName = 'Berlin';
  DateTime? _lastUpdated;
  bool _isStale = false;

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

  /// True wenn (cached ODER live) Daten verfügbar — Widget kann rendern
  bool get hasData => _forecast != null;

  // ------------------------------------------------------------------
  // init — Lade Cache + versuche Location (best-effort, 3s timeout)
  // ------------------------------------------------------------------
  Future<void> init() async {
    await _loadFromCache();
    notifyListeners();
    // Location update ist best-effort — Fehler ignorieren, Berlin bleibt Fallback
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
      // silently ignore — Berlin-Fallback bleibt aktiv
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

      // Cache persistieren
      await _persistForecast(data);
      await _persistLocation();
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
    } catch (_) {
      // Cache corrupted — silent fallback to in-memory-only mode
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
