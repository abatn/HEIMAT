/// DTOs für den Check-in (Lebenszeichen) Service — Phase AI-Health-3 (2026-07-29).
///
/// Spiegelt die API-Responses aus `routes/checkin.ts`:
///   POST /api/checkin/activate
///   POST /api/checkin/deactivate
///   POST /api/checkin/ping
///   GET  /api/checkin/status
///   GET  /api/checkin/settings
///   PUT  /api/checkin/settings
///   GET  /api/checkin/events

class CheckinStatusDto {
  final bool isActive;
  final int? timeSinceLastPingMinutes;
  final int? currentIntervalHours;
  final int escalationStage;
  final String? nextPingDueAt;
  final bool healthContextActive;

  CheckinStatusDto({
    required this.isActive,
    this.timeSinceLastPingMinutes,
    this.currentIntervalHours,
    this.escalationStage = 0,
    this.nextPingDueAt,
    this.healthContextActive = false,
  });

  factory CheckinStatusDto.fromJson(Map<String, dynamic> json) {
    return CheckinStatusDto(
      isActive: json['isActive'] == true,
      timeSinceLastPingMinutes: json['timeSinceLastPingMinutes'] as int?,
      currentIntervalHours: json['currentIntervalHours'] as int?,
      escalationStage: json['escalationStage'] as int? ?? 0,
      nextPingDueAt: json['nextPingDueAt'] as String?,
      healthContextActive: json['healthContextActive'] == true,
    );
  }
}

class CheckinSettingsDto {
  final int intervalHours;
  final int intervalHealthHours;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? emergencyContactEmail;
  final bool auto112Enabled;
  final String? lastPingAt;

  CheckinSettingsDto({
    this.intervalHours = 24,
    this.intervalHealthHours = 6,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.emergencyContactEmail,
    this.auto112Enabled = false,
    this.lastPingAt,
  });

  factory CheckinSettingsDto.fromJson(Map<String, dynamic> json) {
    return CheckinSettingsDto(
      intervalHours: json['intervalHours'] as int? ?? 24,
      intervalHealthHours: json['intervalHealthHours'] as int? ?? 6,
      emergencyContactName: json['emergencyContactName'] as String?,
      emergencyContactPhone: json['emergencyContactPhone'] as String?,
      emergencyContactEmail: json['emergencyContactEmail'] as String?,
      auto112Enabled: json['auto112Enabled'] == true,
      lastPingAt: json['lastPingAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'intervalHours': intervalHours,
        'intervalHealthHours': intervalHealthHours,
        if (emergencyContactName != null)
          'emergencyContactName': emergencyContactName,
        if (emergencyContactPhone != null)
          'emergencyContactPhone': emergencyContactPhone,
        if (emergencyContactEmail != null)
          'emergencyContactEmail': emergencyContactEmail,
        'auto112Enabled': auto112Enabled,
      };
}

class CheckinEventDto {
  final String id;
  final String eventType;
  final int escalationStage;
  final String? details;
  final String createdAt;

  CheckinEventDto({
    required this.id,
    required this.eventType,
    this.escalationStage = 0,
    this.details,
    required this.createdAt,
  });

  factory CheckinEventDto.fromJson(Map<String, dynamic> json) {
    return CheckinEventDto(
      id: json['id'] ?? '',
      eventType: json['event_type'] as String? ?? json['eventType'] as String? ?? '',
      escalationStage: json['escalation_stage'] as int? ?? json['escalationStage'] as int? ?? 0,
      details: json['details'] as String?,
      createdAt: json['created_at'] as String? ?? json['createdAt'] as String? ?? '',
    );
  }
}

/// Antwort auf einen Ping — enthält nextPingDueAt + escalationStage
class CheckinPingResult {
  final String message;
  final String? nextPingDueAt;
  final int escalationStage;
  final bool healthContextActive;

  CheckinPingResult({
    required this.message,
    this.nextPingDueAt,
    this.escalationStage = 0,
    this.healthContextActive = false,
  });

  factory CheckinPingResult.fromJson(Map<String, dynamic> json) {
    return CheckinPingResult(
      message: json['message'] as String? ?? '',
      nextPingDueAt: json['nextPingDueAt'] as String?,
      escalationStage: json['escalationStage'] as int? ?? 0,
      healthContextActive: json['healthContextActive'] == true,
    );
  }
}
