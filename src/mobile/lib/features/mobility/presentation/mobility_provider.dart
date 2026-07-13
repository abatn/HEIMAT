import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/config/app_config.dart';

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
        latitude: double.parse(json['latitude'].toString()),
        longitude: double.parse(json['longitude'].toString()),
        stopType: json['stop_type'] ?? '');
  }

  LatLng get location => LatLng(latitude, longitude);
}

class MobilityProvider extends ChangeNotifier {
  List<Stop> _nearbyStops = [];
  bool _isLoading = false;
  String? _error;

  List<Stop> get nearbyStops => _nearbyStops;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadNearbyStops(double lat, double lng,
      {double radius = 1000}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final url =
          '${AppConfig.backendUrl}/api/mobility/stops?lat=$lat&lng=$lng&radius=$radius';
      final response = await http
          .get(Uri.parse(url), headers: {'Content-Type': 'application/json'});
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
}
