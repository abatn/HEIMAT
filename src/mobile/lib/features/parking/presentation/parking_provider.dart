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
/// **Architektur (Mirror zu EvChargingProvider / AirQualityProvider):**
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
  // Init
  // ------------------------------------------------------------------
  Future<void> init() async {
    try {
      final location = await LocationService.getCurrentLocation();
      _lat = location.latitude;
      _lng = location.longitude;
      _locationName = location.name;
      await refresh();
    } catch (e) {
      _error = StandortFehlerText;
      notifyListeners();
    }
  }

  // ------------------------------------------------------------------
  // Refresh
  // ------------------------------------------------------------------
  Future<void> refresh() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await ApiClient.get(
        '/api/parking/spots?lat=$_lat&lng=$_lng&radius_km=$_radiusKm',
      );
      final data = ParkingResponse.fromJson(response);
      _spots = data.spots;
      _lastUpdated = DateTime.now();
    } catch (e) {
      _error = 'Parkplätze konnten nicht geladen werden: $e';
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
    await refresh();
  }
}

const String StandortFehlerText =
    'Standort nicht verfügbar. Bitte Standortzugriff erlauben.';
