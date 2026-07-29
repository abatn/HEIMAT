import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';
import '../../../core/services/auth_service.dart';
import '../checkin_dto.dart';

/// CheckinProvider — Steuerung des Lebenszeichen-Check-in-Service.
///
/// **Backend:** POST/GET /api/checkin/* (JWT-Protected via requireAuth)
/// **Auth-Pattern:** mirror zu FinanceProvider → _authService.authHeaders
/// **Design:**
/// - KEIN Accelerometer, KEIN GPS, KEINE Kamera → Nur Timer-basiert
/// - User muss explizit Opt-in geben (activate())
/// - Privacy-first: alle Daten on-device oder in der eigenen DB
class CheckinProvider extends ChangeNotifier {
  final AuthService _authService;

  CheckinProvider(this._authService);

  // ===== State =====
  bool _isActive = false;
  bool _isLoading = false;
  String? _error;
  CheckinStatusDto? _status;
  CheckinSettingsDto? _settings;
  List<CheckinEventDto> _events = [];
  bool _hasLoaded = false;
  CheckinPingResult? _lastPingResult;

  // ===== Getters =====
  bool get isActive => _isActive;
  bool get isLoading => _isLoading;
  String? get error => _error;
  CheckinStatusDto? get status => _status;
  CheckinSettingsDto? get settings => _settings;
  List<CheckinEventDto> get events => _events;
  bool get hasLoaded => _hasLoaded;
  CheckinPingResult? get lastPingResult => _lastPingResult;

  /// Escalation-Stufen-Beschreibung (für UI-Anzeige)
  static String escalationDescription(int stage) {
    switch (stage) {
      case 0:
        return '✅ Alles okay — Kein Grund zur Sorge';
      case 1:
        return '⏰ Letzter Check-in überschritten — Nächste Erinnerung folgt';
      case 2:
        return '🔔 Erinnerung gesendet — Bitte melden Sie sich';
      case 3:
        return '👤 Notfallkontakt wurde benachrichtigt';
      case 4:
        return '🚑 Rettungsdienst (112) wurde informiert (mit Einwilligung)';
      default:
        return 'Status unbekannt';
    }
  }

  // ===== API Methods =====

  /// Check-in aktivieren (Opt-in). Ruft POST /api/checkin/activate auf.
  Future<void> activate({
    int? intervalHours,
    int? intervalHealthHours,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? emergencyContactEmail,
    bool auto112Enabled = false,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/checkin/activate';
      final response = await http
          .post(
            Uri.parse(url),
            headers: _authService.authHeaders,
            body: json.encode({
              if (intervalHours != null) 'intervalHours': intervalHours,
              if (intervalHealthHours != null)
                'intervalHealthHours': intervalHealthHours,
              if (emergencyContactName != null)
                'emergencyContactName': emergencyContactName,
              if (emergencyContactPhone != null)
                'emergencyContactPhone': emergencyContactPhone,
              if (emergencyContactEmail != null)
                'emergencyContactEmail': emergencyContactEmail,
              'auto112Enabled': auto112Enabled,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 201) {
        _isActive = true;
        _hasLoaded = true;
        // Sofort Status laden
        await refreshStatus();
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Aktivierung fehlgeschlagen';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Check-in deaktivieren. Ruft POST /api/checkin/deactivate auf.
  Future<void> deactivate() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/checkin/deactivate';
      final response = await http
          .post(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        _isActive = false;
        _status = null;
        _hasLoaded = true;
        _lastPingResult = null;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Deaktivierung fehlgeschlagen';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// "Mir geht's gut!" — Timer zurücksetzen. Ruft POST /api/checkin/ping.
  Future<bool> ping({String? healthSymptoms}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/checkin/ping';
      final response = await http
          .post(
            Uri.parse(url),
            headers: _authService.authHeaders,
            body: json.encode({
              if (healthSymptoms != null) 'healthSymptoms': healthSymptoms,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _lastPingResult = CheckinPingResult.fromJson(data);
        await refreshStatus();
        return true;
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Ping fehlgeschlagen';
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

  /// Aktuellen Status laden. Ruft GET /api/checkin/status.
  Future<void> refreshStatus() async {
    _error = null;

    try {
      final url = '${AppConfig.backendUrl}/api/checkin/status';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _status = CheckinStatusDto.fromJson(data);
        _isActive = _status?.isActive ?? false;
        _hasLoaded = true;
      } else {
        _isActive = false;
        _status = null;
      }
    } catch (e) {
      // Silent fail — nur wenn komplett neu laden
      if (!_hasLoaded) {
        _error = 'Status konnte nicht geladen werden: $e';
      }
    } finally {
      notifyListeners();
    }
  }

  /// Einstellungen laden. Ruft GET /api/checkin/settings.
  Future<void> loadSettings() async {
    try {
      final url = '${AppConfig.backendUrl}/api/checkin/settings';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['settings'] != null) {
          _settings = CheckinSettingsDto.fromJson(data['settings']);
        }
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Einstellungen aktualisieren. Ruft PUT /api/checkin/settings.
  Future<void> updateSettings({
    int? intervalHours,
    int? intervalHealthHours,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? emergencyContactEmail,
    bool? auto112Enabled,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.backendUrl}/api/checkin/settings';
      final response = await http
          .put(
            Uri.parse(url),
            headers: _authService.authHeaders,
            body: json.encode({
              if (intervalHours != null) 'intervalHours': intervalHours,
              if (intervalHealthHours != null)
                'intervalHealthHours': intervalHealthHours,
              if (emergencyContactName != null)
                'emergencyContactName': emergencyContactName,
              if (emergencyContactPhone != null)
                'emergencyContactPhone': emergencyContactPhone,
              if (emergencyContactEmail != null)
                'emergencyContactEmail': emergencyContactEmail,
              if (auto112Enabled != null) 'auto112Enabled': auto112Enabled,
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        await loadSettings();
      } else {
        final data = json.decode(response.body);
        _error = data['message'] ?? 'Update fehlgeschlagen';
      }
    } catch (e) {
      _error = 'Netzwerkfehler: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Ereignis-Historie laden. Ruft GET /api/checkin/events.
  Future<void> loadEvents() async {
    try {
      final url = '${AppConfig.backendUrl}/api/checkin/events';
      final response = await http
          .get(Uri.parse(url), headers: _authService.authHeaders)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['events'] != null) {
          _events = (data['events'] as List)
              .map((e) => CheckinEventDto.fromJson(e))
              .toList();
        }
        notifyListeners();
      }
    } catch (_) {}
  }
}
