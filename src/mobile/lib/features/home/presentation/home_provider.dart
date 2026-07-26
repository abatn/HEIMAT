import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart' show LatLng;
import '../../../core/config/app_config.dart';
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

class HomeProvider extends ChangeNotifier {
  final AuthService _authService;

  bool _isLoading = false;
  String? _error;
  DashboardContext? _context;
  LatLng? _currentLocation;
  NearbySummary? _nearbySummary;

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
  }  bool get isLoading => _isLoading;
  String? get error => _error;
  DashboardContext? get context => _context;
  LatLng? get currentLocation => _currentLocation;
  NearbySummary? get nearbySummary => _nearbySummary;
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

      // 3. Wenn Location verfügbar: Nearby-Summary laden
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
