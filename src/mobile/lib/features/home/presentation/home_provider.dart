import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart' show LatLng;
import '../../../core/config/app_config.dart';
import '../../../core/api/api_client.dart';
import '../../../core/services/location_service.dart';
import '../../../core/services/auth_service.dart';

// ---------------------------------------------------------------------------
// Datenmodelle für das AI-Home-Dashboard
// ---------------------------------------------------------------------------

class DashboardContext {
  final String timeOfDay;
  final String greeting;
  final int dayOfWeek;
  final bool isWeekend;
  final List<Suggestion> suggestions;
  final List<QuickAction> quickActions;

  DashboardContext({
    required this.timeOfDay,
    required this.greeting,
    required this.dayOfWeek,
    required this.isWeekend,
    required this.suggestions,
    required this.quickActions,
  });

  factory DashboardContext.fromJson(Map<String, dynamic> json) {
    return DashboardContext(
      timeOfDay: json['timeOfDay'] ?? 'morning',
      greeting: json['greeting'] ?? 'Hallo',
      dayOfWeek: json['dayOfWeek'] ?? 1,
      isWeekend: json['isWeekend'] ?? false,
      suggestions: (json['suggestions'] as List? ?? [])
          .map((s) => Suggestion.fromJson(s))
          .toList(),
      quickActions: (json['quickActions'] as List? ?? [])
          .map((a) => QuickAction.fromJson(a))
          .toList(),
    );
  }
}

class Suggestion {
  final String icon;
  final String title;
  final String description;
  final String actionType;
  final String actionLabel;

  Suggestion({
    required this.icon,
    required this.title,
    required this.description,
    required this.actionType,
    required this.actionLabel,
  });

  factory Suggestion.fromJson(Map<String, dynamic> json) {
    return Suggestion(
      icon: json['icon'] ?? '💡',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      actionType: json['actionType'] ?? 'home',
      actionLabel: json['actionLabel'] ?? 'Öffnen',
    );
  }
}

class QuickAction {
  final String icon;
  final String label;
  final String actionType;
  final String? route;

  QuickAction({
    required this.icon,
    required this.label,
    required this.actionType,
    this.route,
  });

  factory QuickAction.fromJson(Map<String, dynamic> json) {
    return QuickAction(
      icon: json['icon'] ?? '📍',
      label: json['label'] ?? '',
      actionType: json['actionType'] ?? 'home',
      route: json['route'],
    );
  }
}

class NearbySummary {
  final int stopsNearby;
  final int doctorsNearby;
  final String? nearestStopName;
  final double? nearestStopDistance;

  NearbySummary({
    required this.stopsNearby,
    required this.doctorsNearby,
    this.nearestStopName,
    this.nearestStopDistance,
  });
}

// ---------------------------------------------------------------------------
// HomeProvider — mit BayesClassifier-Personalisierung
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Smart Service Snapshots — echte Daten aus allen Services
// ---------------------------------------------------------------------------

class ServiceSnapshot {
  final String service;
  final String icon;
  final String title;
  final String recommendation;
  final String data;
  final String actionType;
  final bool isError;

  ServiceSnapshot({
    required this.service,
    required this.icon,
    required this.title,
    required this.recommendation,
    required this.data,
    required this.actionType,
    this.isError = false,
  });
}

class HomeProvider extends ChangeNotifier {
  final AuthService _authService;

  bool _isLoading = false;
  String? _error;
  DashboardContext? _context;
  LatLng? _currentLocation;
  NearbySummary? _nearbySummary;
  List<ServiceSnapshot> _snapshots = [];

  /// Statischer Callback: Wird von main.dart gesetzt, damit andere Provider
  /// (Mobility, Health, Finance) Aktionen aufzeichnen können ohne
  /// eine direkte Abhängigkeit zu HomeProvider zu haben.
  static void Function(String action)? onUserAction;

  /// Letzte User-Aktionen für die BayesClassifier-Personalisierung
  final List<String> _recentActions = [];

  HomeProvider(this._authService);

  @override
  void dispose() {
    // Static-Callback beim Dispose räumen, damit keine
    // hängenden Referenzen auf alte Provider-Instanzen zeigen.
    if (onUserAction == recordAction) {
      onUserAction = null;
    }
    super.dispose();
  }

