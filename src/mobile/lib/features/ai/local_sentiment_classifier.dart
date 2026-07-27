/// LocalSentimentClassifier - Phase R (2026-07-27) AI Hook.
///
/// User-Regel (AGENTS.md:143 + knowledge.md:283): "mock, simulation, fake sind verboten".
///
/// Phase R hat [StubNaiveBayesClassifier] ENTFERNT (war hand-tuned Score-Tabelle —
/// technisch ein Mock). Stattdessen ehrliche [UninitialisedClassifier]-Default-
/// Implementation, die neutrale SentimentResult { score: 0.0, axis: neutral,
/// emoji: '🤖', source: 'uninitialised' } zurueckgibt. Das UI zeigt
/// "KI noch nicht initialisiert" — User weiss was er bekommt.
///
/// **AI-Implementierungsplan.md §Phase 1 Meilenstein:** TFLite-Swap kommt spaeter.
/// Wenn das echte Modell kommt: nur [UninitialisedClassifier] austauschen,
/// das Interface [LocalSentimentClassifier] bleibt unveraendert.
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
/// Phase R Default: [UninitialisedClassifier] (ehrlich "AI noch nicht aktiv",
/// kein Mock-Score). Phase 1: [TfliteSentimentClassifier] mit echtem TFLite-
/// Modell aus assets/ ersetzt die UninitialisedClassifier-Implementation
/// direkt — Interface bleibt unveraendert.
abstract class LocalSentimentClassifier {
  Future<SentimentResult> classify(String text);
}

/// UninitialisedClassifier - Phase R Default-Implementierung.
///
/// **Status:** Phase R (2026-07-27). Echte ML/TFLite-Implementation kommt in
/// Phase 1 nach `AI-Implementierungsplan.md`. Diese Default-Implementation ist
/// KEIN Mock (User-Regel "mock, simulation, fake sind verboten"):
///   - Keine hand-tuned Score-Tabelle
///   - Keine erfundenen Wetter-Texte-Mappings
///   - Kein fake "always-positive" Sentiment
///
/// Stattdessen: ehrliche `SentimentResult { score: 0.0, axis: neutral,
/// emoji: '🤖', source: 'uninitialised' }`. Das UI (WeatherScreen) zeigt
/// "KI: nicht initialisiert" mit warning-Color — User weiss explizit dass
/// KEIN AI-Score berechnet wurde.
///
/// **On-Device:** Alles laeuft im Flutter-Dart, 0 Bytes Netzwerk-Traffic.
class UninitialisedClassifier implements LocalSentimentClassifier {
  const UninitialisedClassifier();

  @override
  Future<SentimentResult> classify(String text) async {
    // Phase R: ehrliche "AI nicht initialisiert"-Antwort, KEIN Mock-Score.
    return SentimentResult(
      score: 0.0,
      axis: SentimentAxis.neutral,
      emoji: '🤖',
      source: 'uninitialised',
      computedAt: DateTime.now(),
    );
  }
}

/// Singleton-Instanz fuer schnellen Provider-Zugriff.
/// Phase R: UninitialisedClassifier (kein Mock-Score).
final LocalSentimentClassifier defaultSentimentClassifier =
    const UninitialisedClassifier();
