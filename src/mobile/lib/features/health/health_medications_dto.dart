/// DTOs für Health Medications (Medikamente) — Phase Health AI Agent
///
/// Spiegelt die API-Responses aus `routes/healthMedications.ts`:
///   GET    /api/health/medications
///   POST   /api/health/medications
///   POST   /api/health/medications/check
///   GET    /api/health/medications/interactions
///   GET    /api/health/medications/:id
///   PUT    /api/health/medications/:id
///   DELETE /api/health/medications/:id

class UserMedication {
  final String id;
  final String userId;
  final String name;
  final String? activeIngredient;
  final String? dosage;
  final String? frequency;
  final String? category;
  final bool isPrescription;
  final String? startDate;
  final String? endDate;
  final bool isActive;
  final String? notes;
  final String createdAt;
  final String updatedAt;

  UserMedication({
    required this.id,
    required this.userId,
    required this.name,
    this.activeIngredient,
    this.dosage,
    this.frequency,
    this.category,
    this.isPrescription = false,
    this.startDate,
    this.endDate,
    this.isActive = true,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserMedication.fromJson(Map<String, dynamic> json) {
    return UserMedication(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      name: json['name'] ?? '',
      activeIngredient: json['active_ingredient'] ?? json['activeIngredient'],
      dosage: json['dosage'],
      frequency: json['frequency'],
      category: json['category'],
      isPrescription:
          json['is_prescription'] == true || json['isPrescription'] == true,
      startDate: json['start_date'] ?? json['startDate'],
      endDate: json['end_date'] ?? json['endDate'],
      isActive: json['is_active'] == true || json['isActive'] == true,
      notes: json['notes'],
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
      updatedAt: json['updated_at'] ?? json['updatedAt'] ?? '',
    );
  }

  /// Formatierte Anzeige
  String get displayName {
    final parts = <String>[name];
    if (dosage != null && dosage!.isNotEmpty) parts.add(dosage!);
    if (frequency != null && frequency!.isNotEmpty) parts.add('($frequency)');
    return parts.join(' ');
  }
}

class MedicationInteraction {
  final String drugA;
  final String drugB;
  final String severity;
  final String description;
  final String recommendation;
  final String? source;

  MedicationInteraction({
    required this.drugA,
    required this.drugB,
    required this.severity,
    required this.description,
    required this.recommendation,
    this.source,
  });

  factory MedicationInteraction.fromJson(Map<String, dynamic> json) {
    return MedicationInteraction(
      drugA: json['drug_a'] ?? json['drugA'] ?? '',
      drugB: json['drug_b'] ?? json['drugB'] ?? '',
      severity: json['severity'] ?? '',
      description: json['description'] ?? '',
      recommendation: json['recommendation'] ?? '',
      source: json['source'],
    );
  }

  /// Emoji für Schweregrad
  String get severityEmoji {
    switch (severity) {
      case 'schwerwiegend':
        return '⛔';
      case 'mittel':
        return '⚠️';
      case 'leicht':
        return '🟢';
      default:
        return '❓';
    }
  }

  /// Farbe für Schweregrad
  int get severityColor {
    switch (severity) {
      case 'schwerwiegend':
        return 0xFFFF5252; // Rot
      case 'mittel':
        return 0xFFFFB74D; // Orange
      case 'leicht':
        return 0xFF66BB6A; // Grün
      default:
        return 0xFF9E9E9E; // Grau
    }
  }
}

class MedicationInteractionsResult {
  final List<MedicationInteraction> interactions;
  final bool hasSevereInteraction;

  MedicationInteractionsResult({
    required this.interactions,
    required this.hasSevereInteraction,
  });

  factory MedicationInteractionsResult.fromJson(Map<String, dynamic> json) {
    return MedicationInteractionsResult(
      interactions: (json['interactions'] ?? [])
          .map((e) => MedicationInteraction.fromJson(e))
          .toList(),
      hasSevereInteraction: json['hasSevereInteraction'] == true,
    );
  }
}

class AddMedicationResult {
  final UserMedication medication;
  final MedicationInteractionsResult interactions;

  AddMedicationResult({
    required this.medication,
    required this.interactions,
  });

  factory AddMedicationResult.fromJson(Map<String, dynamic> json) {
    return AddMedicationResult(
      medication: UserMedication.fromJson(json['medication']),
      interactions: MedicationInteractionsResult.fromJson(json),
    );
  }
}
