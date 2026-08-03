/// DTOs für Prevention (Vorsorge-Empfehlungen) — Phase Health AI Agent 2
///
/// Spiegelt die API-Responses aus `routes/prevention.ts`:
///   GET    /api/health/prevention
///   POST   /api/health/prevention/generate
///   PUT    /api/health/prevention/:id
///   GET    /api/health/prevention/history
///   GET    /api/health/prevention/stats

/// Vorsorge-Empfehlung
class PreventionRecommendation {
  final String id;
  final String userId;
  final String category; // 'Vorsorge', 'Screening', 'Impfung', 'Lebensstil'
  final String title;
  final String description;
  final String priority; // 'hoch', 'mittel', 'niedrig'
  final String basedOn; // 'Alter', 'Geschlecht', 'Risikofaktor'
  final String? relevantUntil;
  final bool isCompleted;
  final String? completedAt;
  final String createdAt;

  PreventionRecommendation({
    required this.id,
    required this.userId,
    required this.category,
    required this.title,
    required this.description,
    required this.priority,
    required this.basedOn,
    this.relevantUntil,
    this.isCompleted = false,
    this.completedAt,
    required this.createdAt,
  });

  factory PreventionRecommendation.fromJson(Map<String, dynamic> json) {
    return PreventionRecommendation(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      category: json['category'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      priority: json['priority'] ?? 'niedrig',
      basedOn: json['based_on'] ?? json['basedOn'] ?? '',
      relevantUntil: json['relevant_until'],
      isCompleted: json['is_completed'] == true || json['isCompleted'] == true,
      completedAt: json['completed_at'],
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
    );
  }

  /// Kategorie-Emoji
  String get categoryEmoji {
    switch (category) {
      case 'Vorsorge':
        return '🩺';
      case 'Screening':
        return '🔍';
      case 'Impfung':
        return '💉';
      case 'Lebensstil':
        return '🏃';
      default:
        return '📋';
    }
  }

  /// Prioritäts-Farbe
  int get priorityColor {
    switch (priority) {
      case 'hoch':
        return 0xFFFF5252; // Rot
      case 'mittel':
        return 0xFFFFB74D; // Orange
      default:
        return 0xFF66BB6A; // Grün
    }
  }

  /// Prioritäts-Emoji
  String get priorityEmoji {
    switch (priority) {
      case 'hoch':
        return '🔴';
      case 'mittel':
        return '🟡';
      default:
        return '🟢';
    }
  }
}

/// Prevention Statistiken
class PreventionStats {
  final int totalRecommendations;
  final int completed;
  final int pending;
  final int highPriority;

  PreventionStats({
    required this.totalRecommendations,
    required this.completed,
    required this.pending,
    required this.highPriority,
  });

  factory PreventionStats.fromJson(Map<String, dynamic> json) {
    return PreventionStats(
      totalRecommendations: json['total_recommendations'] ?? 0,
      completed: json['completed'] ?? 0,
      pending: json['pending'] ?? 0,
      highPriority: json['high_priority'] ?? 0,
    );
  }

  /// Fortschritt in Prozent
  int get progressPercent {
    if (totalRecommendations == 0) return 0;
    return ((completed / totalRecommendations) * 100).round();
  }
}

/// User Health Profile (erweitert für Prevention)
class UserProfile {
  final String userId;
  final DateTime? birthDate;
  final String? gender;
  final double? weightKg;
  final double? heightCm;
  final bool isSmoker;
  final bool isPregnant;
  final List<String> chronicConditions;
  final List<String> allergies;
  final List<String> familyHistory;
  final String? insuranceType;
  final String? preferredLanguage;
  final String? preferredGenderDoctor;
  final bool needsAccessibility;
  final DateTime? lastCheckupDate;
  final DateTime? nextCheckupDate;
  final List<String> riskFactors;
  final Map<String, dynamic>? familyHistoryDetailed;

  UserProfile({
    required this.userId,
    this.birthDate,
    this.gender,
    this.weightKg,
    this.heightCm,
    this.isSmoker = false,
    this.isPregnant = false,
    this.chronicConditions = const [],
    this.allergies = const [],
    this.familyHistory = const [],
    this.insuranceType,
    this.preferredLanguage,
    this.preferredGenderDoctor,
    this.needsAccessibility = false,
    this.lastCheckupDate,
    this.nextCheckupDate,
    this.riskFactors = const [],
    this.familyHistoryDetailed,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userId: json['user_id'] ?? json['userId'] ?? '',
      birthDate: json['birth_date'] != null
          ? DateTime.tryParse(json['birth_date'])
          : null,
      gender: json['gender'],
      weightKg: (json['weight_kg'] as num?)?.toDouble(),
      heightCm: (json['height_cm'] as num?)?.toDouble(),
      isSmoker: json['is_smoker'] == true,
      isPregnant: json['is_pregnant'] == true,
      chronicConditions: List<String>.from(json['chronic_conditions'] ?? []),
      allergies: List<String>.from(json['allergies'] ?? []),
      familyHistory: List<String>.from(json['family_history'] ?? []),
      insuranceType: json['insurance_type'],
      preferredLanguage: json['preferred_language'],
      preferredGenderDoctor: json['preferred_gender_doctor'],
      needsAccessibility: json['needs_accessibility'] == true,
      lastCheckupDate: json['last_checkup_date'] != null
          ? DateTime.tryParse(json['last_checkup_date'])
          : null,
      nextCheckupDate: json['next_checkup_date'] != null
          ? DateTime.tryParse(json['next_checkup_date'])
          : null,
      riskFactors: List<String>.from(json['risk_factors'] ?? []),
      familyHistoryDetailed: json['family_history_detailed'],
    );
  }

  /// Alter berechnen
  int? get age {
    if (birthDate == null) return null;
    final today = DateTime.now();
    int age = today.year - birthDate!.year;
    if (today.month < birthDate!.month ||
        (today.month == birthDate!.month && today.day < birthDate!.day)) {
      age--;
    }
    return age;
  }

  /// BMI berechnen
  double? get bmi {
    if (weightKg == null || heightCm == null || heightCm! == 0) return null;
    final heightM = heightCm! / 100;
    return weightKg! / (heightM * heightM);
  }

  /// Als Map für API-Request
  Map<String, dynamic> toJson() => {
        if (birthDate != null)
          'birth_date': birthDate!.toIso8601String().split('T')[0],
        if (gender != null) 'gender': gender,
        if (weightKg != null) 'weight_kg': weightKg,
        if (heightCm != null) 'height_cm': heightCm,
        'is_smoker': isSmoker,
        'is_pregnant': isPregnant,
        'chronic_conditions': chronicConditions,
        'allergies': allergies,
        'family_history': familyHistory,
        if (insuranceType != null) 'insurance_type': insuranceType,
        if (preferredLanguage != null) 'preferred_language': preferredLanguage,
        if (preferredGenderDoctor != null)
          'preferred_gender_doctor': preferredGenderDoctor,
        'needs_accessibility': needsAccessibility,
        'risk_factors': riskFactors,
      };
}
