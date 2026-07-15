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

class HealthProvider extends ChangeNotifier {
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
      final url = '${AppConfig.backendUrl}/api/health/doctors$query';
      final response = await http
          .get(Uri.parse(url), headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 30));
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
}
