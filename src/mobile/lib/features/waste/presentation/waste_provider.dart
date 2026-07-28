import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/api/api_client.dart';
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
  // init — Lade Cache + Auto-Refresh bei stale oder leer
  // ------------------------------------------------------------------
  Future<void> init() async {
    await _loadFromCache();
    notifyListeners();
    if (!hasData || _isStale) {
      unawaited(refresh());
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
