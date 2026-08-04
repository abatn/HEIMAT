/// buergeramt_provider.dart — Backend-Anbindung fuer Buergeraemter
///
/// Architektur (mirror job_provider.dart):
/// - Online: ruft /api/buergeramt?lat=...&lng=...&radius=...
/// - GPS via LocationService
/// - Kein Cache noetig — Buergeraemter aendern sich selten

import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/services/location_service.dart';
import 'buergeramt_dto.dart';

class BuergeramtProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  BuergeramtResponse? _response;
  double? _lat;
  double? _lng;

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  BuergeramtResponse? get response => _response;
  List<BuergeramtDto> get aemter => _response?.aemter ?? [];
  int get count => _response?.count ?? 0;
  double? get lat => _lat;
  double? get lng => _lng;

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /// Standort laden und Buergeraemter abrufen
  Future<void> loadAemter() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final pos = await LocationService.getCurrentLocation().timeout(
        const Duration(seconds: 5),
        onTimeout: () => null,
      );

      if (pos == null) {
        _error = 'Standort nicht verfuegbar. Bitte GPS aktivieren.';
        _isLoading = false;
        notifyListeners();
        return;
      }

      _lat = pos.latitude;
      _lng = pos.longitude;
      await _fetchAemter();
    } catch (e) {
      _error = 'Standortfehler: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Buergeraemter neu laden (Pull-to-Refresh)
  Future<void> refresh() async {
    if (_lat == null || _lng == null) {
      await loadAemter();
      return;
    }
    await _fetchAemter();
  }

  /// Buergeraemter vom Backend abrufen
  Future<void> _fetchAemter() async {
    try {
      final data = await apiGet(
        '/api/buergeramt?lat=$_lat&lng=$_lng&radius=10',
      );
      _response = BuergeramtResponse.fromJson(data);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Zuruecksetzen
  void clear() {
    _response = null;
    _lat = null;
    _lng = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }
}
