/// DTOs für Mental Health (PHQ-9 Screening) — Phase Health AI Agent 2
///
/// Spiegelt die API-Responses aus `routes/mentalHealth.ts`:
///   POST   /api/health/mental/phq9
///   GET    /api/health/mental/phq9/history
///   GET    /api/health/mental/stats
///   GET    /api/health/mental/crisis
///   GET    /api/health/mental/questions

/// PHQ-9 Antworten (9 Fragen, Score 0-3)
class Phq9Answers {
  final int q1Lustlos; // Wenig Interesse oder Freude
  final int q2Niedergeschlagen; // Niedergeschlagen/hoffnungslos
  final int q3Schlafprobleme; // Schlafprobleme
  final int q4Muedigkeit; // Müdigkeit/keine Energie
  final int q5Appetit; // Schlechter Appetit/Überessen
  final int q6Schlecht; // Schlecht über sich selbst
  final int q7Konzentration; // Schwer sich zu konzentrieren
  final int q8Bewegung; // Langsam/unruhig bewegt
  final int q9Selbstverletzung; // Gedanken sich etwas anzutun

  Phq9Answers({
    required this.q1Lustlos,
    required this.q2Niedergeschlagen,
    required this.q3Schlafprobleme,
    required this.q4Muedigkeit,
    required this.q5Appetit,
    required this.q6Schlecht,
    required this.q7Konzentration,
    required this.q8Bewegung,
    required this.q9Selbstverletzung,
  });

  /// Gesamt-Score (0-27)
  int get totalScore =>
      q1Lustlos +
      q2Niedergeschlagen +
      q3Schlafprobleme +
      q4Muedigkeit +
      q5Appetit +
      q6Schlecht +
      q7Konzentration +
      q8Bewegung +
      q9Selbstverletzung;

  /// Als Map für API-Request
  Map<String, dynamic> toJson() => {
        'q1_lustlos': q1Lustlos,
        'q2_niedergeschlagen': q2Niedergeschlagen,
        'q3_schlafprobleme': q3Schlafprobleme,
        'q4_muedigkeit': q4Muedigkeit,
        'q5_appetit': q5Appetit,
        'q6_schlecht': q6Schlecht,
        'q7_konzentration': q7Konzentration,
        'q8_bewegung': q8Bewegung,
        'q9_selbstverletzung': q9Selbstverletzung,
      };

  factory Phq9Answers.fromJson(Map<String, dynamic> json) {
    return Phq9Answers(
      q1Lustlos: json['q1_lustlos'] ?? 0,
      q2Niedergeschlagen: json['q2_niedergeschlagen'] ?? 0,
      q3Schlafprobleme: json['q3_schlafprobleme'] ?? 0,
      q4Muedigkeit: json['q4_muedigkeit'] ?? 0,
      q5Appetit: json['q5_appetit'] ?? 0,
      q6Schlecht: json['q6_schlecht'] ?? 0,
      q7Konzentration: json['q7_konzentration'] ?? 0,
      q8Bewegung: json['q8_bewegung'] ?? 0,
      q9Selbstverletzung: json['q9_selbstverletzung'] ?? 0,
    );
  }
}

/// PHQ-9 Assessment Ergebnis
class Phq9Assessment {
  final String id;
  final String userId;
  final Phq9Answers answers;
  final int totalScore;
  final String severity; // 'leicht', 'mittel', 'schwer', 'sehr_schwer'
  final String? aiAnalysis;
  final String? aiRecommendation;
  final String createdAt;

  Phq9Assessment({
    required this.id,
    required this.userId,
    required this.answers,
    required this.totalScore,
    required this.severity,
    this.aiAnalysis,
    this.aiRecommendation,
    required this.createdAt,
  });

