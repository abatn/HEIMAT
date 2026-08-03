/// DTOs für Health Memory (Gedächtnis — Symptom-Verlauf) — Phase Health AI Agent
///
/// Spiegelt die API-Responses aus `routes/healthMemory.ts`:
///   GET    /api/health/memory
///   POST   /api/health/memory
///   PUT    /api/health/memory/:id/resolve
///   GET    /api/health/memory/stats
///   DELETE /api/health/memory/:id

class HealthMemoryEntry {
  final String id;
  final String userId;
  final String symptomText;
  final String? symptomCategory;
  final int? severity;
  final String? duration;
  final String? triageLevel;
  final double? triageConfidence;
  final List<String>? icdCodes;
  final double? locationLat;
  final double? locationLng;
  final int? timeOfDay;
  final String? weatherCondition;
  final String? season;
  final List<String>? medicationsUsed;
  final bool isResolved;
  final String? resolvedAt;
  final bool doctorVisit;
  final String? doctorId;
  final String createdAt;
  final String updatedAt;

  HealthMemoryEntry({
    required this.id,
    required this.userId,
    required this.symptomText,
    this.symptomCategory,
    this.severity,
    this.duration,
    this.triageLevel,
    this.triageConfidence,
    this.icdCodes,
    this.locationLat,
    this.locationLng,
    this.timeOfDay,
    this.weatherCondition,
    this.season,
    this.medicationsUsed,
    this.isResolved = false,
    this.resolvedAt,
    this.doctorVisit = false,
    this.doctorId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory HealthMemoryEntry.fromJson(Map<String, dynamic> json) {
    return HealthMemoryEntry(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      symptomText: json['symptom_text'] ?? json['symptomText'] ?? '',
      symptomCategory: json['symptom_category'] ?? json['symptomCategory'],
      severity: json['severity'] as int?,
      duration: json['duration'],
      triageLevel: json['triage_level'] ?? json['triageLevel'],
      triageConfidence: (json['triage_confidence'] ?? json['triageConfidence']) as double?,
      icdCodes: json['icd_codes'] != null
          ? List<String>.from(json['icd_codes'])
          : json['icdCodes'] != null
              ? List<String>.from(json['icdCodes'])
              : null,
      locationLat: (json['location_lat'] ?? json['locationLat']) as double?,
      locationLng: (json['location_lng'] ?? json['locationLng']) as double?,
      timeOfDay: json['time_of_day'] as int? ?? json['timeOfDay'] as int?,
      weatherCondition: json['weather_condition'] ?? json['weatherCondition'],
      season: json['season'],
      medicationsUsed: json['medications_used'] != null
          ? List<String>.from(json['medications_used'])
          : json['medicationsUsed'] != null
              ? List<String>.from(json['medicationsUsed'])
              : null,
      isResolved: json['is_resolved'] == true || json['isResolved'] == true,
      resolvedAt: json['resolved_at'] ?? json['resolvedAt'],
      doctorVisit: json['doctor_visit'] == true || json['doctorVisit'] == true,
      doctorId: json['doctor_id'] ?? json['doctorId'],
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
      updatedAt: json['updated_at'] ?? json['updatedAt'] ?? '',
    );
  }

  /// Formatierte Schmerzskala
  String get severityFormatted {
    if (severity == null) return '';
    return '$severity/10';
  }

  /// Emoji für Triage-Level
  String get triageEmoji {
    switch (triageLevel) {
      case 'NOTFALL':
        return '🚨';
      case 'BEREITSCHAFT':
        return '⚠️';
      case 'ROUTINE':
        return '🟢';
      default:
        return '❓';
    }
  }

  /// Farbe für Triage-Level
  int get triageColor {
    switch (triageLevel) {
      case 'NOTFALL':
        return 0xFFFF5252; // Rot
      case 'BEREITSCHAFT':
        return 0xFFFFB74D; // Orange
      case 'ROUTINE':
        return 0xFF66BB6A; // Grün
      default:
        return 0xFF9E9E9E; // Grau
    }
  }
}

class HealthMemoryStats {
  final int totalEntries;
  final int activeSymptoms;
  final int resolvedSymptoms;
  final List<ChronicPattern> chronicPatterns;
  final List<CategoryFrequency> categoryFrequency;

  HealthMemoryStats({
    required this.totalEntries,
    required this.activeSymptoms,
    required this.resolvedSymptoms,
    required this.chronicPatterns,
    required this.categoryFrequency,
  });

  factory HealthMemoryStats.fromJson(Map<String, dynamic> json) {
    return HealthMemoryStats(
      totalEntries: json['total_entries'] ?? json['totalEntries'] ?? 0,
      activeSymptoms: json['active_symptoms'] ?? json['activeSymptoms'] ?? 0,
      resolvedSymptoms: json['resolved_symptoms'] ?? json['resolvedSymptoms'] ?? 0,
      chronicPatterns: (json['chronic_patterns'] ?? json['chronicPatterns'] ?? [])
          .map((e) => ChronicPattern.fromJson(e))
          .toList(),
      categoryFrequency: (json['category_frequency'] ?? json['categoryFrequency'] ?? [])
          .map((e) => CategoryFrequency.fromJson(e))
          .toList(),
    );
  }
}

class ChronicPattern {
  final String symptomCategory;
  final int occurrences;
  final double avgSeverity;
  final String firstSeen;
  final String lastSeen;
  final bool isChronic;

  ChronicPattern({
    required this.symptomCategory,
    required this.occurrences,
    required this.avgSeverity,
    required this.firstSeen,
    required this.lastSeen,
    required this.isChronic,
  });

  factory ChronicPattern.fromJson(Map<String, dynamic> json) {
    return ChronicPattern(
      symptomCategory: json['symptom_category'] ?? json['symptomCategory'] ?? '',
      occurrences: json['occurrences'] ?? 0,
      avgSeverity: (json['avg_severity'] ?? json['avgSeverity'] ?? 0).toDouble(),
      firstSeen: json['first_seen'] ?? json['firstSeen'] ?? '',
      lastSeen: json['last_seen'] ?? json['lastSeen'] ?? '',
      isChronic: json['is_chronic'] == true || json['isChronic'] == true,
    );
  }
}

class CategoryFrequency {
  final String category;
  final int count;

  CategoryFrequency({
    required this.category,
    required this.count,
  });

  factory CategoryFrequency.fromJson(Map<String, dynamic> json) {
    return CategoryFrequency(
      category: json['category'] ?? '',
      count: json['count'] ?? 0,
    );
  }
}
