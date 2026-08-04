/// hotels_provider.dart — Backend-Anbindung fuer Hotels & Unterkuenfte
///
/// Architektur (mirror events_provider.dart):
/// - Online: ruft /api/hotels?lat=...&lng=...&radius=...
/// - GPS via LocationService
/// - Typ-Filter auf Provider-Ebene

import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/services/location_service.dart';
import 'hotels_dto.dart';

class HotelsProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  HotelsResponse? _response;
  String _selectedType = 'all';
  double? _lat;
  double? _lng;

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  HotelsResponse? get response => _response;
  List<HotelDto> get hotels => _response?.hotels ?? [];
  int get count => _response?.count ?? 0;
  double? get lat => _lat;
  double? get lng => _lng;
  String get selectedType => _selectedType;

  List<HotelDto> get filteredHotels {
    if (_response == null) return [];
    if (_selectedType == 'all') return _response!.hotels;
    return _response!.hotels.where((h) => h.type == _selectedType).toList();
  }

  Set<String> get types {
    if (_response == null) return {};
    return _response!.hotels.map((h) => h.type).toSet();
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /// Standort laden und Hotels abrufen
  Future<void> loadHotels() async {
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
      await _fetchHotels();
    } catch (e) {
      _error = 'Standortfehler: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Hotels neu laden (Pull-to-Refresh)
  Future<void> refresh() async {
    if (_lat == null || _lng == null) {
      await loadHotels();
      return;
    }
    await _fetchHotels();
  }

  /// Typ-Filter setzen
  void setType(String type) {
    _selectedType = type;
    notifyListeners();
  }

  /// Hotels vom Backend abrufen
  Future<void> _fetchHotels() async {
    try {
      final data = await apiGet(
        '/api/hotels?lat=$_lat&lng=$_lng&radius=5',
      );
      _response = HotelsResponse.fromJson(data);
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
    _selectedType = 'all';
    notifyListeners();
  }
}
