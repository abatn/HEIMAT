import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';

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

class HealthProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  List<Doctor> _doctors = [];
  bool _isLoading = false;
  String? _error;

  List<Doctor> get doctors => _doctors;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> searchDoctors({String? specialty}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final query = specialty != null && specialty.isNotEmpty
          ? '?specialty=${Uri.encodeComponent(specialty)}'
          : '';
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
}
