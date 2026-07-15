import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/config/app_config.dart';

double _toDouble(dynamic v) =>
    v == null ? 0.0 : (v is num ? v.toDouble() : double.parse(v.toString()));

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
        latitude: _toDouble(json['latitude']),
        longitude: _toDouble(json['longitude']),
        stopType: json['stop_type'] ?? '');
  }

  LatLng get location => LatLng(latitude, longitude);
}

class RoutePoint {
  final double lat;
  final double lng;

  RoutePoint({required this.lat, required this.lng});
}

class MobilityProvider extends ChangeNotifier {
  static const Map<String, LatLng> cityCoords = {
    'berlin': LatLng(52.5200, 13.4050),
    'stuttgart': LatLng(48.7758, 9.1829),
    'münchen': LatLng(48.1351, 11.5820),
    'hamburg': LatLng(53.5511, 9.9937),
    'köln': LatLng(50.9375, 6.9603),
    'frankfurt': LatLng(50.1109, 8.6821),
    'düsseldorf': LatLng(51.2277, 6.7735),
    'dortmund': LatLng(51.5136, 7.4653),
    'essen': LatLng(51.4556, 7.0116),
    'leipzig': LatLng(51.3397, 12.3731),
    'hannover': LatLng(52.3759, 9.7320),
    'dresden': LatLng(51.0504, 13.7373),
    'nürnberg': LatLng(49.4521, 11.0767),
    'freiburg': LatLng(47.999, 7.8421),
    'rostock': LatLng(54.0924, 12.0991),
  };

  List<Stop> _nearbyStops = [];
  bool _isLoading = false;
  String? _error;
  List<List<LatLng>> _route = [];

  List<Stop> get nearbyStops => _nearbyStops;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<List<LatLng>> get route => _route;

  Future<void> loadNearbyStops(double lat, double lng,
      {double radius = 5000}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final url =
          '${AppConfig.backendUrl}/api/mobility/stops?lat=$lat&lng=$lng&radius=$radius';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.statusCode}');
      }
      final data = json.decode(response.body);
      _nearbyStops =
          (data['stops'] as List).map((s) => Stop.fromJson(s)).toList();
    } catch (e) {
      _error = 'Haltestellen konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadRoute(
      double fromLat, double fromLng, double toLat, double toLng) async {
    _isLoading = true;
    _error = null;
    _route = [];
    notifyListeners();
    try {
      final url =
          '${AppConfig.backendUrl}/api/mobility/route?from_lat=$fromLat&from_lng=$fromLng&to_lat=$toLat&to_lng=$toLng';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.statusCode}');
      }
      final data = json.decode(response.body);
      final routeData = data['route'];
      if (routeData != null && routeData['geometry'] != null) {
        final coords = routeData['geometry'] as List;
        _route = [
          coords.map((c) => LatLng(_toDouble(c[1]), _toDouble(c[0]))).toList()
        ];
      }
    } catch (e) {
      _error = 'Route konnte nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<Map<String, dynamic>>> geocode(String address) async {
    try {
      final url =
          '${AppConfig.backendUrl}/api/mobility/geocode?address=${Uri.encodeComponent(address)}';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return List<Map<String, dynamic>>.from(data['results'] ?? []);
      }
    } catch (_) {}
    return [];
  }
}
