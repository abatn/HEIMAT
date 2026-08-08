import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/api/api_client.dart';
import '../../../core/services/location_service.dart';
import '../ev_charging_dto.dart';

/// EvChargingProvider — Backend-Anbindung für E-Ladestationen (Phase B-4).
///
/// **Datenquelle:** Backend /api/ev-charging/stations → OSM Overpass.
/// **Kein SharedPreferences-Cache:** Backend hat 24h-Cache (evChargingService).
/// **Location:** LocationService-getrieben (kein hardcoded Berlin-Default).
///
/// **Architektur (Mirror zu AirQualityProvider / WasteProvider):**
/// - init(): lädt Standort + Deferred-Fetch
/// - refresh(): live-Daten vom Backend
/// - Location: dynamisch via LocationService
class EvChargingProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  List<EvChargingStation> _stations = [];
  double _lat = 0;
  double _lng = 0;
  String _locationName = '';
  DateTime? _lastUpdated;

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<EvChargingStation> get stations => _stations;
  bool get hasData => _stations.isNotEmpty;
  double get lat => _lat;
  double get lng => _lng;
  String get locationName => _locationName;
  DateTime? get lastUpdated => _lastUpdated;

  // ------------------------------------------------------------------
  // init — Standort laden + ggf. deferred fetch
  // ------------------------------------------------------------------
  Future<void> init() async {
    notifyListeners();
    unawaited(_tryUpdateLocation());
  }

  Future<void> _tryUpdateLocation() async {
    try {
      final pos = await LocationService.getCurrentLocation().timeout(
        const Duration(seconds: 10),
        onTimeout: () => null,
      );
      if (pos != null) {
        _lat = pos.latitude;
        _lng = pos.longitude;
        notifyListeners();
        unawaited(refresh());
      }
    } catch (_) {
      // silently ignore — kein Standort verfügbar
    }
  }

  /// Manuelle Standort-Setzung (z.B. aus Karten-Tap)
  void setLocation(double lat, double lng, {String name = ''}) {
    _lat = lat;
    _lng = lng;
    _locationName = name;
    notifyListeners();
    unawaited(refresh());
  }

  // ------------------------------------------------------------------
  // refresh — Live-Fetch vom Backend
  // ------------------------------------------------------------------
  Future<void> refresh({double? radiusKm}) async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final qs = 'lat=$_lat&lng=$_lng&radius_km=${radiusKm ?? 5}';
      final data = await apiGet('/api/ev-charging/stations?$qs');

      if (data['status'] != 'ok') {
        throw Exception(
          data['message']?.toString() ?? 'Backend lieferte Fehler-Status',
        );
      }

      final response = EvChargingResponse.fromJson(data);
      _stations = response.stations;
      _lastUpdated = DateTime.now();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
