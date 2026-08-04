/// events_provider.dart — Backend-Anbindung fuer Events & Veranstaltungen
///
/// Architektur (mirror buergeramt_provider.dart):
/// - Online: ruft /api/events?lat=...&lng=...&radius=...
/// - GPS via LocationService
/// - Kategorie-Filter auf Provider-Ebene

import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/services/location_service.dart';
import 'events_dto.dart';

class EventsProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  EventsResponse? _response;
  String _selectedCategory = 'all';
  double? _lat;
  double? _lng;

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  EventsResponse? get response => _response;
  List<EventDto> get events => _response?.events ?? [];
  int get count => _response?.count ?? 0;
  double? get lat => _lat;
  double? get lng => _lng;
  String get selectedCategory => _selectedCategory;

  List<EventDto> get filteredEvents {
    if (_response == null) return [];
    if (_selectedCategory == 'all') return _response!.events;
    return _response!.events
        .where((e) => e.category == _selectedCategory)
        .toList();
  }

  Set<String> get categories {
    if (_response == null) return {};
    return _response!.events.map((e) => e.category).toSet();
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /// Standort laden und Events abrufen
  Future<void> loadEvents() async {
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
      await _fetchEvents();
    } catch (e) {
      _error = 'Standortfehler: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Events neu laden (Pull-to-Refresh)
  Future<void> refresh() async {
    if (_lat == null || _lng == null) {
      await loadEvents();
      return;
    }
    await _fetchEvents();
  }

  /// Kategorie-Filter setzen
  void setCategory(String category) {
    _selectedCategory = category;
    notifyListeners();
  }

  /// Events vom Backend abrufen
  Future<void> _fetchEvents() async {
    try {
      final data = await apiGet(
        '/api/events?lat=$_lat&lng=$_lng&radius=10',
      );
      _response = EventsResponse.fromJson(data);
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
    _selectedCategory = 'all';
    notifyListeners();
  }
}
