import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/api/api_client.dart';
import '../../../core/services/location_service.dart';
import '../waste_dto.dart';

/// WasteProvider — Backend-Anbindung für Abfallkalender (Phase B-3).
///
/// **Architektur (Mirror zu AirQualityProvider + Weather-TTL-Pattern):**
/// - Online: ruft /api/waste/calendar?lat=&lng=&weeks=&street=&houseNr=
/// - Cache-Tier 1 (Memory): _calendar für sofortiges Tab-Switching
/// - Cache-Tier 2 (SharedPreferences): JSON + Timestamp persistent
/// - Location-Tier: Berlin 52.52/13.41 als Default (kein Live-Geo until Phase 3+)
/// - 422 AddressRequiredError: Wenn Backend Hamburg/München ohne Adresse meldet,
///   Provider setzt addressRequired=true und Screen zeigt Bottom-Sheet Dialog.
///
/// **Phase B-3 24h-TTL:** Mirror zur Backend `cacheTtlMs = 24 * 60 * 60 * 1000`.
/// Mobile-Tier-2 hält die Rohdaten (street/houseNr) — NFC-Normalisierung läuft
/// im Backend Cache-Key (Server of Truth). Mobile-Cache-Key ist unique genug
/// über city+street+houseNr+weeks, kein Doppel-Decode noetig.
///
/// **Cache-Keys (6):** `_kCacheKey` (full response JSON), `_kCacheTsKey`
/// (last-updated epoch ms für TTL), `_kCityKey`, `_kStreetKey`,
/// `_kHouseNrKey`, `_kWeeksKey`.
class WasteProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // Cache-Keys + TTL
  // ------------------------------------------------------------------
  static const String _kCacheKey = 'waste_data_v1';
  static const String _kCacheTsKey = 'waste_ts_v1';
  static const String _kCityKey = 'waste_city_v1';
  static const String _kStreetKey = 'waste_street_v1';
  static const String _kHouseNrKey = 'waste_houseNr_v1';
  static const String _kWeeksKey = 'waste_weeks_v1';
  static const Duration _ttl = Duration(hours: 24);

  // ------------------------------------------------------------------
  // Phase B-3.1: Bbox-basierter City-Picker (Auto-City-Detection)
  // ------------------------------------------------------------------
  // 3 Staedte via Bounding-Box. Half-open intervalle [latMin, latMax) x
  // [lngMin, lngMax). Bei bbox-miss Fallback auf Berlin (kein address_required).
  // Werte spiegeln grob die Stadtgrenzen + Metro-Region. Siehe AGENTS.md
  // 'AI-Architektur' Phase C-D als long-term Roadmap (intelligenter AutoPicker).
  static const double _berlinLatMin = 52.34;
  static const double _berlinLatMax = 52.68;
  static const double _berlinLngMin = 13.10;
  static const double _berlinLngMax = 13.77;

  static const double _hamburgLatMin = 53.39;
  static const double _hamburgLatMax = 53.74;
  static const double _hamburgLngMin = 9.73;
  static const double _hamburgLngMax = 10.32;

  static const double _muenchenLatMin = 48.06;
  static const double _muenchenLatMax = 48.25;
  static const double _muenchenLngMin = 11.36;
  static const double _muenchenLngMax = 11.73;

  /// Phase B-3.1 statischer Helper: bbox → city-key.
  /// Public für Testbarkeit und etwaige zukünftige UI-Hints.
  /// Half-open semantics: lat in [min, max), lng in [min, max).
  /// Bbox-miss → 'berlin' (default Fallback, address_required=false).
  static String pickCityFromBbox(double lat, double lng) {
    if (lat >= _berlinLatMin &&
        lat < _berlinLatMax &&
        lng >= _berlinLngMin &&
        lng < _berlinLngMax) {
      return 'berlin';
    }
    if (lat >= _hamburgLatMin &&
        lat < _hamburgLatMax &&
        lng >= _hamburgLngMin &&
        lng < _hamburgLngMax) {
      return 'hamburg';
    }
    if (lat >= _muenchenLatMin &&
        lat < _muenchenLatMax &&
        lng >= _muenchenLngMin &&
        lng < _muenchenLngMax) {
      return 'muenchen';
    }
    return 'berlin'; // Fallback
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  bool _addressRequired = false;
  WasteCalendarResponse? _calendar;

  // Defaults: Berlin (52.52/13.41). Phase 3+ kann via LocationService
  // aktualisiert werden (analog zu AirQualityProvider).
  double _lat = 52.52;
  double _lng = 13.41;
  String _city = 'berlin';
  String _street = '';
  String _houseNr = '';
  int _weeks = 4;
  String _errorCode = '';
  DateTime? _lastUpdated;
  bool _isStale = false;

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get errorCode => _errorCode;
  bool get addressRequired => _addressRequired;
  WasteCalendarResponse? get calendar => _calendar;
  bool get hasData => _calendar != null;
  bool get isStale => _isStale;
  DateTime? get lastUpdated => _lastUpdated;
  String get city => _city;
  String get street => _street;
  String get houseNr => _houseNr;
  int get weeks => _weeks;

  // ------------------------------------------------------------------
  // init — Lade Cache + Auto-Refresh bei stale oder leer + LocationService
  // ------------------------------------------------------------------
  Future<void> init() async {
    await _loadFromCache();
    notifyListeners();
    if (!hasData || _isStale) {
      unawaited(refresh());
    }
    // Phase B-3.1: LocationService-Integration nach initial-cache-load.
    // best-effort: 3s timeout, fail-silent to Berlin default.
    // Reihenfolge nach initial-refresh: erst City aus Location picken (ggf.
    // weckt refresh erneut auf wenn sich die city geaendert hat).
    unawaited(_tryUpdateLocation());
  }

  /// Phase B-3.1: LocationService-Integration (mirror zu AirQualityProvider).
  /// Best-effort: 3s timeout, on failure bleibt Berlin-default.
  /// Erkennt Hamburg/München via bbox → refreshes triggern dann
  /// 422 AddressRequiredError → Bottom-Sheet-Dialog im Screen.
  Future<void> _tryUpdateLocation() async {
    try {
      final pos = await LocationService.getCurrentLocation().timeout(
        const Duration(seconds: 3),
        onTimeout: () => null,
      );
      if (pos != null) {
        _lat = pos.latitude;
        _lng = pos.longitude;
        // Phase B-3.1: bbox-basierter Auto-City-Picker
        _city = WasteProvider.pickCityFromBbox(_lat, _lng);
        unawaited(_persistAddress());
        notifyListeners();
        unawaited(refresh());
      }
    } catch (_) {
      // silently ignore — Berlin-Fallback bleibt aktiv
    }
  }

  /// Setter: User gibt seine Adresse ein → re-trigger refresh.
  /// Wird vom Bottom-Sheet Dialog in waste_screen.dart aufgerufen wenn
  /// Backend 422 AddressRequiredError zurückgibt (Hamburg/München).
  void updateAddress({
    required String city,
    required String street,
    required String houseNr,
  }) {
    _city = city;
    _street = street;
    _houseNr = houseNr;
    _addressRequired = false;
    _error = null;
    unawaited(_persistAddress());
    unawaited(refresh());
  }

  /// Setter: User wählt Wochen-Anzahl (1..8). Persistiert + re-fetch.
  void setWeeks(int weeks) {
    if (weeks < 1 || weeks > 8) return;
    if (_weeks == weeks) return;
    _weeks = weeks;
    unawaited(_persistAddress());
    unawaited(refresh());
  }

  // ------------------------------------------------------------------
  // refresh — Live-Fetch vom Backend (Phase B-2 /api/waste/calendar)
  // ------------------------------------------------------------------
  Future<void> refresh() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    _errorCode = '';
    _addressRequired = false;
    notifyListeners();

    try {
      final qs =
          'lat=$_lat&lng=$_lng&weeks=$_weeks&street=${Uri.encodeComponent(_street)}&houseNr=${Uri.encodeComponent(_houseNr)}';
      final data = await apiGet('/api/waste/calendar?$qs');

      // 422 AddressRequiredError: code='ADDRESS_REQUIRED' (Backend-Format)
      if (data['status'] == 'error' && data['code'] == 'ADDRESS_REQUIRED') {
        _addressRequired = true;
        _error = data['message']?.toString() ??
            'Adresse wird benötigt (Straße + Hausnummer)';
        _errorCode = 'ADDRESS_REQUIRED';
        return;
      }

      if (data['status'] != 'ok') {
        throw Exception(
          data['message']?.toString() ?? 'Backend lieferte Fehler-Status',
        );
      }

      _calendar = WasteCalendarResponse.fromJson(data);
      _city = _calendar!.city.isNotEmpty ? _calendar!.city : _city;
      _lastUpdated = DateTime.now();
      _isStale = false;
      await _persistCalendar(data);
    } catch (e) {
      _error = e.toString();
      _isStale = _calendar != null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ------------------------------------------------------------------
  // Cache: Prefs Tier 2 (persistent bis 24h TTL)
  // ------------------------------------------------------------------
  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCacheKey);
      if (raw == null) return;

      _calendar =
          WasteCalendarResponse.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      _city = prefs.getString(_kCityKey) ?? _city;
      _street = prefs.getString(_kStreetKey) ?? _street;
      _houseNr = prefs.getString(_kHouseNrKey) ?? _houseNr;
      _weeks = prefs.getInt(_kWeeksKey) ?? _weeks;

      final tsMs = prefs.getInt(_kCacheTsKey);
      if (tsMs != null) {
        _lastUpdated = DateTime.fromMillisecondsSinceEpoch(tsMs);
        _isStale = DateTime.now().difference(_lastUpdated!) > _ttl;
      }
    } catch (_) {
      // Cache corrupted: silent fallback
      _calendar = null;
    }
  }

  Future<void> _persistCalendar(Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCacheKey, jsonEncode(data));
      await prefs.setInt(
          _kCacheTsKey, _lastUpdated?.millisecondsSinceEpoch ?? 0);
      await _persistAddress();
    } catch (_) {
      // Cache write failed: in-memory state gilt weiter
    }
  }

  Future<void> _persistAddress() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCityKey, _city);
      await prefs.setString(_kStreetKey, _street);
      await prefs.setString(_kHouseNrKey, _houseNr);
      await prefs.setInt(_kWeeksKey, _weeks);
    } catch (_) {
      // ignore
    }
  }
}
