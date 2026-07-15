import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';

class Doctor {
  final String id;
  final String name;
  final String specialty;
  final String address;
  final String phone;

  Doctor(
      {required this.id,
      required this.name,
      required this.specialty,
      required this.address,
      required this.phone});

  factory Doctor.fromJson(Map<String, dynamic> json) {
    return Doctor(
        id: json['id'] ?? '',
        name: json['name'] ?? '',
        specialty: json['specialty'] ?? '',
        address: json['address'] ?? '',
        phone: json['phone'] ?? '');
  }
}

class TimeSlot {
  final String startTime;
  final String endTime;
  final bool isAvailable;

  TimeSlot(
      {required this.startTime,
      required this.endTime,
      required this.isAvailable});

  factory TimeSlot.fromJson(dynamic json) {
    if (json is String) {
      return TimeSlot(
        startTime: json,
        endTime: '',
        isAvailable: true,
      );
    }
    return TimeSlot(
      startTime: json['start_time'] ?? json['startTime'] ?? '',
      endTime: json['end_time'] ?? json['endTime'] ?? '',
      isAvailable: json['is_available'] ?? json['isAvailable'] ?? true,
    );
  }
}

class HealthProvider extends ChangeNotifier {
  List<Doctor> _doctors = [];
  bool _isLoading = false;
  String? _error;
  List<TimeSlot> _slots = [];
  String? _selectedDoctorId;

  List<Doctor> get doctors => _doctors;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<TimeSlot> get slots => _slots;
  String? get selectedDoctorId => _selectedDoctorId;

  Future<void> searchDoctors({String? specialty}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final query = specialty != null && specialty.isNotEmpty
          ? '?specialty=${Uri.encodeComponent(specialty)}'
          : '';
      final url = '${AppConfig.backendUrl}/api/health/doctors$query';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.statusCode}');
      }
      final data = json.decode(response.body);
      _doctors =
          (data['doctors'] as List).map((d) => Doctor.fromJson(d)).toList();
    } catch (e) {
      _error = 'Ärzte konnten nicht geladen werden: $e';
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
}
