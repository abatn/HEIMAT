import '../domain/live_status_model.dart';

/// Mini-Program Domain Model mit Live-Status + AI-Priority
/// Erweitert um:
///   - liveData: optionaler Live-Wert (z.B. Temperatur) — final mit copyWith
///   - hero: wird als großes Empfehlungs-Widget angezeigt
///   - searchTags: zusätzliche Tags für semantische Suche
class MiniProgram {
  final String id;
  final String name;
  final String url;
  final String iconPath;
  final String description;
  final String category;
  final List<String> searchTags;
  final bool supportsLiveStatus;
  final bool isHero;

  // Live Data — final + nullable, gesetzt via copyWith()
  final LiveStatus? liveData;

  const MiniProgram({
    required this.id,
    required this.name,
    required this.url,
    required this.iconPath,
    required this.description,
    required this.category,
    this.searchTags = const [],
    this.supportsLiveStatus = false,
    this.isHero = false,
    this.liveData,
  });

  /// Copy-with für LiveData replacement — gibt neue Instanz mit aktualisiertem liveData
  MiniProgram copyWith({LiveStatus? liveData}) {
    return MiniProgram(
      id: id,
      name: name,
      url: url,
      iconPath: iconPath,
      description: description,
      category: category,
      searchTags: searchTags,
      supportsLiveStatus: supportsLiveStatus,
      isHero: isHero,
      liveData: liveData ?? this.liveData,
    );
  }

  /// Visibility-Flag: alle Registry-Entries werden angezeigt
  bool get isActive => true;
}
