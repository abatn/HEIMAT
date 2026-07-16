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
  List<Stop> _nearbyStops = [];
  bool _isLoading = false;
  String? _error;
  List<List<LatLng>> _route = [];
  double _routeDistance = 0;
  double _routeDuration = 0;

  List<Stop> get nearbyStops => _nearbyStops;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<List<LatLng>> get route => _route;
  double get routeDistance => _routeDistance;
  double get routeDuration => _routeDuration;

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
    _routeDistance = 0;
    _routeDuration = 0;
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
      if (routeData != null) {
        _routeDistance = _toDouble(routeData['distance']);
        _routeDuration = _toDouble(routeData['duration']);
        if (routeData['geometry'] != null) {
          final coords = routeData['geometry']['coordinates'] as List;
          _route = [
            coords.map((c) => LatLng(_toDouble(c[1]), _toDouble(c[0]))).toList()
          ];
        }
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
