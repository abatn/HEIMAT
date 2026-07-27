/// Live-Status Domain Model — repräsentiert Echtzeit-Daten eines Mini-Programms
/// ohne den vollen WebView zu öffnen. Wird für "Smart Cards" auf dem Dashboard
/// verwendet um sofortigen visuellen Wert zu liefern.
///
/// Beispiel-Werte:
///   Wetter: LiveStatus(value: "18°C", subtext: "Sonnig, Berlin", state: LiveState.live)
///   Luft:   LiveStatus(value: "AQI 25", subtext: "Sehr gut", state: LiveState.live)
///   Events: LiveStatus(value: "3 Events heute", subtext: "Berlin-Mitte", state: LiveState.fallback)
enum LiveState {
  live, // Grün pulsierend — echte API-Daten verfügbar
  cached, // Blau — Cache, älter als 5 Min
  fallback, // Grau — keine Live-Daten, statische Beschreibung
  loading, // Gelb blinkend — Daten werden geladen
  error, // Rot — API-Fehler, Retry-Button
}

class LiveStatus {
  final String? value; // Hauptwert: "18°C", "AQI 25", "3 Events"
  final String? subtext; // Detail: "Sonnig", "Sehr gut", "heute"
  final LiveState state;
  final DateTime fetchedAt;
  final String? errorMessage;

  const LiveStatus({
    this.value,
    this.subtext,
    this.state = LiveState.fallback,
    required this.fetchedAt,
    this.errorMessage,
  });

  bool get isLive => state == LiveState.live || state == LiveState.cached;
  bool get hasError => state == LiveState.error;

  // JSON-Parser für Backend-Response
  factory LiveStatus.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return LiveStatus(
        state: LiveState.fallback,
        fetchedAt: DateTime.now(),
      );
    }
    final stateStr = (json['state'] as String?) ?? 'fallback';
    return LiveStatus(
      value: json['value'] as String?,
      subtext: json['subtext'] as String?,
      state: LiveState.values.firstWhere(
        (s) => s.name == stateStr,
        orElse: () => LiveState.fallback,
      ),
      fetchedAt: DateTime.now(),
      errorMessage: json['error'] as String?,
    );
  }

  // JSON für Backend-Mock (oder lokale Berechnung)
  Map<String, dynamic> toJson() => {
        'value': value,
        'subtext': subtext,
        'state': state.name,
        'ts': fetchedAt.toIso8601String(),
      };
}
