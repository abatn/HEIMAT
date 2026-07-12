import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';

class Doctor {
  final String id;
  final String name;
  final String specialty;
  final String address;
  final String phone;
  final String email;
  final double latitude;
  final double longitude;

  Doctor({
    required this.id,
    required this.name,
    required this.specialty,
    required this.address,
    required this.phone,
    required this.email,
    required this.latitude,
    required this.longitude,
  });

  factory Doctor.fromJson(Map<String, dynamic> json) {
    return Doctor(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      specialty: json['specialty'] ?? '',
      address: json['address'] ?? '',
      phone: json['phone'] ?? '',
      email: json['email'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
    );
  }
}

class Appointment {
  final String id;
  final String doctorId;
  final String patientName;
  final String patientEmail;
  final String appointmentDate;
  final String appointmentTime;
  final String status;

  Appointment({
    required this.id,
    required this.doctorId,
    required this.patientName,
    required this.patientEmail,
    required this.appointmentDate,
    required this.appointmentTime,
    required this.status,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      patientName: json['patient_name'] ?? '',
      patientEmail: json['patient_email'] ?? '',
      appointmentDate: json['appointment_date'] ?? '',
      appointmentTime: json['appointment_time'] ?? '',
      status: json['status'] ?? '',
    );
  }
}

class HealthProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Doctor> _doctors = [];
  List<Appointment> _appointments = [];
  List<String> _availableSlots = [];

  bool _isLoading = false;
  String? _error;

  List<Doctor> get doctors => _doctors;
  List<Appointment> get appointments => _appointments;
  List<String> get availableSlots => _availableSlots;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> searchDoctors({String? specialty, String? location}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final params = <String>[];
      if (specialty != null && specialty.isNotEmpty) {
        params.add('specialty=${Uri.encodeComponent(specialty)}');
      }
      if (location != null && location.isNotEmpty) {
        params.add('location=${Uri.encodeComponent(location)}');
      }
      final query = params.isNotEmpty ? '?${params.join('&')}' : '';

      final response = await _api.get('/api/health/doctors$query');
      _doctors =
          (response['doctors'] as List).map((d) => Doctor.fromJson(d)).toList();
    } catch (e) {
      _error = 'Ärzte konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadAvailableSlots(String doctorId, String date) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get(
        '/api/health/doctors/$doctorId/slots?date=$date',
      );
      _availableSlots =
          (response['slots'] as List).map((s) => s.toString()).toList();
    } catch (e) {
      _error = 'Verfügbare Termine konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> bookAppointment({
    required String doctorId,
    required String patientName,
    required String patientEmail,
    required String date,
    required String time,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.post('/api/health/appointments', {
        'doctorId': doctorId,
        'patientName': patientName,
        'patientEmail': patientEmail,
        'date': date,
        'time': time,
      });
      // Nach Buchung: Termine neu laden
      await loadAppointments(patientName);
      return true;
    } catch (e) {
      _error = 'Termin konnte nicht gebucht werden: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> loadAppointments(String patientName) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get(
        '/api/health/appointments/${Uri.encodeComponent(patientName)}',
      );
      _appointments = (response['appointments'] as List)
          .map((a) => Appointment.fromJson(a))
          .toList();
    } catch (e) {
      _error = 'Termine konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> cancelAppointment(String appointmentId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.put('/api/health/appointments/$appointmentId/cancel', {});
      // Nach Stornierung: Termine neu laden
      if (_appointments.isNotEmpty) {
        await loadAppointments(_appointments.first.patientName);
      }
    } catch (e) {
      _error = 'Termin konnte nicht storniert werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }
}
