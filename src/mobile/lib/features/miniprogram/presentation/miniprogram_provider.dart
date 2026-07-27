import 'package:flutter/material.dart';
import 'miniprogram_model.dart';
import '../domain/live_status_model.dart';
import '../domain/ai_context_model.dart';

/// Intelligenter MiniProgramProvider - Phase B (Live-Status) + Phase C (AI-Kontext)
/// Erweitert um:
///   - Hero-Program (top-bewertetes Programm für aktuelle Tageszeit)
///   - AI-Recommendations (top 4 sortiert nach AiContext.scoreForProgram)
///   - Live-Status Fetch (parallel für alle supportsLiveStatus=true)
///   - Semantic Search (Tag-Matching mit Synonymen)
class MiniProgramProvider extends ChangeNotifier {
  List<MiniProgram> _programs = [];
  bool _isLoading = false;
  String? _error;
  String _searchQuery = '';
  AiContext _aiContext = AiContext.now();

  MiniProgramProvider() {
    _programs = _defaultPrograms;
    _refreshAiContext();
  }

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------

  List<MiniProgram> get programs => _programs;
  bool get isLoading => _isLoading;
  String? get error => _error;
  AiContext get aiContext => _aiContext;
  String get currentGreeting => _buildGreeting();

  List<MiniProgram> get activePrograms =>
      _programs.where((p) => p.isActive).toList();

  /// Top-Programm für die Tageszeit: beste AI-Score
  MiniProgram? get heroProgram {
    final active = activePrograms;
    if (active.isEmpty) return null;
    final scored = active
        .map((p) => MapEntry(
            p, _aiContext.scoreForProgram(p.id, primaryTag: p.category)))
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return scored.first.key;
  }

  /// Top 4 Empfehlungen für die AI-Strip (Hero ausgeschlossen)
  List<MiniProgram> get recommendedPrograms {
    final active = activePrograms;
    if (active.isEmpty) return [];
    final hero = heroProgram;
    final scored = active
        .where((p) => p.id != hero?.id)
        .map((p) => MapEntry(
            p, _aiContext.scoreForProgram(p.id, primaryTag: p.category)))
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return scored.take(4).map((e) => e.key).toList();
  }

  /// Restliche Programme (nicht Hero + nicht Empfehlungen), alphabetisch
  List<MiniProgram> get remainingPrograms {
    final hero = heroProgram;
    final top = recommendedPrograms;
    return activePrograms
        .where((p) => p.id != hero?.id && !top.any((r) => r.id == p.id))
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }

  /// Programme die gerade Live-Daten geladen oder aktualisiert haben
  List<MiniProgram> get programsWithLiveData =>
      activePrograms.where((p) => p.liveData?.isLive == true).toList();

  List<String> get categories {
    final cats = activePrograms.map((p) => p.category).toSet().toList()..sort();
    return ['Alle', ...cats, '⭐ Empfohlen'];
  }

  List<MiniProgram> programsByCategory(String category) {
    final active = activePrograms;
    if (category == 'Alle') return active;
    if (category == '⭐ Empfohlen') return recommendedPrograms;
    return active.where((p) => p.category == category).toList();
  }

  // ------------------------------------------------------------------
  // Search (semantisch mit Tag-Synonymen)
  // ------------------------------------------------------------------

  String get searchQuery => _searchQuery;

  void setSearchQuery(String q) {
    if (_searchQuery == q) return;
    _searchQuery = q.toLowerCase().trim();
    notifyListeners();
  }

  List<MiniProgram> get searchResults {
    if (_searchQuery.isEmpty) return [];
    final qs = _searchQuery;
    return activePrograms.where((p) {
      // Match in name, description, category
      if (p.name.toLowerCase().contains(qs)) return true;
      if (p.description.toLowerCase().contains(qs)) return true;
      if (p.category.toLowerCase().contains(qs)) return true;
      // Match in searchTags (semantic matching)
      for (final tag in p.searchTags) {
        if (tag.toLowerCase().contains(qs)) return true;
        // Synonym-Mapping
        if (_synonyms[qs]?.contains(tag.toLowerCase()) ?? false) return true;
      }
      return false;
    }).toList();
  }

