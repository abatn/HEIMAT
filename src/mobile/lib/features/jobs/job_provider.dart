/// job_provider.dart — Backend-Anbindung für Job-Suche
///
/// Architektur (mirror air_quality_provider.dart):
/// - Online: ruft /api/jobs/search?q=&location=&branchen= (Backend → Adzuna + Arbeitnow)
/// - Kein Cache nötig — Suchergebnisse ändern sich häufig
/// - Keine Location-Abhängigkeit — Suchbegriff + optionaler Standort + optionaler Branchen-Filter

import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import 'job_dto.dart';

class JobProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  JobSearchResult? _result;
  String _query = '';
  String _location = '';
  String _branchen = 'alle';
  int _page = 0;

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  JobSearchResult? get result => _result;
  List<JobListing> get jobs => _result?.jobs ?? [];
  String get query => _query;
  String get location => _location;
  String get branchen => _branchen;
  int get total => _result?.total ?? 0;
  bool get hasMore => jobs.length < total;

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /// Branchen-Filter setzen
  void setBranchen(String branchen) {
    if (_branchen != branchen) {
      _branchen = branchen;
      notifyListeners();
      // Automatisch neu suchen wenn bereits eine Suche aktiv ist
      if (_query.isNotEmpty) {
        searchJobs(_query, location: _location.isNotEmpty ? _location : null);
      }
    }
  }

  /// Jobs suchen (erste Seite)
  Future<void> searchJobs(String query, {String? location}) async {
    if (query.trim().isEmpty) return;

    _query = query.trim();
    _location = location?.trim() ?? '';
    _page = 0;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final params = <String, String>{'q': _query};
      if (_location.isNotEmpty) {
        params['location'] = _location;
      }
      if (_branchen.isNotEmpty && _branchen != 'alle') {
        params['branchen'] = _branchen;
      }
      final queryString = params.entries
          .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
          .join('&');

      final data = await apiGet('/api/jobs/search?$queryString');
      _result = JobSearchResult.fromJson(data);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Nächste Seite laden
  Future<void> loadMore() async {
    if (!hasMore || _isLoading) return;

    _page++;
    _isLoading = true;
    notifyListeners();

    try {
      final params = <String, String>{
        'q': _query,
        'page': _page.toString(),
        'per_page': '20',
      };
      if (_location.isNotEmpty) {
        params['location'] = _location;
      }
      if (_branchen.isNotEmpty && _branchen != 'alle') {
        params['branchen'] = _branchen;
      }
      final queryString = params.entries
          .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
          .join('&');

      final data = await apiGet('/api/jobs/search?$queryString');
      final newResult = JobSearchResult.fromJson(data);

      // Ergebnisse zusammenführen
      _result = JobSearchResult(
        jobs: [...jobs, ...newResult.jobs],
        total: newResult.total,
        page: newResult.page,
        perPage: newResult.perPage,
        source: newResult.source,
      );
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Zurücksetzen
  void clear() {
    _result = null;
    _query = '';
    _location = '';
    _branchen = 'alle';
    _page = 0;
    _error = null;
    notifyListeners();
  }
}