  factory Phq9Assessment.fromJson(Map<String, dynamic> json) {
    return Phq9Assessment(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      answers: Phq9Answers.fromJson(json['answers'] ?? {}),
      totalScore: json['total_score'] ?? 0,
      severity: json['severity'] ?? 'leicht',
      aiAnalysis: json['ai_analysis'],
      aiRecommendation: json['ai_recommendation'],
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
    );
  }

  /// Schweregrad-Label
  String get severityLabel {
    switch (severity) {
      case 'leicht':
        return 'Keine/Minimal Depression';
      case 'mittel':
        return 'Leichte Depression';
      case 'schwer':
        return 'Mittelschwere Depression';
      case 'sehr_schwer':
        return 'Schwere Depression';
      default:
        return 'Unbekannt';
    }
  }

  /// Emoji für Schweregrad
  String get severityEmoji {
    switch (severity) {
      case 'leicht':
        return '🟢';
      case 'mittel':
        return '🟡';
      case 'schwer':
        return '🟠';
      case 'sehr_schwer':
        return '🔴';
      default:
        return '❓';
    }
  }

  /// Farbe für Schweregrad
  int get severityColor {
    switch (severity) {
      case 'leicht':
        return 0xFF66BB6A; // Grün
      case 'mittel':
        return 0xFFFFB74D; // Orange
      case 'schwer':
        return 0xFFFF8A65; // Dunkel-Orange
      case 'sehr_schwer':
        return 0xFFFF5252; // Rot
      default:
        return 0xFF9E9E9E; // Grau
    }
  }
}

/// PHQ-9 Statistiken
class Phq9Stats {
  final int totalAssessments;
  final double averageScore;
  final Phq9Assessment? lastAssessment;
  final String trend; // 'verbesserung', 'stabil', 'verschlechterung'
  final String riskLevel; // 'niedrig', 'mittel', 'hoch'

  Phq9Stats({
    required this.totalAssessments,
    required this.averageScore,
    this.lastAssessment,
    required this.trend,
    required this.riskLevel,
  });

  factory Phq9Stats.fromJson(Map<String, dynamic> json) {
    return Phq9Stats(
      totalAssessments: json['total_assessments'] ?? 0,
      averageScore: (json['average_score'] ?? 0).toDouble(),
      lastAssessment: json['last_assessment'] != null
          ? Phq9Assessment.fromJson(json['last_assessment'])
          : null,
      trend: json['trend'] ?? 'stabil',
      riskLevel: json['risk_level'] ?? 'niedrig',
    );
  }

  /// Trend-Emoji
  String get trendEmoji {
    switch (trend) {
      case 'verbesserung':
        return '📉';
      case 'verschlechterung':
        return '📈';
      default:
        return '➡️';
    }
  }

  /// Risk-Level-Farbe
  int get riskColor {
    switch (riskLevel) {
      case 'hoch':
        return 0xFFFF5252;
      case 'mittel':
        return 0xFFFFB74D;
      default:
        return 0xFF66BB6A;
    }
  }
}

/// Notfall-Kontakt
class EmergencyContact {
  final String name;
  final String number;
  final String description;

  EmergencyContact({
    required this.name,
    required this.number,
    required this.description,
  });

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      name: json['name'] ?? '',
      number: json['number'] ?? '',
      description: json['description'] ?? '',
    );
  }
}

/// PHQ-9 Frage (Referenz)
class Phq9Question {
  final String id;
  final String question;
  final String field;

  Phq9Question({
    required this.id,
    required this.question,
    required this.field,
  });

  factory Phq9Question.fromJson(Map<String, dynamic> json) {
    return Phq9Question(
      id: json['id'] ?? '',
      question: json['question'] ?? '',
      field: json['field'] ?? '',
    );
  }
}

/// PHQ-9 Antwort-Skala
class Phq9Scale {
  final int value;
  final String label;

  Phq9Scale({
    required this.value,
    required this.label,
  });

  factory Phq9Scale.fromJson(Map<String, dynamic> json) {
    return Phq9Scale(
      value: json['value'] ?? 0,
      label: json['label'] ?? '',
    );
  }
}