  bool get isLoading => _isLoading;
  String? get error => _error;
  DashboardContext? get context => _context;
  LatLng? get currentLocation => _currentLocation;
  NearbySummary? get nearbySummary => _nearbySummary;
  List<ServiceSnapshot> get snapshots => List.unmodifiable(_snapshots);
  String get userName => _authService.userId ?? 'Gast';
  List<String> get recentActions => List.unmodifiable(_recentActions);

  /// Zeichnet eine User-Aktion auf und aktualisiert NUR den Context
  /// (kein Location-Neuladen — das wäre zu langsam).
  /// Wird von Screens aufgerufen wenn User interagiert.
  void recordAction(String action) {
    _recentActions.add(action);
    // Maximal 10 Aktionen speichern (ältere werden verworfen)
    if (_recentActions.length > 10) {
      _recentActions.removeAt(0);
    }
    // Nur den Context neu laden (personalisiert), ohne Location/nearby
    _fetchPersonalizedContext().then((_) => notifyListeners());
  }

  /// Lädt Location + Dashboard-Kontext + Nearby-Summary
  Future<void> loadDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // 1. Location laden
      _currentLocation = await LocationService.getCurrentLocation();

      // 2. Dashboard-Kontext vom Backend (personalisiert wenn Aktionen vorhanden)
      if (_recentActions.isNotEmpty) {
        await _fetchPersonalizedContext();
      } else {
        await _fetchContext();
      }

      // 3. Service-Snapshots laden (parallel)
      if (_currentLocation != null) {
        await _loadServiceSnapshots(
          _currentLocation!.latitude,
          _currentLocation!.longitude,
        );
      }