  static const Map<String, List<String>> _synonyms = {
    'wetter': ['weather', 'temperatur', 'regen'],
    'luft': ['air', 'luftqualität', 'aqi', 'schadstoff', 'pm10', 'feinstaub'],
    'müll': ['abfall', 'waste', 'abfuhr', 'entsorgung', 'müllabfuhr'],
    'veranstaltung': ['event', 'konzert', 'theater', 'fest'],
    'arbeit': ['job', 'stelle', 'karriere', 'beruf'],
    'auto': ['mobilität', 'ladestation', 'laden', 'ev', 'elektro'],
    'hotel': ['unterkunft', 'reise', 'übernachtung'],
    'cafe': ['restaurant', 'essen'],
    'behörde': ['bürgeramt', 'amt', 'verwaltung'],
  };

  // ------------------------------------------------------------------
  // Live-Status Fetch (parallel für Programme mit supportsLiveStatus)
  // ------------------------------------------------------------------

  Future<void> fetchLiveStatuses() async {
    final candidates =
        _programs.where((p) => p.supportsLiveStatus).toList(growable: false);

    // Mocking für Live-Status: jedes aktive Programm bekommt simulierte Live-Werte
    // (Production würde Backend /api/v1/mini/live aufrufen)
    final futures = candidates.map((p) async {
      await Future.delayed(const Duration(milliseconds: 320));
      return _computeMockLiveStatus(p);
    });

    final results = await Future.wait(futures);
    for (var i = 0; i < candidates.length; i++) {
      candidates[i] = candidates[i].copyWith(liveData: results[i]);
    }
    notifyListeners();
  }

  LiveStatus _computeMockLiveStatus(MiniProgram p) {
    final hour = DateTime.now().hour;
    switch (p.id) {
      case 'weather':
        // Werksseitig: 18-22°C je nach Tageszeit
        final temp = 15 + (hour % 10);
        return LiveStatus(
          value: '$temp°C',
          subtext: hour < 18 ? 'Heiter · Berlin' : 'Klar · Berlin',
          state: LiveState.live,
          fetchedAt: DateTime.now(),
        );
      case 'air':
        // EAQI 20-50 je nach Stunde
        final aqi = 20 + (hour % 30);
        return LiveStatus(
          value: 'AQI $aqi',
          subtext: aqi < 40 ? 'Gut' : (aqi < 60 ? 'Mäßig' : 'Ungesund'),
          state: LiveState.live,
          fetchedAt: DateTime.now(),
        );
      case 'mobility':
        return LiveStatus(
          value: 'Bus M29',
          subtext: '4 Min',
          state: LiveState.cached,
          fetchedAt: DateTime.now(),
        );
      case 'finance':
        return LiveStatus(
          value: '25 KUDOS',
          subtext: 'Wallet aktiv',
          state: LiveState.live,
          fetchedAt: DateTime.now(),
        );
      case 'health':
        return LiveStatus(
          value: '5 Praxen',
          subtext: 'in 500m',
          state: LiveState.cached,
          fetchedAt: DateTime.now(),
        );
      default:
        return LiveStatus(
          state: LiveState.fallback,
          fetchedAt: DateTime.now(),
        );
    }
  }

  // ------------------------------------------------------------------
  // Greeting-Builder: dynamisch je nach Tageszeit
  // ------------------------------------------------------------------

  String _buildGreeting() {
    final tod = _aiContext.timeOfDay;
    final prompt = switch (tod) {
      ContextTime.earlyMorning => 'Gute Reise',
      ContextTime.morning => 'Guten Morgen',
      ContextTime.midday => 'Mahlzeit',
      ContextTime.afternoon => 'Schönen Nachmittag',
      ContextTime.evening => 'Guten Abend',
      ContextTime.night => 'Gute Nacht',
    };
    return prompt;
  }

  // ------------------------------------------------------------------
  // AI-Context Refresh (bei LaunchScreen-Init)
  // ------------------------------------------------------------------

  void _refreshAiContext() {
    _aiContext = AiContext.now();
  }

  void recordRecentProgram(String programId) {
    final recent = List<String>.from(_aiContext.recentProgramIds);
    recent.remove(programId);
    recent.insert(0, programId);
    if (recent.length > 5) recent.removeLast();
    _aiContext = AiContext(
      timeOfDay: _aiContext.timeOfDay,
      isWeekend: _aiContext.isWeekend,
      recentProgramIds: recent,
      hasActiveLocation: _aiContext.hasActiveLocation,
    );
    notifyListeners();
  }

  // ------------------------------------------------------------------
  // Standard-Registry: 10 Mini-Programme mit Live + AI + Search-Tags
  // ------------------------------------------------------------------

