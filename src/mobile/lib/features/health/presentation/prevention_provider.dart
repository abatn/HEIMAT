import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/app_config.dart';
import '../../../core/services/auth_service.dart';
import '../prevention_dto.dart';

/// PreventionProvider — Steuerung des Präventions-Services.
///
/// **Backend:** GET/POST/PUT /api/health/prevention/* (JWT-Protected)
/// **Zweck:** Personalisierte Vorsorge-Empfehlungen basierend auf Profil.
class PreventionProvider extends ChangeNotifier {
  final AuthService _authService;

  PreventionProvider(this._authService);

  // ===== State =====
  List<PreventionRecommendation> _recommendations = [];
  List<PreventionRecommendation> _completed = [];
  PreventionStats? _stats;
  UserProfile? _profile;
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  // ===== Getters =====
  List<PreventionRecommendation> get recommendations => _recommendations;
  List<PreventionRecommendation> get completed => _completed;
  PreventionStats? get stats => _stats;
  UserProfile? get profile => _profile;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;

  /// Aktive Empfehlungen (nicht abgeschlossen)
  List<PreventionRecommendation> get activeRecommendations =>
      _recommendations.where((r) => !r.isCompleted).toList();

  /// Hoch-Prioritäts-Empfehlungen
  List<PreventionRecommendation> get highPriority => _recommendations
      .where((r) => r.priority == 'hoch' && !r.isCompleted)
      .toList();

  // ===== API Methods =====

  /// Empfehlungen generieren
  Future<List<PreventionRecommendation>> generateRecommendations() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/health/prevention/generate';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({}),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        final newRecs = (data['new_recommendations'] as List? ?? [])
            .map((e) => PreventionRecommendation.fromJson(e))
            .toList();

        // Zu bestehenden hinzufügen
        _recommendations.addAll(newRecs);
        notifyListeners();
        return newRecs;
      } else {
        _error = 'Generierung fehlgeschlagen';
        return [];
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
      return [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Aktive Empfehlungen laden
  Future<void> loadRecommendations() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/prevention',
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _recommendations = (data['recommendations'] as List? ?? [])
            .map((e) => PreventionRecommendation.fromJson(e))
            .toList();
        _hasLoaded = true;
      } else {
        _error = 'Empfehlungen konnten nicht geladen werden';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Empfehlung als erledigt markieren
  Future<bool> completeRecommendation(String recommendationId,
      {String? doctorId}) async {
    try {
      final url =
          '${AppConfig.backendUrl}/api/health/prevention/$recommendationId';
      final response = await http
          .put(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              if (doctorId != null) 'doctor_id': doctorId,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final updated =
            PreventionRecommendation.fromJson(data['recommendation']);

        // In der Liste aktualisieren
        final index =
            _recommendations.indexWhere((r) => r.id == recommendationId);
        if (index != -1) {
          _recommendations[index] = updated;
          _completed.insert(0, updated);
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

  /// Erledigte Empfehlungen laden
  Future<void> loadCompleted() async {
    try {
      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/prevention/history',
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _completed = (data['history'] as List? ?? [])
            .map((e) => PreventionRecommendation.fromJson(e))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Statistiken laden
  Future<void> loadStats() async {
    try {
      final url = '${AppConfig.backendUrl}/api/health/prevention/stats';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _stats = PreventionStats.fromJson(data['stats']);
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Empfehlungen nach Kategorie gruppieren
  Map<String, List<PreventionRecommendation>> get byCategory {
    final map = <String, List<PreventionRecommendation>>{};
    for (final rec in activeRecommendations) {
      map.putIfAbsent(rec.category, () => []).add(rec);
    }
    return map;
  }

  /// Empfehlungen nach Priorität gruppieren
  Map<String, List<PreventionRecommendation>> get byPriority {
    final map = <String, List<PreventionRecommendation>>{};
    for (final rec in activeRecommendations) {
      map.putIfAbsent(rec.priority, () => []).add(rec);
    }
    return map;
  }
}