      // 4. Nearby-Summary laden
      if (_currentLocation != null) {
        await _fetchNearbySummary(
          _currentLocation!.latitude,
          _currentLocation!.longitude,
        );
      }
    } catch (e) {
      _error = 'Dashboard konnte nicht geladen werden';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // -----------------------------------------------------------------------
  // Service-Snapshots — echte Daten mit intelligenten Empfehlungen
  // -----------------------------------------------------------------------

  Future<void> _loadServiceSnapshots(double lat, double lng) async {
    final snapshots = <ServiceSnapshot>[];

    // 1. Wetter-Snapshot
    try {
      final weather = await _fetchWeatherSnapshot(lat, lng);
      if (weather != null) snapshots.add(weather);
    } catch (_) {}

    // 2. Luftqualität-Snapshot
    try {
      final air = await _fetchAirQualitySnapshot(lat, lng);
      if (air != null) snapshots.add(air);
    } catch (_) {}

    // 3. Parken-Snapshot
    try {
      final parking = await _fetchParkingSnapshot(lat, lng);
      if (parking != null) snapshots.add(parking);
    } catch (_) {}

    _snapshots = snapshots;
  }

  Future<ServiceSnapshot?> _fetchWeatherSnapshot(double lat, double lng) async {
    final data = await apiGet('/api/weather/forecast?lat=$lat&lng=$lng');
    if (data['status'] != 'ok') return null;

    final current = data['current'] as Map<String, dynamic>? ?? {};
    final temp = (current['temperature'] as num?)?.toInt() ?? 0;
    final text = current['weatherText']?.toString() ?? 'Unbekannt';
    final wind = (current['windSpeed'] as num?)?.toInt() ?? 0;
    final precip = (current['precipitation'] as num?)?.toDouble() ?? 0;
    final code = (current['weatherCode'] as num?)?.toInt() ?? 0;

    // Intelligente Empfehlung basierend auf Daten
    String rec;
    if (precip > 5) {
      rec = '🌧️ Starker Regen! Regenjacke + Schirm Pflicht.';
    } else if (precip > 1) {
      rec = '🌦️ Leichter Regen — Jacke mitnehmen.';
    } else if (temp > 35) {
      rec = '🔥 Hitzewelle! Viel Wasser trinken, Schatten suchen.';
    } else if (temp > 25 && code <= 3) {
      rec = '☀️ Perfektes Wetter für Aktivitäten draußen!';
    } else if (temp < 5) {
      rec = '🥶 Eisig kalt — warm anziehen!';
    } else if (wind > 40) {
      rec = '💨 Stürmisch! Vorsichtig bei Fahrrad/Auto.';
    } else if (code >= 95) {
      rec = '⛈️ Gewittergefahr! Ins Innere gehen.';
    } else {
      rec = '🌤️ Angenehmes Wetter — $temp°C, $text.';
    }

    return ServiceSnapshot(
      service: 'weather',
      icon: '🌦️',
      title: '$temp°C — $text',
      recommendation: rec,
      data: 'Wind: ${wind}km/h, Niederschlag: ${precip}mm',
      actionType: 'weather',
    );
  }

  Future<ServiceSnapshot?> _fetchAirQualitySnapshot(
      double lat, double lng) async {
    final data = await apiGet('/api/air-quality/current?lat=$lat&lng=$lng');
    if (data['status'] != 'ok') return null;

    final aq = data['airQuality'] as Map<String, dynamic>? ?? {};
    final aqi = (aq['europeanAqi'] as num?)?.toInt();
    final level = aq['aqiLevel']?.toString() ?? 'Unbekannt';

    if (aqi == null) return null;

    // Intelligente Empfehlung
    String rec;
    if (aqi < 20) {
      rec = '🌿 Perfekte Luft! Ideal für Sport draußen.';
    } else if (aqi < 40) {
      rec = '👍 Gute Luft — Sport ist kein Problem.';
    } else if (aqi < 60) {
      rec =
          '🟡 Mäßig — Leichter Sport okay, Intensiv-Training lieber verschieben.';
    } else if (aqi < 80) {
      rec = '🟠 Belastet — Drinnen trainieren empfohlen.';
    } else {
      rec = '🔴 Schlecht! Konsequent drinnen bleiben.';
    }

    return ServiceSnapshot(
      service: 'air',
      icon: '🌬️',
      title: 'AQI $aqi — $level',
      recommendation: rec,
      data: 'Europäischer AQI für deinen Standort',
      actionType: 'air',
    );
  }

  Future<ServiceSnapshot?> _fetchParkingSnapshot(double lat, double lng) async {
    final data =
        await apiGet('/api/parking/spots?lat=$lat&lng=$lng&radius_km=1');
    if (data['status'] != 'ok') return null;

    final count = data['count'] as int? ?? 0;
    if (count == 0) return null;

    final spots = data['spots'] as List? ?? [];
    final names = spots
        .take(2)
        .map((s) => s['name']?.toString() ?? '')
        .where((n) => n.isNotEmpty)
        .join(', ');

    return ServiceSnapshot(
      service: 'parking',
      icon: '🚗',
      title: '$count Parkplätze in der Nähe',
      recommendation:
          '🅿️ ${names.isNotEmpty ? names : "Parkplätze verfügbar"} im Umkreis von 1km.',
      data: 'Über OpenStreetMap',
      actionType: 'parking',
    );
  }

  Future<void> _fetchContext() async {
    try {
      final response = await http
          .get(
            Uri.parse('${AppConfig.backendUrl}/api/ai/home'),
            headers: _authService.authHeaders,
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['context'] != null) {
          _context = DashboardContext.fromJson(data['context']);
        }
      }
    } catch (_) {
      // Fallback: lokaler Context ohne Backend
    }

    // Fallback falls Backend nicht antwortet
    if (_context == null) {
      _context = _generateLocalContext();
    }
  }

  /// Ruft den personalisierten Endpoint auf (POST /api/ai/home/personalized)
  /// der den BayesClassifier aus aiService.ts nutzt um Vorschläge
  /// basierend auf den letzten User-Aktionen zu personalisieren.
  Future<void> _fetchPersonalizedContext() async {
    try {
      final response = await http
          .post(
            Uri.parse('${AppConfig.backendUrl}/api/ai/home/personalized'),
            headers: {
              ..._authService.authHeaders,
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'recentActions': _recentActions,
            }),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['context'] != null) {
          _context = DashboardContext.fromJson(data['context']);
        }
      }
    } catch (_) {
      // Fallback: unpersonalisierten Context laden
      await _fetchContext();
    }
  }

  Future<void> _fetchNearbySummary(double lat, double lng) async {
    try {
      // Stops in der Nähe zählen
      final stopsResponse = await http.get(
        Uri.parse(
          '${AppConfig.backendUrl}/api/mobility/stops?lat=$lat&lng=$lng&radius=1000',
        ),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 15));

      int stopsCount = 0;
      String? nearestStop;
      double? nearestDist;

      if (stopsResponse.statusCode == 200) {
        final stopsData = json.decode(stopsResponse.body);
        stopsCount = stopsData['count'] ?? 0;
        final stops = stopsData['stops'] as List? ?? [];
        if (stops.isNotEmpty) {
          nearestStop = stops[0]['name'] ?? '';
        }
      }

      // Doctors zählen
      int doctorsCount = 0;
      final doctorsResponse = await http.get(
        Uri.parse(
          '${AppConfig.backendUrl}/api/health/doctors/nearby?lat=$lat&lng=$lng&radius=5000',
        ),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 15));

      if (doctorsResponse.statusCode == 200) {
        final doctorsData = json.decode(doctorsResponse.body);
        doctorsCount = doctorsData['count'] ?? 0;
      }

      _nearbySummary = NearbySummary(
        stopsNearby: stopsCount,
        doctorsNearby: doctorsCount,
        nearestStopName: nearestStop,
        nearestStopDistance: nearestDist,
      );
    } catch (_) {
      _nearbySummary = NearbySummary(stopsNearby: 0, doctorsNearby: 0);
    }
  }

  /// Lokaler Fallback-Kontext falls Backend offline
  DashboardContext _generateLocalContext() {
    final hour = DateTime.now().hour;
    final day = DateTime.now().weekday;
    final isWeekend = day == DateTime.saturday || day == DateTime.sunday;

    String timeOfDay;
    String greeting;
    List<Suggestion> suggestions;
    List<QuickAction> quickActions;

    if (hour >= 5 && hour < 12) {
      timeOfDay = 'morning';
      greeting = 'Guten Morgen';
      suggestions = [
        Suggestion(
          icon: '🚇',
          title: 'Pendler-Info',
          description: 'Prüfe deine Pendler-Route auf aktuelle Verspätungen.',
          actionType: 'mobility',
          actionLabel: 'Abfahrten prüfen',
        ),
        Suggestion(
          icon: '📅',
          title: 'Heutiger Tag',
          description: 'Ein guter Tag, um deine Finanzen zu checken.',
          actionType: 'finance',
          actionLabel: 'Zum Wallet',
        ),
      ];
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
      greeting = 'Guten Tag';
      suggestions = [
        Suggestion(
          icon: '📰',
          title: 'Veranstaltungen',
          description: 'Finde Events und Aktivitäten in deiner Nähe.',
          actionType: 'mobility',
          actionLabel: 'Erkunden',
        ),
      ];
    } else {
      timeOfDay = 'evening';
      greeting = 'Guten Abend';
      suggestions = [
        Suggestion(
          icon: '🏥',
          title: 'Arzttermine',
          description: 'Plane einen Arzttermin für die nächste Woche.',
          actionType: 'health',
          actionLabel: 'Ärzte suchen',
        ),
      ];
    }

    if (isWeekend) {
      suggestions.insert(
        0,
        Suggestion(
          icon: '🎪',
          title: 'Wochenend-Ausflug',
          description: 'Perfekt für einen Ausflug! Prüfe Verbindungen.',
          actionType: 'mobility',
          actionLabel: 'Route planen',
        ),
      );
    }

    quickActions = [
      QuickAction(icon: '🚇', label: 'Route', actionType: 'mobility'),
      QuickAction(icon: '🏥', label: 'Arzt', actionType: 'health'),
      QuickAction(icon: '💰', label: 'KUDOS', actionType: 'finance'),
      QuickAction(icon: '📍', label: 'Nähe', actionType: 'mobility'),
    ];

    return DashboardContext(
      timeOfDay: timeOfDay,
      greeting: greeting,
      dayOfWeek: day,
      isWeekend: isWeekend,
      suggestions: suggestions,
      quickActions: quickActions,
    );
  }
}
