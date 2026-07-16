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

class Departure {
  final String stopName;
  final String routeShortName;
  final String routeLongName;
  final int routeType;
  final String routeColor;
  final String headsign;
  final String departureTime;

  Departure({
    required this.stopName,
    required this.routeShortName,
    required this.routeLongName,
    required this.routeType,
    required this.routeColor,
    required this.headsign,
    required this.departureTime,
  });

  factory Departure.fromJson(Map<String, dynamic> json) {
    return Departure(
      stopName: json['stop_name'] ?? '',
      routeShortName: json['route_short_name'] ?? '',
      routeLongName: json['route_long_name'] ?? '',
      routeType: json['route_type'] ?? 3,
      routeColor: json['route_color'] ?? '#6B7280',
      headsign: json['headsign'] ?? '',
      departureTime: json['departure_time'] ?? '',
    );
  }

  String get transportIcon => switch (routeType) {
        0 => '🚋',
        1 => '🚇',
        2 => '🚆',
        3 => '🚌',
        4 => '⛴',
        _ => '🚌',
      };
}

class JourneyLeg {
  final String type;
  final String from;
  final String to;
  final String? route;
  final String? routeColor;
  final int? routeType;
  final String? headsign;
  final String departure;
  final String arrival;
  final int durationMin;

  JourneyLeg({
    required this.type,
    required this.from,
    required this.to,
    this.route,
    this.routeColor,
    this.routeType,
    this.headsign,
    required this.departure,
    required this.arrival,
    required this.durationMin,
  });

  factory JourneyLeg.fromJson(Map<String, dynamic> json) {
    return JourneyLeg(
      type: json['type'] ?? 'walk',
      from: json['from'] ?? '',
      to: json['to'] ?? '',
      route: json['route'],
      routeColor: json['route_color'],
      routeType: json['route_type'],
      headsign: json['headsign'],
      departure: json['departure'] ?? '',
      arrival: json['arrival'] ?? '',
      durationMin: json['duration_min'] ?? 0,
    );
  }
}

class Journey {
  final List<JourneyLeg> legs;
  final int totalDurationMin;
  final int totalTransfers;
  final String departure;
  final String arrival;

  Journey({
    required this.legs,
    required this.totalDurationMin,
    required this.totalTransfers,
    required this.departure,
    required this.arrival,
  });

  factory Journey.fromJson(Map<String, dynamic> json) {
    return Journey(
      legs: (json['legs'] as List? ?? [])
          .map((l) => JourneyLeg.fromJson(l))
          .toList(),
      totalDurationMin: json['total_duration_min'] ?? 0,
      totalTransfers: json['total_transfers'] ?? 0,
      departure: json['departure'] ?? '',
      arrival: json['arrival'] ?? '',
    );
  }
}

class MobilityProvider extends ChangeNotifier {
  List<Stop> _nearbyStops = [];
  bool _isLoading = false;
  String? _error;
  List<List<LatLng>> _route = [];
  double _routeDistance = 0;
  double _routeDuration = 0;
  List<Departure> _departures = [];
  List<Journey> _journeys = [];

  List<Stop> get nearbyStops => _nearbyStops;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<List<LatLng>> get route => _route;
  double get routeDistance => _routeDistance;
  double get routeDuration => _routeDuration;
  List<Departure> get departures => _departures;
  List<Journey> get journeys => _journeys;

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

  Future<void> loadDepartures(String stopName, {int limit = 10}) async {
    _isLoading = true;
    _error = null;
    _departures = [];
    notifyListeners();
    try {
      final url =
          '${AppConfig.backendUrl}/api/mobility/departures?stop=${Uri.encodeComponent(stopName)}&limit=$limit';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 15));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _departures = (data['departures'] as List? ?? [])
            .map((d) => Departure.fromJson(d))
            .toList();
      }
    } catch (e) {
      _error = 'Abfahrten konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadJourney(
      double fromLat, double fromLng, double toLat, double toLng) async {
    _isLoading = true;
    _error = null;
    _journeys = [];
    notifyListeners();
    try {
      final url =
          '${AppConfig.backendUrl}/api/mobility/journey?from_lat=$fromLat&from_lng=$fromLng&to_lat=$toLat&to_lng=$toLng';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _journeys = (data['journeys'] as List? ?? [])
            .map((j) => Journey.fromJson(j))
            .toList();
      }
    } catch (e) {
      _error = 'Verbindungssuche fehlgeschlagen: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
