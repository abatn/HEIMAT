import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../home/presentation/home_provider.dart';

class Doctor {
  final String id;
  final String name;
  final String specialty;
  final String address;
  final String phone;
  final String source; // 'db' | 'osm'
  final double? distanceKm; // Entfernung vom User-Standort
  final double? latitude;
  final double? longitude;

  Doctor({
    required this.id,
    required this.name,
    required this.specialty,
    required this.address,
    required this.phone,
    this.source = 'db',
    this.distanceKm,
    this.latitude,
    this.longitude,
  });

  factory Doctor.fromJson(Map<String, dynamic> json) {
    return Doctor(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      specialty: json['specialty'] ?? '',
      address: json['address'] ?? '',
      phone: json['phone'] ?? '',
      source: json['source'] ?? 'db',
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  /// Formatierte Entfernung (z.B. '1.2 km' oder '800 m')
  String get distanceFormatted {
    if (distanceKm == null) return '';
    if (distanceKm! < 1) return '${(distanceKm! * 1000).round()} m';
    return '${distanceKm!.toStringAsFixed(1)} km';
  }
}

class TimeSlot {
  final String startTime;
  final String endTime;
  final bool isAvailable;

  TimeSlot({
    required this.startTime,
    required this.endTime,
    required this.isAvailable,
  });

  factory TimeSlot.fromJson(dynamic json) {
    if (json is String) {
      return TimeSlot(startTime: json, endTime: '', isAvailable: true);
    }
    return TimeSlot(
      startTime: json['start_time'] ?? json['startTime'] ?? '',
      endTime: json['end_time'] ?? json['endTime'] ?? '',
      isAvailable: json['is_available'] ?? json['isAvailable'] ?? true,
    );
  }
}

class HealthProvider extends ChangeNotifier {
  List<Doctor> _allDoctors = []; // Alle geladenen Ärzte (ungefiltert)
  List<Doctor> _doctors = []; // Aktuell angezeigte Ärzte (gefiltert)
  bool _isLoading = false;
  String? _error;
  List<TimeSlot> _slots = [];
  String? _selectedDoctorId;
  String? _selectedSpecialty; // Aktuell ausgewählte Specialty
  // Gespeicherte GPS-Koordinaten — werden beim ersten Standort-Laden gesetzt
  // und für alle weiteren Filter/Refresh-Aufrufe als Fallback genutzt.
  // So laden Filter-Chips und Pull-to-Refresh immer via Overpass (nicht DB-only).
  double? _lastLat;
  double? _lastLng;

  List<Doctor> get doctors => _doctors;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<TimeSlot> get slots => _slots;
  String? get selectedDoctorId => _selectedDoctorId;
  double? get lastLat => _lastLat;
  double? get lastLng => _lastLng;

  /// Specialty-Filter client-side anwenden (instant, kein HTTP-Call).
  /// Die vollständige Ärzteliste wird bei searchDoctors() geladen,
  /// danach filtert filterBySpecialty() lokal nach Fachrichtung.
  void filterBySpecialty(String? specialty) {
    _selectedSpecialty = specialty;
    if (specialty == null || specialty.isEmpty) {
      _doctors = List.from(_allDoctors);
    } else {
      final lower = specialty.toLowerCase();
      _doctors = _allDoctors
          .where((d) => d.specialty.toLowerCase().contains(lower))
          .toList();
    }
    _error = null;
    notifyListeners();
  }

  Future<void> searchDoctors(
      {String? specialty, double? lat, double? lng}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      HomeProvider.onUserAction?.call('arzt gesucht');

      // Koordinaten merken für nachfolgende Calls ohne lat/lng
      // (z.B. Filter-Chip-Klick, Pull-to-Refresh)
      if (lat != null && lng != null) {
        _lastLat = lat;
        _lastLng = lng;
      }

      // Wenn lat/lng übergeben ODER gespeichert: Overpass + DB (nearby)
      final useLat = lat ?? _lastLat;
      final useLng = lng ?? _lastLng;

      if (useLat != null && useLng != null) {
        final query = <String, String>{
          'lat': useLat.toString(),
          'lng': useLng.toString(),
          'radius': '5000',
        };
        final uri = Uri.https(
          Uri.parse(AppConfig.backendUrl).host,
          '/api/health/doctors/nearby',
          query,
        );
        final response = await http.get(uri, headers: {
          'Content-Type': 'application/json'
        }).timeout(const Duration(seconds: 30));
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          _allDoctors =
              (data['doctors'] as List).map((d) => Doctor.fromJson(d)).toList();
          // Specialty-Filter client-side anwenden
          filterBySpecialty(specialty ?? _selectedSpecialty);
          return;
        }
      }

      // Fallback: Kein GPS verfügbar
      if (_allDoctors.isNotEmpty) {
        _error =
            'Standort nicht verfügbar — Filter benötigen GPS. Ziehen Sie zum Aktualisieren.';
      } else {
        _error =
            'GPS-Position benötigt. Bitte Standortzugriff aktivieren, um Ärzte in Ihrer Nähe zu finden.';
        _doctors = [];
      }
    } catch (e) {
      if (_allDoctors.isEmpty) {
        _error = 'Ärzte konnten nicht geladen werden: $e';
      } else {
        _error = 'Aktualisierung fehlgeschlagen: $e';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadSlots(String doctorId, String date) async {
    _isLoading = true;
    _error = null;
    _selectedDoctorId = doctorId;
    _slots = [];
    notifyListeners();
    try {
      final url =
          '${AppConfig.backendUrl}/api/health/doctors/$doctorId/slots?date=$date';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _slots =
            (data['slots'] as List).map((s) => TimeSlot.fromJson(s)).toList();
      }
    } catch (e) {
      _error = 'Zeitslots konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> bookAppointment(String doctorId, String patientName,
      String patientEmail, String date, String time) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final url = '${AppConfig.backendUrl}/api/health/appointments';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'doctorId': doctorId,
              'patientName': patientName,
              'patientEmail': patientEmail,
              'date': date,
              'time': time,
            }),
          )
          .timeout(const Duration(seconds: 30));
      return response.statusCode == 200;
    } catch (e) {
      _error = 'Terminbuchung fehlgeschlagen: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// OSM-Arzt on-demand in DB speichern (standortunabhaengig).
  /// Wird aufgerufen wenn User auf Overpass-Arzt tippt — danach ist
  /// Terminbuchung moeglich egal wo auf der Welt.
  Future<bool> ensureDoctor(Doctor doctor) async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/doctors/ensure';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'id': doctor.id,
              'name': doctor.name,
              'specialty': doctor.specialty,
              'address': doctor.address,
              'phone': doctor.phone,
              'latitude': doctor.latitude,
              'longitude': doctor.longitude,
            }),
          )
          .timeout(const Duration(seconds: 15));
      return response.statusCode == 200;
    } catch (_) {
      return false; // Silent fallback — Arzt bleibt sichtbar, nur Slots fehlen
    }
  }

  Future<bool> registerDoctor({
    required String name,
    required String specialty,
    required String address,
    String? phone,
    String? email,
    double? latitude,
    double? longitude,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final url = '${AppConfig.backendUrl}/api/health/doctors';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'name': name,
              'specialty': specialty,
              'address': address,
              if (phone != null && phone.isNotEmpty) 'phone': phone,
              if (email != null && email.isNotEmpty) 'email': email,
              if (latitude != null) 'latitude': latitude,
              if (longitude != null) 'longitude': longitude,
            }),
          )
          .timeout(const Duration(seconds: 30));
      return response.statusCode == 201;
    } catch (e) {
      _error = 'Registrierung fehlgeschlagen: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
