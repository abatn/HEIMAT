import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/app_config.dart';
import '../../../core/services/auth_service.dart';
import '../health_medications_dto.dart';

/// HealthMedicationsProvider — Steuerung des Medikamenten-Services.
///
/// **Backend:** GET/POST/PUT/DELETE /api/health/medications/* (JWT-Protected)
/// **Zweck:** User speichert Medikamente für Interaktions-Checks.
class HealthMedicationsProvider extends ChangeNotifier {
  final AuthService _authService;

  HealthMedicationsProvider(this._authService);

  // ===== State =====
  List<UserMedication> _medications = [];
  bool _isLoading = false;
  String? _error;
  int _activeCount = 0;
  MedicationInteractionsResult? _interactions;
  bool _hasLoaded = false;

  // ===== Getters =====
  List<UserMedication> get medications => _medications;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get activeCount => _activeCount;
  MedicationInteractionsResult? get interactions => _interactions;
  bool get hasLoaded => _hasLoaded;

  /// Nur aktive Medikamente
  List<UserMedication> get activeMedications =>
      _medications.where((m) => m.isActive).toList();

  // ===== API Methods =====

  /// Alle Medikamente laden
  Future<void> loadMedications({bool activeOnly = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final queryParams = <String, String>{};
      if (activeOnly) {
        queryParams['active_only'] = 'true';
      }

      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/medications',
        queryParams.isNotEmpty ? queryParams : null,
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _medications = (data['medications'] as List? ?? [])
            .map((e) => UserMedication.fromJson(e))
            .toList();
        _activeCount = data['activeCount'] ?? 0;
        _hasLoaded = true;
      } else {
        _error = 'Medikamente konnten nicht geladen werden';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Neues Medikament hinzufügen
  Future<AddMedicationResult?> addMedication({
    required String name,
    String? activeIngredient,
    String? dosage,
    String? frequency,
    String? category,
    bool? isPrescription,
    String? startDate,
    String? notes,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/health/medications';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'name': name,
              if (activeIngredient != null)
                'active_ingredient': activeIngredient,
              if (dosage != null) 'dosage': dosage,
              if (frequency != null) 'frequency': frequency,
              if (category != null) 'category': category,
              if (isPrescription != null) 'is_prescription': isPrescription,
              if (startDate != null) 'start_date': startDate,
              if (notes != null) 'notes': notes,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        final result = AddMedicationResult.fromJson(data);

        // In die Liste einfügen
        _medications.insert(0, result.medication);
        _activeCount++;

        // Interaktionen aktualisieren
        if (result.interactions.interactions.isNotEmpty) {
          _interactions = result.interactions;
        }

        notifyListeners();
        return result;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Hinzufügen fehlgeschlagen';
        return null;
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Medikament aktualisieren
  Future<bool> updateMedication(
    String medicationId, {
    String? name,
    String? activeIngredient,
    String? dosage,
    String? frequency,
    String? category,
    bool? isPrescription,
    bool? isActive,
    String? endDate,
    String? notes,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url =
          '${AppConfig.backendUrl}/api/health/medications/$medicationId';
      final response = await http
          .put(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              if (name != null) 'name': name,
              if (activeIngredient != null)
                'active_ingredient': activeIngredient,
              if (dosage != null) 'dosage': dosage,
              if (frequency != null) 'frequency': frequency,
              if (category != null) 'category': category,
              if (isPrescription != null) 'is_prescription': isPrescription,
              if (isActive != null) 'is_active': isActive,
              if (endDate != null) 'end_date': endDate,
              if (notes != null) 'notes': notes,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final updatedMedication = UserMedication.fromJson(data['medication']);

        // In der Liste aktualisieren
        final index = _medications.indexWhere((m) => m.id == medicationId);
        if (index != -1) {
          _medications[index] = updatedMedication;
          _activeCount = _medications.where((m) => m.isActive).length;
          notifyListeners();
        }
        return true;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Update fehlgeschlagen';
        return false;
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Medikament entfernen (deaktivieren)
  Future<bool> removeMedication(String medicationId) async {
    try {
      final url =
          '${AppConfig.backendUrl}/api/health/medications/$medicationId';
      final response = await http
          .delete(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final index = _medications.indexWhere((m) => m.id == medicationId);
        if (index != -1) {
          _medications[index] = _medications[index].copyWith(isActive: false);
          _activeCount = _medications.where((m) => m.isActive).length;
          notifyListeners();
        }
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
      return false;
    }
  }

  /// Interaktions-Check für benutzerdefinierte Medikamenten-Liste
  Future<MedicationInteractionsResult?> checkInteractions(
    List<String> drugs,
  ) async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/medications/check';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({'drugs': drugs}),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return MedicationInteractionsResult.fromJson(data);
      }
      return null;
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
      return null;
    }
  }

  /// Interaktions-Check für User-Medikamente
  Future<void> checkUserInteractions() async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/medications/interactions';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _interactions = MedicationInteractionsResult.fromJson(data);
        notifyListeners();
      }
    } catch (_) {}
  }
}

/// Extension für copyWith auf UserMedication
extension UserMedicationCopyWith on UserMedication {
  UserMedication copyWith({
    String? id,
    String? userId,
    String? name,
    String? activeIngredient,
    String? dosage,
    String? frequency,
    String? category,
    bool? isPrescription,
    String? startDate,
    String? endDate,
    bool? isActive,
    String? notes,
    String? createdAt,
    String? updatedAt,
  }) {
    return UserMedication(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      activeIngredient: activeIngredient ?? this.activeIngredient,
      dosage: dosage ?? this.dosage,
      frequency: frequency ?? this.frequency,
      category: category ?? this.category,
      isPrescription: isPrescription ?? this.isPrescription,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      isActive: isActive ?? this.isActive,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
