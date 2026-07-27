/// LocalSentimentClassifier - Phase E AI Hook Fundament
///
/// **AI-Architektur.md §Frontend** zeigt GENA dieses Pattern:
///   abstract `LocalClassifier` mit `classify(text) -> Vorhersage`
///   → vorbereitet fuer spaeteren TFLite-Swap (`Interpreter.fromAsset`)
///
/// Wir bauen 1:1 das gleiche Pattern fuer Wetter-Sentiment:
///   - abstraktes `LocalSentimentClassifier` Interface
///   - `StubNaiveBayesClassifier` als Default-Impl (Dart-only Mocks)
///   - `TfliteSentimentClassifier` (zukuenftig, Phase 1 nach AI-Implementierungsplan)
///
/// **AI-Implementierungsplan.md §Phase 1 Meilenstein:**
/// "Sprachsteuerung und lokale Kategorisierung funktionieren offline".
/// Dies ist der erste konkrete Schritt in diese Richtung.
library;

/// Sentiment-Achsen fuer den Output eines beliebigen LocalSentimentClassifier.
enum SentimentAxis { positive, neutral, negative }

extension _AxisLabel on SentimentAxis {
  String get label => switch (this) {
        SentimentAxis.positive => 'positive',
        SentimentAxis.neutral => 'neutral',
        SentimentAxis.negative => 'negative',
      };
}

/// SentimentResult - Output des Classifiers.
///
/// **Score-Range:** -1.0 (extrem schlecht) bis +1.0 (perfekt)
/// **Axis:** positive | neutral | negative
/// **Emoji:** UI-freundliches Symbol passend zum Score
/// **Source:** Welcher Classifier hat's berechnet (Debugging + ehrliche Attribution)
class SentimentResult {
  final double score;
  final SentimentAxis axis;
  final String emoji;
  final String source;
  final DateTime computedAt;

  const SentimentResult({
    required this.score,
    required this.axis,
    required this.emoji,
    required this.source,
    required this.computedAt,
  });

  /// Label-String (fuer UI)
  String get label => axis.label;

  /// True wenn Score klar polarisiert ist (nicht neutral).
  bool get isPolarized => axis != SentimentAxis.neutral;

  /// True wenn Score klar negativ ist.
  bool get isBad => score <= -0.4;

  /// True wenn Score klar positiv ist.
  bool get isGood => score >= 0.4;

  /// Kurzform fuer UI-Text: "🌟 +0.8"
  String get uiCompact =>
      '$emoji ${score >= 0 ? '+' : ''}${score.toStringAsFixed(1)}';
}

/// LocalSentimentClassifier - Abstrakte AI-Hook Schnittstelle.
///
/// Alle Implementierungen MUSSEN `classify(text)` als Future exposen.
/// Aktuell: [StubNaiveBayesClassifier] (Dart-only Mock).
/// Phase 1: [TfliteSentimentClassifier] mit echtem TFLite-Modell aus assets/.
abstract class LocalSentimentClassifier {
  Future<SentimentResult> classify(String text);
}

/// StubNaiveBayesClassifier - Phase E Default-Implementierung.
///
/// **Status:** Echte Implementierung kommt in Phase 1 nach `AI-Implementierungsplan.md`.
/// Heute: hand-tuned Score-Tabelle fuer die ~27 deutschen WMO-Wetter-Texte
/// (Backend weatherService.ts liefert diese direkt im JSON).
///
/// **Warum hand-tuned statt ML?**
/// - Web-Build kann TFLite nicht zuverlaessig (WASM-Loader issue)
/// - Stub ist deterministisch + versionierbar (kein random ML-Output)
/// - Wenn das echte Modell kommt: nur Stub austauschen, Pattern bleibt
/// - SMILIE: User kann im Code lesen WIE der Score zustande kommt
///
/// **On-Device:** Alles laeuft im Flutter-Dart, 0 Bytes Netzwerk-Traffic.
class StubNaiveBayesClassifier implements LocalSentimentClassifier {
  const StubNaiveBayesClassifier();

