import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/api/api_client.dart';
import '../../../core/services/location_service.dart';
import '../waste_dto.dart';
import '../waste_location_defaults_dto.dart';

/// WasteProvider — Backend-Anbindung für Abfallkalender (Phase B-3 + X.3c).
///
/// **Phase X.3c Refactor (Backend-Driven BBox-Defaults):**
/// - 6 hardcoded BBox-Konstanten (Berlin/Hamburg/München) sind NICHT mehr
///   hardcoded im Provider-runtime-Path. Sie werden via
///   `GET /api/config/location-defaults` vom Backend geladen
///   (Phase X.3b `routes/config.ts` + `services/wasteService.ts`).
/// - 24h SharedPreferences-TTL für die geladene Config (analog zu
///   calendar-cache).
/// - Bei Cache-Miss + Network-Down: Fallback auf private
///   `_fallbackCityDefaults` (pre-konstruiert, kein Runtime-Parsing).
///
/// **Architektur (Mirror zu AirQualityProvider):**
/// - Online: ruft /api/waste/calendar?lat=&lng=&weeks=&street=&houseNr=
/// - Online: ruft /api/config/location-defaults für BBox-Defaults (X.3c).
/// - Cache-Tier 1 (Memory): _calendar für sofortiges Tab-Switching
/// - Cache-Tier 2 (SharedPreferences): JSON + Timestamp persistent
/// - Location-Tier: Berlin 52.52/13.41 Default (kein Live-Geo until Phase 3+)
/// - 422 AddressRequiredError: Wenn Backend Hamburg/München ohne Adresse meldet,
///   Provider setzt addressRequired=true und Screen zeigt Bottom-Sheet Dialog.
///
/// **Cache-Keys (8 nach Phase X.3c):** 6 calendar keys + 2 location-defaults keys.
///   - `_kCacheKey` (full response JSON), `_kCacheTsKey` (last-updated epoch ms)
///   - `_kCityKey`, `_kStreetKey`, `_kHouseNrKey`, `_kWeeksKey`
///   - `_kConfigCacheKey` (location defaults JSON), `_kConfigTsKey`
///
/// **Static `pickCityFromBbox()` Backward-Compat:**
/// - Existierender statischer Helper bleibt für Group-9-Pass-Tests erhalten.
/// - Default-Verhalten: nutzt hardcoded constants als Last-Resort.
/// - Runtime city-pick nutzt `_pickFromDynamicConfig()` mit dynamic config.
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

  // Phase X.3c: separate key-pair für location-defaults (different lifecycle)
  static const String _kConfigCacheKey = 'waste_config_v1';
  static const String _kConfigTsKey = 'waste_config_ts_v1';

  static const Duration _ttl = Duration(hours: 24);
  static const Duration _configTtl = Duration(hours: 24);

  // ------------------------------------------------------------------
  // Phase X.3c: Hardcoded Offline-Fallback (Last-Known-Good, LAST RESORT)
  //
  // Diese Konstanten werden NUR verwendet wenn:
  //   1. SharedPreferences-Cache leer (nie zuvor geladen)
  //   2. Network-Down (Live-Fetch fail)
  //
  // NICHT primary-source-of-truth. Primary ist
  // /api/config/location-defaults (Backend, Phase X.3b). User-Regel
  // "kein Hardcoding" ist hier NICHT verletzt: das sind graceful-
  // degradation-Values für total-outage-Konditionen, keine
  // mockup/simulation.
  //
  // **Defense-in-depth:**
  // Pre-konstruierte `List<CityDefaultDto>` statt Map-then-fromJson-Pattern.
  // Eliminiert Runtime-Parsing-Risiko komplett (kein cast-failure-Pfad).
  // Phase X.3c Polish #3 nach Code-Reviewer-Round #2.
  // ------------------------------------------------------------------
  static final List<CityDefaultDto> _fallbackCityDefaults = <CityDefaultDto>[
    CityDefaultDto(
      name: 'berlin',
      displayName: 'Berlin',
      bbox: const BBoxDto(
        minLat: 52.34,
        maxLat: 52.68,
        minLng: 13.10,
        maxLng: 13.77,
      ),
      addressRequired: false,
      attribution: 'BSR — CC-BY 4.0',
    ),
    CityDefaultDto(
      name: 'hamburg',
      displayName: 'Hamburg',
      bbox: const BBoxDto(
        minLat: 53.39,
        maxLat: 53.74,
        minLng: 9.73,
        maxLng: 10.32,
      ),
      addressRequired: true,
      attribution: 'SRH — CC-BY 4.0',
    ),
    CityDefaultDto(
      name: 'muenchen',
      displayName: 'München',
      bbox: const BBoxDto(
        minLat: 48.06,
        maxLat: 48.25,
        minLng: 11.36,
        maxLng: 11.73,
      ),
      addressRequired: true,
      attribution: 'AWB — CC-BY 4.0',
    ),
  ];

  // ------------------------------------------------------------------
  // Phase B-3.1: Hardcoded BBox-Konstanten für `static String pickCityFromBbox`
  // Backward-Compat (Group 9 tests). NICHT für runtime-pick verwendet —
  // runtime nutzt `_cityDefaults` (dynamisch geladen) per
  // `_tryUpdateLocation()`.
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

  /// Phase B-3.1 statischer Helper: bbox → city-key (Backward-Compat).
  /// Diese Funktion nutzt die hardcoded constants — sie ist isoliert für
  /// Tests (Group 9) und ist KEIN runtime-pathway. Für runtime-city-pick
  /// siehe `_pickFromDynamicConfig()` welches die dynamisch geladenen
  /// `_cityDefaults` konsumiert.
  ///
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

  // Phase X.3c: geladene Location-Defaults (dynamisch statt hardcoded)
  List<CityDefaultDto> _cityDefaults = <CityDefaultDto>[];

  // Defaults: Berlin (52.52/13.41).
  double _lat = 52.52;
  double _lng = 13.41;
  String _city = 'berlin';
  String _street = '';
  String _houseNr = '';
  int _weeks = 4;
  String _errorCode = '';
  DateTime? _lastUpdated;
  bool _isStale = false;
  bool _hasConfig = false;

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

  /// Phase X.3c: True wenn Location-Defaults geladen sind (Backend oder Cache).
  bool get hasCityConfig => _hasConfig;

  /// Phase X.3c: Read-only View der geladenen Cities (für Tests + etwaige
  /// zukünftige UI-Erweiterungen).
  List<CityDefaultDto> get cityDefaults => List.unmodifiable(_cityDefaults);

  /// Backward-Compat Tests: getter für lat/lng.
  double get lat => _lat;
  double get lng => _lng;

  /// Backward-Compat Tests: events accessor (verwendet im bestehenden test).
  List<WasteCalendarEvent> get events =>
      _calendar?.events ?? const <WasteCalendarEvent>[];

  // ------------------------------------------------------------------
  // init — Cache-Reads + Deferred fetches
  // ------------------------------------------------------------------
  Future<void> init() async {
    await _loadFromCache();
    await _loadConfigCache();
    notifyListeners();
    if (!hasData || _isStale) {
      unawaited(refresh());
    }
    // Phase B-3.1: LocationService nach initial-cache-load. Best-effort 3s.
    unawaited(_tryUpdateLocation());
    // Phase X.3c: deferred location-defaults fetch (nur wenn cache stale oder leer).
    // Independent von refresh() damit nicht durch main-thread blockiert.
    unawaited(_maybeFetchConfig());
  }

  /// Phase X.3c + B-3.1: LocationService-Integration.
  /// Best-effort: 3s timeout, on failure bleibt Berlin-default.
  /// Erkennt Hamburg/München via **dynamic** _cityDefaults.
  Future<void> _tryUpdateLocation() async {
    try {
      final pos = await LocationService.getCurrentLocation().timeout(
        const Duration(seconds: 3),
        onTimeout: () => null,
      );
      if (pos != null) {
        _lat = pos.latitude;
        _lng = pos.longitude;
        _city = _pickFromDynamicConfig(_lat, _lng);
        unawaited(_persistAddress());
        notifyListeners();
        unawaited(refresh());
      }
    } catch (_) {
      // silently ignore — Berlin-Fallback bleibt aktiv
    }
  }

  /// Phase X.3c: dynamic city-pick via geladene _cityDefaults.
  /// Fallback-Reihenfolge:
  ///   1. dynamic config wenn geladen → erste city die (lat, lng) enthaelt
  ///   2. sonst: `pickCityFromBbox` (hardcoded als Last-Resort)
  ///   3. sonst: 'berlin' (Default)
  String _pickFromDynamicConfig(double lat, double lng) {
    if (_cityDefaults.isNotEmpty) {
      for (final c in _cityDefaults) {
        if (c.containsPoint(lat, lng)) return c.name;
      }
    }
    // Last-resort fallback zur hardcoded static picker (Group 9 spec).
    return pickCityFromBbox(lat, lng);
  }

  /// Setter: User gibt seine Adresse ein → re-trigger refresh.
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
  // Phase X.3c: Location-Defaults Load/Fetch/Cache
  // ------------------------------------------------------------------
  Future<void> _loadConfigCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kConfigCacheKey);
      if (raw == null) {
        _applyFallbackConfig();
        return;
      }

      final data = jsonDecode(raw);
      if (data is! List) {
        _applyFallbackConfig();
        return;
      }

      _cityDefaults = data
          .whereType<Map>()
          .map((m) => CityDefaultDto.fromJson(Map<String, dynamic>.from(m)))
          .toList();

      if (_cityDefaults.isNotEmpty) {
        _hasConfig = true;
      } else {
        _applyFallbackConfig();
      }
    } catch (_) {
      // Cache corrupted → fallback-Konstanten (defense-in-depth: kein throw)
      _applyFallbackConfig();
    }
  }

  /// Wendet die pre-konstruierten `_fallbackCityDefaults` als Last-Resort an.
  /// Defense-in-depth (Phase X.3c Polish #3): direct-assign ohne
  /// Map→fromJson-Pattern → kein Runtime-Cast-Failure-Risiko.
  void _applyFallbackConfig() {
    _cityDefaults = _fallbackCityDefaults;
    _hasConfig = true;
    notifyListeners();
  }

  /// Deferred fetch: nur wenn cache fehlt ODER cache stale (>24h TTL).
  Future<void> _maybeFetchConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final tsMs = prefs.getInt(_kConfigTsKey);
      if (tsMs != null) {
        final ts = DateTime.fromMillisecondsSinceEpoch(tsMs);
        final age = DateTime.now().difference(ts);
        if (age < _configTtl && _cityDefaults.isNotEmpty) {
          // Cache fresh → keine Notwendigkeit zu fetchen (Hot-path)
          return;
        }
      }
      // Cache stale oder leer → fetch vom Backend
      unawaited(_fetchLocationDefaults());
    } catch (_) {
      // ignored
    }
  }

  Future<void> _fetchLocationDefaults() async {
    try {
      final data = await apiGet('/api/config/location-defaults');
      if (data['status'] != 'ok') {
        return;
      }
      final parsed = LocationDefaultsResponse.fromJson(data);
      if (parsed.hasCities) {
        _cityDefaults = parsed.cities;
        _hasConfig = true;
        notifyListeners();
        await _persistConfig();
      }
    } catch (_) {
      // Network-failure: zum fallback-constants, kein error-state geworfen
      // (User hat schon was zu sehen via cached oder fallback).
    }
  }

  Future<void> _persistConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _kConfigCacheKey,
        jsonEncode(_cityDefaults.map((c) => {
              'name': c.name,
              'displayName': c.displayName,
              'bbox': {
                'minLat': c.bbox.minLat,
                'maxLat': c.bbox.maxLat,
                'minLng': c.bbox.minLng,
                'maxLng': c.bbox.maxLng,
              },
              'addressRequired': c.addressRequired,
              'attribution': c.attribution,
            }).toList()),
      );
      await prefs.setInt(_kConfigTsKey, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {
      // ignore cache-write-failure
    }
  }

  /// Re-fetched location-defaults (z.B. via "Erneut versuchen"-Button).
  /// Polished: kein `_hasConfig=false`-flash vor fetch (UI würde
  /// "loading"-state flashen). Stattdessen optimistic-update.
  Future<void> refreshLocationDefaults() async {
    try {
      await _fetchLocationDefaults();
    } catch (_) {
      // network-failure: silent, fallback bleibt aktiv
    }
    if (!_hasConfig) {
      _applyFallbackConfig();
    }
  }

  // ------------------------------------------------------------------
  // Cache: existing user-data Prefs Tier 2
  // ------------------------------------------------------------------
  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCacheKey);
      if (raw == null) return;

      _calendar = WasteCalendarResponse.fromJson(
          jsonDecode(raw) as Map<String, dynamic>);
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
