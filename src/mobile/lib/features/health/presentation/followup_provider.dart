import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/app_config.dart';
import '../../../core/services/auth_service.dart';
import '../followup_dto.dart';

/// FollowUpProvider — Steuerung des Nachsorge-Services.
///
/// **Backend:** GET/POST /api/health/followups/* (JWT-Protected)
/// **Zweck:** Automatische Nachsorge nach Arztbesuchen.
class FollowUpProvider extends ChangeNotifier {
  final AuthService _authService;

  FollowUpProvider(this._authService);

  // ===== State =====
  List<FollowUp> _pendingFollowUps = [];
  List<FollowUp> _history = [];
  FollowUpStats? _stats;
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  // ===== Getters =====
  List<FollowUp> get pendingFollowUps => _pendingFollowUps;
  List<FollowUp> get history => _history;
  FollowUpStats? get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;

  /// Fällige Follow-ups (heute oder überfällig)
  List<FollowUp> get dueFollowUps =>
      _pendingFollowUps.where((f) => f.isDue && !f.responded).toList();

  /// Offene Follow-ups (nicht beantwortet)
  List<FollowUp> get openFollowUps =>
      _pendingFollowUps.where((f) => !f.responded).toList();

  // ===== API Methods =====

  /// Offene Follow-ups laden
  Future<void> loadPending() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/followups',
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _pendingFollowUps = (data['followups'] as List? ?? [])
            .map((e) => FollowUp.fromJson(e))
            .toList();
        _hasLoaded = true;
      } else {
        _error = 'Follow-ups konnten nicht geladen werden';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Auf Follow-up antworten
  Future<bool> respondToFollowUp({
    required String followUpId,
    required String text,
    required int severity,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/health/followups/$followUpId/respond';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'text': text,
              'severity': severity,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final updated = FollowUp.fromJson(data['followup']);
        
        // In der Liste aktualisieren
        final index = _pendingFollowUps.indexWhere((f) => f.id == followUpId);
        if (index != -1) {
          _pendingFollowUps[index] = updated;
          if (updated.responded) {
            _history.insert(0, updated);
          }
          notifyListeners();
        }
        return true;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Antwort fehlgeschlagen';
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

  /// Verlauf laden
  Future<void> loadHistory({int limit = 20}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uri = Uri.https(
        Uri.parse(AppConfig.backendUrl).host,
        '/api/health/followups/history',
        {'limit': limit.toString()},
      );

      final response = await http
          .get(uri, headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _history = (data['history'] as List? ?? [])
            .map((e) => FollowUp.fromJson(e))
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
      final url = '${AppConfig.backendUrl}/api/health/followups/stats';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _stats = FollowUpStats.fromJson(data['stats']);
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Follow-ups nach Typ gruppieren
  Map<String, List<FollowUp>> get byType {
    final map = <String, List<FollowUp>>{};
    for (final fu in _pendingFollowUps) {
      map.putIfAbsent(fu.followupType, () => []).add(fu);
    }
    return map;
  }

  /// Benachrichtigungstext für Badge
  String get badgeText {
    final count = dueFollowUps.length;
    if (count == 0) return '';
    return count.toString();
  }
}
