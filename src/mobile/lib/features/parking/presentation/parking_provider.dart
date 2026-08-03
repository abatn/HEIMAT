import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/api/api_client.dart';
import '../../../core/services/location_service.dart';
import '../parking_dto.dart';

/// ParkingProvider — Backend-Anbindung für Parkplätze (Phase C-2).
///
/// **Datenquelle:** Backend /api/parking/spots → OSM Overpass.
/// **Kein SharedPreferences-Cache:** Backend hat 24h-Cache (parkingService).
/// **Location:** LocationService-getrieben (kein hardcoded Berlin-Default).
///
/// **Architektur (Mirror zu EvChargingProvider):**
/// - init(): lädt Standort + Deferred-Fetch
/// - refresh(): live-Daten vom Backend
/// - Location: dynamisch via LocationService
class ParkingProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  List<ParkingSpot> _spots = [];
  double _lat = 0;
  double _lng = 0;
  String _locationName = '';
  DateTime? _lastUpdated;
  double _radiusKm = 2;

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<ParkingSpot> get spots => _spots;
  bool get hasData => _spots.isNotEmpty;
  double get lat => _lat;
  double get lng => _lng;
  String get locationName => _locationName;
  DateTime? get lastUpdated => _lastUpdated;
  double get radiusKm => _radiusKm;

  // ------------------------------------------------------------------
  // Init — Standort laden + ggf. deferred fetch
  // ------------------------------------------------------------------
  Future<void> init() async {
    notifyListeners();
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
      final rkm = radiusKm ?? _radiusKm;
      final qs = 'lat=$_lat&lng=$_lng&radius_km=$rkm';
      final data = await apiGet('/api/parking/spots?$qs');

      if (data['status'] != 'ok') {
        throw Exception(
          data['message']?.toString() ?? 'Backend lieferte Fehler-Status',
        );
      }

      final response = ParkingResponse.fromJson(data);
      _spots = response.spots;
      _lastUpdated = DateTime.now();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ------------------------------------------------------------------
  // Radius ändern
  // ------------------------------------------------------------------
  Future<void> setRadius(double km) async {
    _radiusKm = km;
    await refresh(radiusKm: km);
  }
}

const String StandortFehlerText =
    'Standort nicht verfügbar. Bitte Standortzugriff erlauben.';
