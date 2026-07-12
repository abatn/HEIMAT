import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/api/api_client.dart';

class Stop {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String stopType;

  Stop(
      {required this.id,
      required this.name,
      required this.latitude,
      required this.longitude,
      required this.stopType});

  factory Stop.fromJson(Map<String, dynamic> json) {
    return Stop(
        id: json['id'] ?? '',
        name: json['name'] ?? '',
        latitude: (json['latitude'] ?? 0).toDouble(),
        longitude: (json['longitude'] ?? 0).toDouble(),
        stopType: json['stop_type'] ?? '');
  }

  LatLng get location => LatLng(latitude, longitude);
}

class GeocodeResult {
  final double lat;
  final double lng;
  final String displayName;

  GeocodeResult(
      {required this.lat, required this.lng, required this.displayName});

  factory GeocodeResult.fromJson(Map<String, dynamic> json) {
    return GeocodeResult(
        lat: (json['lat'] ?? 0).toDouble(),
        lng: (json['lng'] ?? 0).toDouble(),
        displayName: json['display_name'] ?? '');
  }
}

class RouteResult {
  final double distance;
  final double duration;

  RouteResult({required this.distance, required this.duration});

  factory RouteResult.fromJson(Map<String, dynamic> json) {
    return RouteResult(
        distance: (json['distance'] ?? 0).toDouble(),
        duration: (json['duration'] ?? 0).toDouble());
  }
}

class MobilityProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  List<Stop> _nearbyStops = [];
  List<GeocodeResult> _geocodeResults = [];
  RouteResult? _currentRoute;
  bool _isLoading = false;
  String? _error;

  List<Stop> get nearbyStops => _nearbyStops;
  List<GeocodeResult> get geocodeResults => _geocodeResults;
  RouteResult? get currentRoute => _currentRoute;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadNearbyStops(double lat, double lng,
      {double radius = 1000}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api
          .get('/api/mobility/stops?lat=$lat&lng=$lng&radius=$radius');
      _nearbyStops =
          (response['stops'] as List).map((s) => Stop.fromJson(s)).toList();
    } catch (e) {
      _error = 'Haltestellen konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> geocodeAddress(String address) async {
    if (address.isEmpty) {
      _geocodeResults = [];
      notifyListeners();
      return;
    }
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api
          .get('/api/mobility/geocode?address=${Uri.encodeComponent(address)}');
      _geocodeResults = (response['results'] as List)
          .map((r) => GeocodeResult.fromJson(r))
          .toList();
    } catch (e) {
      _error = 'Geocoding fehlgeschlagen: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> getRoute(LatLng from, LatLng to) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get(
          '/api/mobility/route?from_lat=${from.latitude}&from_lng=${from.longitude}&to_lat=${to.latitude}&to_lng=${to.longitude}');
      _currentRoute = RouteResult.fromJson(response['route']);
    } catch (e) {
      _error = 'Route konnte nicht berechnet werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