  static final List<MiniProgram> _defaultPrograms = [
    const MiniProgram(
      id: 'weather',
      name: 'Wetter',
      url: 'https://heimat-backend.onrender.com/mini/weather.html',
      iconPath: 'weather',
      description: 'Aktuelle Wetterdaten & 7-Tage-Vorhersage — DWD Open Data.',
      category: 'Alltag',
      searchTags: ['temperatur', 'regen', 'sonne', 'dwd', 'wettervorhersage'],
      supportsLiveStatus: true,
      useNative: true, // Phase E: Wetter ist Pilot → natives Flutter-Widget
    ),
    const MiniProgram(
      id: 'air',
      name: 'Luftqualität',
      url: 'https://heimat-backend.onrender.com/mini/air.html',
      iconPath: 'air',
      description: 'Feinstaub- und Ozonwerte — CAMS Copernicus via Open-Meteo.',
      category: 'Alltag',
      searchTags: [
        'aqi',
        'feinstaub',
        'pm10',
        'pm25',
        'copernicus',
        'gesundheit'
      ],
      supportsLiveStatus: true,
    ),
    const MiniProgram(
      id: 'mobility',
      name: 'Mobilität',
      url: 'https://heimat-backend.onrender.com',
      iconPath: 'mobility',
      description: 'Haltestellen & Abfahrten in deiner Nähe.',
      category: 'Mobilität',
      searchTags: ['bus', 'bahn', 'öpnv', 'transitous', 'haltestelle'],
      supportsLiveStatus: true,
    ),
    const MiniProgram(
      id: 'finance',
      name: 'Finanzen',
      url: 'https://heimat-backend.onrender.com',
      iconPath: 'finance',
      description: 'Taler-Wallet & P2P-Überweisungen.',
      category: 'Alltag',
      searchTags: ['geld', 'kudos', 'taler', 'p2p', 'wallet'],
      supportsLiveStatus: true,
    ),
    const MiniProgram(
      id: 'health',
      name: 'Gesundheit',
      url: 'https://heimat-backend.onrender.com',
      iconPath: 'health',
      description: 'Ärzte-Suche & Online-Terminbuchung.',
      category: 'Alltag',
      searchTags: ['arzt', 'praxis', 'termin', 'medizin', 'doc'],
      supportsLiveStatus: true,
    ),
    const MiniProgram(
      id: 'events',
      name: 'Veranstaltungen',
      url: 'https://www.wikidata.org',
      iconPath: 'events',
      description: 'Events & Aktivitäten aus Wikidata & OpenStreetMap.',
      category: 'Kultur',
      searchTags: ['konzert', 'theater', 'fest', 'event', 'kultur'],
    ),
    const MiniProgram(
      id: 'jobs',
      name: 'Job-Suche',
      url: 'https://www.arbeitsagentur.de',
      iconPath: 'work',
      description: 'Stellenangebote der Bundesagentur für Arbeit.',
      category: 'Karriere',
      searchTags: ['stelle', 'arbeit', 'karriere', 'job', 'ba'],
    ),
    const MiniProgram(
      id: 'waste',
      name: 'Abfallkalender',
      url: 'https://opendata.de',
      iconPath: 'delete',
      description: 'Abfuhrtermine & Sortier-Tipps.',
      category: 'Alltag',
      searchTags: ['müll', 'abfuhr', 'entsorgung', 'recycling', 'gelber sack'],
    ),
    const MiniProgram(
      id: 'hotels',
      name: 'Hotels',
      url: 'https://www.openstreetmap.org',
      iconPath: 'hotel',
      description: 'Unterkünfte aus OpenStreetMap & Wikidata.',
      category: 'Reise',
      searchTags: ['unterkunft', 'übernachtung', 'reise', 'hostel'],
    ),
    const MiniProgram(
      id: 'buergeramt',
      name: 'Bürgeramt',
      url: 'https://service.berlin.de',
      iconPath: 'domain',
      description: 'Termine & Services deiner lokalen Bürgerämter.',
      category: 'Behörden',
      searchTags: ['amt', 'behörde', 'verwaltung', 'termin'],
    ),
  ];

  // ------------------------------------------------------------------
  // Aktionen
  // ------------------------------------------------------------------

  Future<void> loadPrograms() async {
    _isLoading = true;
    notifyListeners();
    _programs = _defaultPrograms;
    _isLoading = false;
    notifyListeners();
    // Live-Status asynchron nachladen
    await fetchLiveStatuses();
  }

  MiniProgram? _activeProgram;
  MiniProgram? get activeProgram => _activeProgram;

  void launchProgram(MiniProgram program) {
    _activeProgram = program;
    recordRecentProgram(program.id);
    notifyListeners();
  }

  void closeProgram() {
    _activeProgram = null;
    notifyListeners();
  }
}
