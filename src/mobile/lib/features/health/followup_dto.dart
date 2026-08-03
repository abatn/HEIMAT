/// DTOs für FollowUp (Nachsorge) — Phase Health AI Agent 2
///
/// Spiegelt die API-Responses aus `routes/followUp.ts`:
///   GET    /api/health/followups
///   POST   /api/health/followups/:id/respond
///   GET    /api/health/followups/history
///   GET    /api/health/followups/stats

/// Post-Termin Follow-up
class FollowUp {
  final String id;
  final String userId;
  final String? appointmentId;
  final String? doctorId;
  final String followupDate;
  final String followupType; // 'check_in', 'medication', 'symptom'
  final bool responded;
  final String? responseText;
  final int? responseSeverity;
  final String? aiAnalysis;
  final bool needsFollowup;
  final String? nextFollowupDate;
  final String status; // 'pending', 'sent', 'responded', 'closed'
  final String createdAt;
  final String? respondedAt;

  FollowUp({
    required this.id,
    required this.userId,
    this.appointmentId,
    this.doctorId,
    required this.followupDate,
    required this.followupType,
    this.responded = false,
    this.responseText,
    this.responseSeverity,
    this.aiAnalysis,
    this.needsFollowup = false,
    this.nextFollowupDate,
    required this.status,
    required this.createdAt,
    this.respondedAt,
  });

  factory FollowUp.fromJson(Map<String, dynamic> json) {
    return FollowUp(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? '',
      appointmentId: json['appointment_id'],
      doctorId: json['doctor_id'],
      followupDate: json['followup_date'] ?? '',
      followupType: json['followup_type'] ?? 'check_in',
      responded: json['responded'] == true,
      responseText: json['response_text'],
      responseSeverity: json['response_severity'],
      aiAnalysis: json['ai_analysis'],
      needsFollowup: json['needs_followup'] == true,
      nextFollowupDate: json['next_followup_date'],
      status: json['status'] ?? 'pending',
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
      respondedAt: json['responded_at'],
    );
  }

  /// Typ-Emoji
  String get typeEmoji {
    switch (followupType) {
      case 'check_in': return '📋';
      case 'medication': return '💊';
      case 'symptom': return '🩺';
      default: return '📋';
    }
  }

  /// Typ-Label
  String get typeLabel {
    switch (followupType) {
      case 'check_in': return 'Check-in';
      case 'medication': return 'Medikament';
      case 'symptom': return 'Symptom';
      default: return 'Follow-up';
    }
  }

  /// Status-Emoji
  String get statusEmoji {
    switch (status) {
      case 'pending': return '⏳';
      case 'sent': return '📤';
      case 'responded': return '✅';
      case 'closed': return '🔒';
      default: return '❓';
    }
  }

  /// Status-Farbe
  int get statusColor {
    switch (status) {
      case 'pending': return 0xFFFFB74D; // Orange
      case 'sent': return 0xFF3B82F6; // Blau
      case 'responded': return 0xFF66BB6A; // Grün
      case 'closed': return 0xFF9E9E9E; // Grau
      default: return 0xFF9E9E9E;
    }
  }

  /// Severity-Farbe (wenn geantwortet)
  int? get severityColor {
    if (responseSeverity == null) return null;
    if (responseSeverity! <= 3) return 0xFF66BB6A; // Grün
    if (responseSeverity! <= 6) return 0xFFFFB74D; // Orange
    return 0xFFFF5252; // Rot
  }

  /// Ist fällig (heute oder früher)?
  bool get isDue {
    final today = DateTime.now().toIso8601String().split('T')[0];
    return followupDate.compareTo(today) <= 0;
  }

  /// Countdown-Label
  String get countdownLabel {
    final today = DateTime.now();
    final due = DateTime.tryParse(followupDate) ?? today;
    final diff = due.difference(today);

    if (diff.isNegative) return 'Überfällig';
    if (diff.inDays == 0) return 'Heute';
    if (diff.inDays == 1) return 'Morgen';
    return 'In ${diff.inDays} Tagen';
  }
}

/// Follow-up Statistiken
class FollowUpStats {
  final int totalFollowups;
  final int pending;
  final int responded;
  final int needsFollowup;

  FollowUpStats({
    required this.totalFollowups,
    required this.pending,
    required this.responded,
    required this.needsFollowup,
  });

  factory FollowUpStats.fromJson(Map<String, dynamic> json) {
    return FollowUpStats(
      totalFollowups: json['total_followups'] ?? 0,
      pending: json['pending'] ?? 0,
      responded: json['responded'] ?? 0,
      needsFollowup: json['needs_followup'] ?? 0,
    );
  }

  /// Antwort-Rate in Prozent
  int get responseRate {
    if (totalFollowups == 0) return 0;
    return ((responded / totalFollowups) * 100).round();
  }
}