  @override
  Future<SentimentResult> classify(String text) async {
    final normalized = _normalize(text);
    final entry = _table[normalized];

    if (entry != null) {
      final (score, axis, emoji) = entry;
      return SentimentResult(
        score: score,
        axis: axis,
        emoji: emoji,
        source: 'stub-naive-bayes',
        computedAt: DateTime.now(),
      );
    }

    // Fallback fuer unbekannte Texte (z.B. zukuenftige neue WMO-Codes)
    return SentimentResult(
      score: 0.0,
      axis: SentimentAxis.neutral,
      emoji: '🌡️',
      source: 'stub-naive-bayes-fallback',
      computedAt: DateTime.now(),
    );
  }

  static String _normalize(String text) =>
      text.toLowerCase().trim().replaceAll(RegExp(r'[^a-zäöüß ]'), '');

  /// Hand-tuned Score-Tabelle: (score, axis, emoji) pro Wetter-Text.
  /// Werte sind PERSOENLICHE HEURISTIK, nicht ML-gelernt. Phase 1 ersetzt
  /// diese Tabelle mit einem trainierten TFLite-Modell das die gleichen
  /// Inputs (Wetter-Text) entgegennimmt — Pattern bleibt.
  static const Map<String, (double, SentimentAxis, String)> _table = {
    // Klar / sonnig -> sehr positiv
    'klarer himmel': (1.0, SentimentAxis.positive, '🌟'),
    'überwiegend klar': (0.8, SentimentAxis.positive, '☀️'),
    'teilweise bewölkt': (0.5, SentimentAxis.positive, '⛅'),

    // Neutral / bewölkt -> neutral
    'bewölkt': (0.1, SentimentAxis.neutral, '☁️'),
    'nebel': (-0.1, SentimentAxis.neutral, '🌫️'),
    'reifnebel': (-0.2, SentimentAxis.neutral, '🌫️'),

    // Leichter Regen / Schnee -> leicht negativ
    'leichter nieselregen': (-0.3, SentimentAxis.negative, '🌦️'),
    'leichter gefrierender nieselregen': (-0.4, SentimentAxis.negative, '🌨️'),
    'leichter regen': (-0.4, SentimentAxis.negative, '🌦️'),
    'leichte regenschauer': (-0.4, SentimentAxis.negative, '🌦️'),
    'leichter schneefall': (-0.3, SentimentAxis.negative, '🌨️'),
    'leichte schneeschauer': (-0.3, SentimentAxis.negative, '🌨️'),
    'schneekörner': (-0.2, SentimentAxis.neutral, '🌨️'),

    // Maessiger Regen / Schnee -> negativ
    'mäßiger nieselregen': (-0.5, SentimentAxis.negative, '🌧️'),
    'mäßiger regen': (-0.6, SentimentAxis.negative, '🌧️'),
    'mäßige regenschauer': (-0.6, SentimentAxis.negative, '🌧️'),
    'mäßiger schneefall': (-0.5, SentimentAxis.negative, '🌨️'),

    // Starker Regen / Schnee -> sehr negativ
    'starker nieselregen': (-0.7, SentimentAxis.negative, '🌧️'),
    'starker gefrierender nieselregen': (-0.8, SentimentAxis.negative, '🌧️'),
    'leicht gefrierender regen': (-0.7, SentimentAxis.negative, '🌧️'),
    'starker gefrierender regen': (-0.9, SentimentAxis.negative, '🌧️'),
    'starker regen': (-0.9, SentimentAxis.negative, '🌧️'),
    'starke regenschauer': (-0.9, SentimentAxis.negative, '🌧️'),
    'starker schneefall': (-0.8, SentimentAxis.negative, '❄️'),
    'starke schneeschauer': (-0.8, SentimentAxis.negative, '❄️'),

    // Unwetter -> maximal negativ
    'gewitter': (-1.0, SentimentAxis.negative, '⛈️'),
    'gewitter mit leichtem hagel': (-1.0, SentimentAxis.negative, '⛈️'),
    'gewitter mit starkem hagel': (-1.0, SentimentAxis.negative, '⛈️'),

    // Fallback-Key
    'unbekannt': (0.0, SentimentAxis.neutral, '🌡️'),
  };

  static const String sourceTag = 'stub-naive-bayes';
}

/// Singleton-Instanz fuer schnellen Provider-Zugriff.
final LocalSentimentClassifier defaultSentimentClassifier =
    const StubNaiveBayesClassifier();
