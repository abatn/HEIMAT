import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/app_config.dart';
import '../../../core/services/auth_service.dart';
import '../mental_health_dto.dart';

/// MentalHealthProvider — Steuerung des Mental Health Services (PHQ-9).
///
/// **Backend:** POST/GET /api/health/mental/* (JWT-Protected)
/// **Zweck:** PHQ-9 Screening + Ollama-Hybrid für Depression Assessment.
class MentalHealthProvider extends ChangeNotifier {
  final AuthService _authService;

  MentalHealthProvider(this._authService);

  // ===== State =====
  Phq9Assessment? _lastAssessment;
  List<Phq9Assessment> _history = [];
  Phq9Stats? _stats;
  List<EmergencyContact> _emergencyContacts = [];
  List<Phq9Question> _questions = [];
  List<Phq9Scale> _scale = [];
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  // ===== Getters =====
  Phq9Assessment? get lastAssessment => _lastAssessment;
  List<Phq9Assessment> get history => _history;
  Phq9Stats? get stats => _stats;
  List<EmergencyContact> get emergencyContacts => _emergencyContacts;
  List<Phq9Question> get questions => _questions;
  List<Phq9Scale> get scale => _scale;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;

  // ===== API Methods =====

  /// PHQ-9 Screening durchführen
  Future<Phq9Assessment?> createAssessment({
    required Phq9Answers answers,
    String? additionalNotes,
    Map<String, double>? location,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/health/mental/phq9';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'answers': answers.toJson(),
              if (additionalNotes != null) 'additional_notes': additionalNotes,
              if (location != null) 'location': location,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        _lastAssessment = Phq9Assessment.fromJson(data['assessment']);
        _history.insert(0, _lastAssessment!);
        notifyListeners();
        return _lastAssessment;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Screening fehlgeschlagen';
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

  /// PHQ-9 Verlauf laden
  Future<void> loadHistory({int limit = 20}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/mental/phq9/history',
        {'limit': limit.toString()},
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _history = (data['history'] as List? ?? [])
            .map((e) => Phq9Assessment.fromJson(e))
            .toList();
        _hasLoaded = true;
      } else {
        _error = 'Verlauf konnte nicht geladen werden';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Statistiken laden
  Future<void> loadStats() async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/mental/stats';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _stats = Phq9Stats.fromJson(data['stats']);
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Notfall-Kontakte laden
  Future<void> loadEmergencyContacts() async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/mental/crisis';
      final response =
          await http.get(Uri.parse(url)).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _emergencyContacts = (data['contacts'] as List? ?? [])
            .map((e) => EmergencyContact.fromJson(e))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  /// PHQ-9 Fragen laden (Referenz)
  Future<void> loadQuestions() async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/mental/questions';
      final response =
          await http.get(Uri.parse(url)).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _questions = (data['questions'] as List? ?? [])
            .map((e) => Phq9Question.fromJson(e))
            .toList();
        _scale = (data['scale'] as List? ?? [])
            .map((e) => Phq9Scale.fromJson(e))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Formatierte Fragen mit Skala laden
  Future<void> loadQuestionsWithScale() async {
    if (_questions.isEmpty) {
      await loadQuestions();
    }
  }

  /// Neuen Screen starten (State zurücksetzen)
  void resetAssessment() {
    _lastAssessment = null;
    notifyListeners();
  }
}
