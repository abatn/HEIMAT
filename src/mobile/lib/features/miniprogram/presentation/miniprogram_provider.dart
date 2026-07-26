import 'package:flutter/material.dart';
import 'miniprogram_model.dart';

/// Verwaltet die Registry aller verfügbaren Mini-Programme.
/// Stellt Methoden bereit zum Durchsuchen, Filtern und Starten.
class MiniProgramProvider extends ChangeNotifier {
  List<MiniProgram> _programs = [];
  bool _isLoading = false;
  String? _error;

  MiniProgramProvider() {
    _programs = _defaultPrograms;
  }

  // ---------------------------------------------------------------------------
  // Getter
  // ---------------------------------------------------------------------------

  List<MiniProgram> get programs => _programs;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<MiniProgram> get activePrograms =>
      _programs.where((p) => p.isActive).toList();

  List<String> get categories {
    final cats =
        _programs.where((p) => p.isActive).map((p) => p.category).toSet();
    return ['Alle', ...cats];
  }

  List<MiniProgram> programsByCategory(String category) {
    if (category == 'Alle') return activePrograms;
    return activePrograms.where((p) => p.category == category).toList();
  }

  // ---------------------------------------------------------------------------
  // Standard-Registry (für Phase A — später via Backend erweiterbar)
  // ---------------------------------------------------------------------------

  static final List<MiniProgram> _defaultPrograms = [
    const MiniProgram(
      id: 'futai',
      name: 'Futai Chat',
      url: 'https://futai.app',
      iconPath: 'chat',
      description:
          'KI-Twin Chat mit Gedächtnis & Emotionen. Dein persönlicher AI-Assistent.',
      category: 'Social',
    ),
    const MiniProgram(
      id: 'weather',
      name: 'Wetter',
      url: 'https://heimat-backend.onrender.com/mini/weather.html',
      iconPath: 'weather',
      description:
          'Aktuelle Wetterdaten & 7-Tage-Vorhersage — DWD Open Data via Open-Meteo. Standort-basiert.',
      category: 'Alltag',
    ),
    const MiniProgram(
      id: 'air',
      name: 'Luftqualität',
      url: 'https://luftdaten.umweltbundesamt.de',
      iconPath: 'air',
      description:
          'Feinstaub- und Ozonwerte für deinen Standort vom Umweltbundesamt.',
      category: 'Alltag',
    ),
    const MiniProgram(
      id: 'events',
      name: 'Veranstaltungen',
      url: 'https://www.wikidata.org',
      iconPath: 'events',
      description:
          'Events und Aktivitäten in deiner Nähe — aus Wikidata & OpenStreetMap.',
      category: 'Kultur',
    ),
    const MiniProgram(
      id: 'jobs',
      name: 'Job-Suche',
      url: 'https://www.arbeitsagentur.de',
      iconPath: 'work',
      description:
          'Stellenangebote der Bundesagentur für Arbeit — regional & branchenspezifisch.',
      category: 'Karriere',
    ),
    const MiniProgram(
      id: 'charging',
      name: 'E-Ladestationen',
      url: 'https://www.goingelectric.de',
      iconPath: 'ev',
      description:
          'E-Auto Ladestationen in deiner Nähe mit Verfügbarkeit & Anschlusstypen.',
      category: 'Mobilität',
    ),
    const MiniProgram(
      id: 'waste',
      name: 'Abfallkalender',
      url: 'https://opendata.de',
      iconPath: 'delete',
      description: 'Abfuhrtermine & Sortier-Tipps für deine Gemeinde.',
      category: 'Alltag',
    ),
    const MiniProgram(
      id: 'hotels',
      name: 'Hotels & Unterkünfte',
      url: 'https://www.openstreetmap.org',
      iconPath: 'hotel',
      description: 'Unterkünfte in deiner Nähe aus OpenStreetMap & Wikidata.',
      category: 'Reise',
    ),
    const MiniProgram(
      id: 'parking',
      name: 'Parken',
      url: 'https://www.openstreetmap.org',
      iconPath: 'parking',
      description:
          'Parkplätze & Parkhäuser in deiner Nähe — inklusive Öffnungszeiten.',
      category: 'Mobilität',
    ),
    const MiniProgram(
      id: 'buergeramt',
      name: 'Bürgeramt',
      url: 'https://service.berlin.de',
      iconPath: 'domain',
      description: 'Termine & Services deiner lokalen Bürgerämter.',
      category: 'Behörden',
    ),
  ];

  // ---------------------------------------------------------------------------
  // Aktionen
  // ---------------------------------------------------------------------------

  /// Lädt Mini-Programme.
  /// Aktuell: nutzt die Standard-Registry.
  /// TODO: Später via GET /api/miniprograms vom Backend laden.
  Future<void> loadPrograms() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    // Phase A: hardcodierte Liste. Sobald Backend-Endpoint existiert,
    // wird hier ein http.get() mit try/catch eingebaut.
    _programs = _defaultPrograms;
    _isLoading = false;
    notifyListeners();
  }

  /// Setzt das aktive Mini-Programm (wird im Viewer geladen).
  MiniProgram? _activeProgram;

  MiniProgram? get activeProgram => _activeProgram;

  void launchProgram(MiniProgram program) {
    _activeProgram = program;
    notifyListeners();
  }

  void closeProgram() {
    _activeProgram = null;
    notifyListeners();
  }
}
