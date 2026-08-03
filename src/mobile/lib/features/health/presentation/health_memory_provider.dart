import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/app_config.dart';
import '../../../core/services/auth_service.dart';
import '../health_memory_dto.dart';

/// HealthMemoryProvider — Steuerung des Gedächtnis-Services (Symptom-Verlauf).
///
/// **Backend:** GET/POST/PUT/DELETE /api/health/memory/* (JWT-Protected)
/// **Zweck:** Speichert Symptome über Tage/Wochen für Ollama-Gedächtnis.
class HealthMemoryProvider extends ChangeNotifier {
  final AuthService _authService;

  HealthMemoryProvider(this._authService);

  // ===== State =====
  List<HealthMemoryEntry> _memories = [];
  bool _isLoading = false;
  String? _error;
  HealthMemoryStats? _stats;
  bool _hasLoaded = false;

  // ===== Getters =====
  List<HealthMemoryEntry> get memories => _memories;
  bool get isLoading => _isLoading;
  String? get error => _error;
  HealthMemoryStats? get stats => _stats;
  bool get hasLoaded => _hasLoaded;

  /// Aktive Symptome (nicht gelöst)
  List<HealthMemoryEntry> get activeMemories =>
      _memories.where((m) => !m.isResolved).toList();

  /// Gelöste Symptome
  List<HealthMemoryEntry> get resolvedMemories =>
      _memories.where((m) => m.isResolved).toList();

  // ===== API Methods =====

  /// Symptom-Verlauf laden
  Future<void> loadMemory({
    int limit = 20,
    String? symptom,
    int? days,
    bool? resolved,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };
      if (symptom != null && symptom.isNotEmpty) {
        queryParams['symptom'] = symptom;
      }
      if (days != null) {
        queryParams['days'] = days.toString();
      }
      if (resolved != null) {
        queryParams['resolved'] = resolved.toString();
      }

      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/memory',
        queryParams,
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _memories = (data['memories'] as List? ?? [])
            .map((e) => HealthMemoryEntry.fromJson(e))
            .toList();
        _hasLoaded = true;
      } else {
        _error = 'Gedächtnis konnte nicht geladen werden';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Neuen Symptom-Eintrag erstellen
  Future<bool> createMemory({
    required String symptomText,
    String? symptomCategory,
    int? severity,
    String? duration,
    String? triageLevel,
    double? triageConfidence,
    List<String>? icdCodes,
    Map<String, double>? location,
    String? weatherCondition,
    String? season,
    List<String>? medicationsUsed,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/health/memory';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'symptom_text': symptomText,
              if (symptomCategory != null) 'symptom_category': symptomCategory,
              if (severity != null) 'severity': severity,
              if (duration != null) 'duration': duration,
              if (triageLevel != null) 'triage_level': triageLevel,
              if (triageConfidence != null) 'triage_confidence': triageConfidence,
              if (icdCodes != null) 'icd_codes': icdCodes,
              if (location != null) 'location': location,
              if (weatherCondition != null) 'weather_condition': weatherCondition,
              if (season != null) 'season': season,
              if (medicationsUsed != null) 'medications_used': medicationsUsed,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        final newMemory = HealthMemoryEntry.fromJson(data['memory']);
        _memories.insert(0, newMemory);
        notifyListeners();
        return true;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Erstellen fehlgeschlagen';
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

  /// Symptom als gelöst markieren
  Future<bool> resolveMemory(
    String memoryId, {
    bool? doctorVisit,
    String? doctorId,
    String? notes,
  }) async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/memory/$memoryId/resolve';
      final response = await http
          .put(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              if (doctorVisit != null) 'doctor_visit': doctorVisit,
              if (doctorId != null) 'doctor_id': doctorId,
              if (notes != null) 'notes': notes,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final updatedMemory = HealthMemoryEntry.fromJson(data['memory']);
        
        // In der Liste aktualisieren
        final index = _memories.indexWhere((m) => m.id == memoryId);
        if (index != -1) {
          _memories[index] = updatedMemory;
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

  /// Symptom löschen
  Future<bool> deleteMemory(String memoryId) async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/memory/$memoryId';
      final response = await http
          .delete(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        _memories.removeWhere((m) => m.id == memoryId);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
      return false;
    }
  }

  /// Statistiken laden
  Future<void> loadStats() async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/memory/stats';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _stats = HealthMemoryStats.fromJson(data['stats']);
        notifyListeners();
      }
    } catch (_) {}
  }
}
